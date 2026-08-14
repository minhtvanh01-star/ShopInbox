import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveGoogleAuthUser } from "@/backend/google-auth";
import {
  GOOGLE_AUTH_STATE_COOKIE,
  verifyGoogleAuthStateToken,
} from "@/backend/google-auth-state";
import {
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  getGoogleOAuthConfig,
} from "@/backend/google-oauth";
import { prisma } from "@/backend/prisma";
import { loadStaffSession } from "@/backend/auth";
import { getSession, setSessionCookie } from "@/backend/session";
import { auditMetaFromRequest, writeAudit } from "@/backend/audit";
import { safeInternalPath } from "@/backend/safe-path";
import { AUDIT_ACTIONS, normalizeRoleCode } from "@/lib/rbac-catalog";

function redirectWithError(request: Request, code: string, next?: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("auth_error", code);
  if (next) {
    url.searchParams.set("next", next);
  }
  return NextResponse.redirect(url);
}

function profileRedirect(request: Request, params: Record<string, string>) {
  const url = new URL("/settings/profile", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

async function createSessionForStaff(staffId: string) {
  await setSessionCookie(await loadStaffSession(staffId));
}

export async function GET(request: Request) {
  const config = getGoogleOAuthConfig();
  if (!config) {
    return redirectWithError(request, "google_not_configured");
  }

  const { searchParams } = new URL(request.url);
  const oauthError = searchParams.get("error");
  if (oauthError) {
    return redirectWithError(request, "google_denied");
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return redirectWithError(request, "google_invalid");
  }

  const jar = await cookies();
  const storedState = jar.get(GOOGLE_AUTH_STATE_COOKIE)?.value;
  if (!storedState || storedState !== state) {
    return redirectWithError(request, "google_state");
  }

  const statePayload = await verifyGoogleAuthStateToken(state);
  if (!statePayload) {
    return redirectWithError(request, "google_state");
  }

  const nextPath = safeInternalPath(statePayload.next);

  if (statePayload.mode === "link") {
    const session = await getSession();
    if (!session || session.staffId !== statePayload.staffId) {
      return NextResponse.redirect(new URL("/login?next=/settings/profile", request.url));
    }
  }

  try {
    const token = await exchangeGoogleCode(config, code);
    const googleUser = await fetchGoogleUserInfo(token.accessToken);

    const [existingByGoogleId, existingByEmail, staffCount, shopExists] = await Promise.all([
      prisma.staff.findUnique({ where: { googleId: googleUser.sub } }),
      prisma.staff.findUnique({ where: { email: googleUser.email } }),
      prisma.staff.count(),
      prisma.shop.findFirst({ select: { id: true } }).then(Boolean),
    ]);

    const resolved = resolveGoogleAuthUser({
      googleUser,
      existingByGoogleId,
      existingByEmail,
      staffCount,
      shopExists,
    });

    if (resolved.action === "error") {
      await writeAudit({
        ...auditMetaFromRequest(request),
        actorEmail: googleUser.email,
        action: AUDIT_ACTIONS.authLoginFail,
        entityType: "Session",
        metadata: { reason: resolved.code, method: "google" },
      });
      const response =
        statePayload.mode === "link"
          ? profileRedirect(request, { auth_error: resolved.code })
          : redirectWithError(request, resolved.code, nextPath);
      response.cookies.delete(GOOGLE_AUTH_STATE_COOKIE);
      return response;
    }

    if (statePayload.mode === "link") {
      const session = await getSession();
      if (!session) {
        return NextResponse.redirect(new URL("/login?next=/settings/profile", request.url));
      }

      const current = await prisma.staff.findUniqueOrThrow({ where: { id: session.staffId } });
      if (current.googleId) {
        return profileRedirect(request, { auth_error: "google_already_linked" });
      }

      if (existingByGoogleId && existingByGoogleId.id !== session.staffId) {
        return profileRedirect(request, { auth_error: "google_account_taken" });
      }

      if (existingByEmail && existingByEmail.id !== session.staffId) {
        return profileRedirect(request, { auth_error: "google_email_taken" });
      }

      await prisma.staff.update({
        where: { id: session.staffId },
        data: {
          googleId: googleUser.sub,
          avatarUrl: googleUser.picture ?? current.avatarUrl,
        },
      });

      await createSessionForStaff(session.staffId);

      const response = profileRedirect(request, { auth_success: "google_linked" });
      response.cookies.delete(GOOGLE_AUTH_STATE_COOKIE);
      return response;
    }

    if (resolved.action === "login") {
      const staffRow = await prisma.staff.findUnique({
        where: { id: resolved.staffId },
        select: { isActive: true, email: true, roleCode: true, shopId: true },
      });
      if (!staffRow?.isActive) {
        await writeAudit({
          ...auditMetaFromRequest(request),
          actorEmail: googleUser.email,
          actor: staffRow
            ? {
                id: resolved.staffId,
                email: staffRow.email,
                role: staffRow.roleCode,
                shopId: staffRow.shopId,
              }
            : undefined,
          action: AUDIT_ACTIONS.authLoginFail,
          entityType: "Session",
          entityId: resolved.staffId,
          metadata: { reason: "inactive", method: "google" },
        });
        const response = redirectWithError(request, "inactive", nextPath);
        response.cookies.delete(GOOGLE_AUTH_STATE_COOKIE);
        return response;
      }

      const updateData: { googleId?: string; name?: string; avatarUrl?: string | null } = {};
      if (resolved.linkGoogleId) {
        updateData.googleId = resolved.linkGoogleId;
      }
      if (resolved.updateProfile?.name) {
        updateData.name = resolved.updateProfile.name;
      }
      if (resolved.updateProfile?.avatarUrl) {
        updateData.avatarUrl = resolved.updateProfile.avatarUrl;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.staff.update({
          where: { id: resolved.staffId },
          data: updateData,
        });
      }

      await createSessionForStaff(resolved.staffId);
      const session = await loadStaffSession(resolved.staffId);
      await writeAudit({
        ...auditMetaFromRequest(request),
        actor: session,
        action: AUDIT_ACTIONS.authLogin,
        entityType: "Session",
        entityId: session.staffId,
        metadata: { method: "google" },
      });

      const response = NextResponse.redirect(new URL(nextPath, request.url));
      response.cookies.delete(GOOGLE_AUTH_STATE_COOKIE);
      return response;
    }

    if (resolved.createShop) {
      await prisma.shop.create({
        data: {
          id: resolved.createShop.id,
          name: resolved.createShop.name,
        },
      });
    }

    const staff = await prisma.staff.create({
      data: {
        id: `staff-${crypto.randomUUID()}`,
        shopId: resolved.shopId,
        name: resolved.name,
        email: resolved.email,
        googleId: resolved.googleId,
        avatarUrl: resolved.avatarUrl,
        roleCode: normalizeRoleCode(resolved.role),
      },
    });

    await createSessionForStaff(staff.id);
    const session = await loadStaffSession(staff.id);
    await writeAudit({
      ...auditMetaFromRequest(request),
      actor: session,
      action: AUDIT_ACTIONS.staffCreate,
      entityType: "Staff",
      entityId: staff.id,
      metadata: { method: "google", roleCode: staff.roleCode },
    });
    await writeAudit({
      ...auditMetaFromRequest(request),
      actor: session,
      action: AUDIT_ACTIONS.authLogin,
      entityType: "Session",
      entityId: staff.id,
      metadata: { method: "google", bootstrap: Boolean(resolved.createShop) },
    });

    const response = NextResponse.redirect(new URL(nextPath, request.url));
    response.cookies.delete(GOOGLE_AUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "google_failed";
    await writeAudit({
      ...auditMetaFromRequest(request),
      action: AUDIT_ACTIONS.authLoginFail,
      entityType: "Session",
      metadata: { reason: "google_failed", method: "google" },
    });
    const url = new URL("/login", request.url);
    url.searchParams.set("auth_error", "google_failed");
    url.searchParams.set("auth_message", message.slice(0, 200));
    const response = NextResponse.redirect(url);
    response.cookies.delete(GOOGLE_AUTH_STATE_COOKIE);
    return response;
  }
}
