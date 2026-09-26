import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveGoogleAuthUser } from "@/backend/google-auth";
import {
  GOOGLE_AUTH_STATE_COOKIE,
  GOOGLE_PKCE_COOKIE,
  googleAuthCookieOptions,
  verifyGoogleAuthStateToken,
  verifyGooglePkceToken,
} from "@/backend/google-auth-state";
import {
  assertGoogleIdentitiesMatch,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  classifyGoogleOAuthFailure,
  getGoogleOAuthConfig,
  verifyGoogleIdToken,
} from "@/backend/google-oauth";
import { prisma } from "@/backend/prisma";
import { isPrismaSchemaDriftError } from "@/backend/prisma-errors";
import { loadStaffSession } from "@/backend/auth";
import { resolveIsSuperAdmin } from "@/backend/super-admin";
import { getSession, setSessionCookie } from "@/backend/session";
import { auditMetaFromRequest, writeAudit } from "@/backend/audit";
import { absoluteAppUrl } from "@/backend/public-url";
import { safeInternalPath } from "@/backend/safe-path";
import { createOpenRegistrationStaff } from "@/backend/open-registration";
import { AUDIT_ACTIONS } from "@/lib/rbac-catalog";
import { postAuthPath, PROFILE_ONBOARD_PATH } from "@/lib/shop-setup";

function authPageUrl(
  request: Request,
  path: "/login" | "/register",
  params: Record<string, string>,
) {
  const url = absoluteAppUrl(request, path);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function redirectWithError(
  request: Request,
  code: string,
  mode: "login" | "register" | "link",
  next?: string,
) {
  if (mode === "link") {
    return profileRedirect(request, { auth_error: code });
  }

  const params: Record<string, string> = { auth_error: code };
  if (next) {
    params.next = next;
  }
  return NextResponse.redirect(authPageUrl(request, mode === "register" ? "/register" : "/login", params));
}

function profileRedirect(request: Request, params: Record<string, string>) {
  const url = absoluteAppUrl(request, "/settings/profile");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

function clearGoogleAuthCookies(response: NextResponse) {
  const expired = { ...googleAuthCookieOptions(), maxAge: 0 };
  response.cookies.set(GOOGLE_AUTH_STATE_COOKIE, "", expired);
  response.cookies.set(GOOGLE_PKCE_COOKIE, "", expired);
  return response;
}

async function createSessionForStaff(staffId: string) {
  await setSessionCookie(await loadStaffSession(staffId));
}

export async function GET(request: Request) {
  const config = getGoogleOAuthConfig();
  if (!config) {
    return redirectWithError(request, "google_not_configured", "login");
  }

  const { searchParams } = new URL(request.url);
  const jar = await cookies();
  const storedState = jar.get(GOOGLE_AUTH_STATE_COOKIE)?.value;
  const storedPkce = jar.get(GOOGLE_PKCE_COOKIE)?.value;
  const earlyState = storedState ? await verifyGoogleAuthStateToken(storedState) : null;
  const earlyMode = earlyState?.mode === "register" ? "register" : "login";

  const oauthError = searchParams.get("error");
  if (oauthError) {
    return clearGoogleAuthCookies(redirectWithError(request, "google_denied", earlyMode));
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return clearGoogleAuthCookies(redirectWithError(request, "google_invalid", earlyMode));
  }

  if (!storedState || storedState !== state) {
    return clearGoogleAuthCookies(redirectWithError(request, "google_state", earlyMode));
  }

  const statePayload = await verifyGoogleAuthStateToken(state);
  const codeVerifier = storedPkce ? await verifyGooglePkceToken(storedPkce) : null;
  if (!statePayload || !codeVerifier) {
    return clearGoogleAuthCookies(redirectWithError(request, "google_state", earlyMode));
  }

  const nextPath = safeInternalPath(statePayload.next);
  const mode = statePayload.mode;

  if (mode === "link") {
    const session = await getSession();
    if (!session || session.staffId !== statePayload.staffId) {
      return clearGoogleAuthCookies(
        NextResponse.redirect(absoluteAppUrl(request, "/login?next=/settings/profile")),
      );
    }
  }

  try {
    const token = await exchangeGoogleCode(config, code, codeVerifier);
    const googleUser = await verifyGoogleIdToken(config, token.idToken, statePayload.nonce);

    try {
      const userInfo = await fetchGoogleUserInfo(token.accessToken);
      assertGoogleIdentitiesMatch(googleUser, userInfo);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("không khớp")) {
        throw err;
      }
    }

    if (!googleUser.emailVerified) {
      await writeAudit({
        ...auditMetaFromRequest(request),
        actorEmail: googleUser.email,
        action: AUDIT_ACTIONS.authLoginFail,
        entityType: "Session",
        metadata: { reason: "google_email_unverified", method: "google" },
      });
      return clearGoogleAuthCookies(redirectWithError(request, "google_email_unverified", mode, nextPath));
    }

    const [existingByGoogleId, existingByEmail, staffCount, shopExists] = await Promise.all([
      prisma.staff.findUnique({ where: { googleId: googleUser.sub } }),
      prisma.staff.findUnique({ where: { email: googleUser.email } }),
      prisma.staff.count(),
      prisma.shop.findFirst({ select: { id: true } }).then(Boolean),
    ]);

    if (mode === "link") {
      const session = await getSession();
      if (!session) {
        return clearGoogleAuthCookies(
          NextResponse.redirect(absoluteAppUrl(request, "/login?next=/settings/profile")),
        );
      }

      const current = await prisma.staff.findUniqueOrThrow({ where: { id: session.staffId } });
      if (current.googleId) {
        return clearGoogleAuthCookies(profileRedirect(request, { auth_error: "google_already_linked" }));
      }

      if (existingByGoogleId && existingByGoogleId.id !== session.staffId) {
        return clearGoogleAuthCookies(profileRedirect(request, { auth_error: "google_account_taken" }));
      }

      if (existingByEmail && existingByEmail.id !== session.staffId) {
        return clearGoogleAuthCookies(profileRedirect(request, { auth_error: "google_email_taken" }));
      }

      await prisma.staff.update({
        where: { id: session.staffId },
        data: {
          googleId: googleUser.sub,
          avatarUrl: googleUser.picture ?? current.avatarUrl,
        },
      });

      await createSessionForStaff(session.staffId);

      return clearGoogleAuthCookies(profileRedirect(request, { auth_success: "google_linked" }));
    }

    const resolved = resolveGoogleAuthUser({
      googleUser,
      existingByGoogleId,
      existingByEmail,
      staffCount,
      shopExists,
      intent: mode === "register" ? "register" : "login",
    });

    if (resolved.action === "error") {
      await writeAudit({
        ...auditMetaFromRequest(request),
        actorEmail: googleUser.email,
        action: AUDIT_ACTIONS.authLoginFail,
        entityType: "Session",
        metadata: { reason: resolved.code, method: "google" },
      });
      return clearGoogleAuthCookies(redirectWithError(request, resolved.code, mode, nextPath));
    }

    if (resolved.action === "login") {
      let staffRow: {
        id: string;
        isActive: boolean;
        isSuperAdmin: boolean;
        email: string;
        roleCode: string;
        shopId: string;
        shop: { suspendedAt: Date | null };
      } | null;
      try {
        staffRow = await prisma.staff.findUnique({
          where: { id: resolved.staffId },
          select: {
            id: true,
            isActive: true,
            isSuperAdmin: true,
            email: true,
            roleCode: true,
            shopId: true,
            shop: { select: { suspendedAt: true } },
          },
        });
      } catch (error) {
        if (!isPrismaSchemaDriftError(error)) {
          throw error;
        }
        const basic = await prisma.staff.findUnique({
          where: { id: resolved.staffId },
          select: { id: true, isActive: true, email: true, roleCode: true, shopId: true },
        });
        staffRow = basic
          ? { ...basic, isSuperAdmin: false, shop: { suspendedAt: null } }
          : null;
      }
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
        return clearGoogleAuthCookies(redirectWithError(request, "inactive", mode, nextPath));
      }

      if (staffRow.shop.suspendedAt && !(await resolveIsSuperAdmin(staffRow))) {
        await writeAudit({
          ...auditMetaFromRequest(request),
          actorEmail: googleUser.email,
          actor: {
            id: resolved.staffId,
            email: staffRow.email,
            role: staffRow.roleCode,
            shopId: staffRow.shopId,
          },
          action: AUDIT_ACTIONS.authLoginFail,
          entityType: "Session",
          entityId: resolved.staffId,
          metadata: { reason: "shop_suspended", method: "google" },
        });
        return clearGoogleAuthCookies(redirectWithError(request, "shop_suspended", mode, nextPath));
      }

      const updateData: { name?: string; avatarUrl?: string | null; googleId?: string } = {};
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
        try {
          await prisma.staff.update({
            where: { id: resolved.staffId },
            data: updateData,
          });
        } catch (error) {
          if (!updateData.googleId && !updateData.name) {
            throw error;
          }
          await prisma.staff.update({
            where: { id: resolved.staffId },
            data: {
              ...(updateData.googleId ? { googleId: updateData.googleId } : {}),
              ...(updateData.name ? { name: updateData.name } : {}),
            },
          });
        }
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

      return clearGoogleAuthCookies(
        NextResponse.redirect(absoluteAppUrl(request, postAuthPath(session, nextPath))),
      );
    }

    const created = await createOpenRegistrationStaff({
      email: resolved.email,
      name: resolved.name,
      googleId: resolved.googleId,
      avatarUrl: resolved.avatarUrl,
    });
    if (!created.ok) {
      return clearGoogleAuthCookies(
        redirectWithError(
          request,
          created.error.includes("đủ") ? "shop_seat_full" : "google_already_registered",
          mode,
          nextPath,
        ),
      );
    }
    const staff = created.staff;

    const registerActor = {
      id: staff.id,
      email: staff.email,
      role: staff.roleCode,
      shopId: staff.shopId,
    };

    await writeAudit({
      ...auditMetaFromRequest(request),
      actor: registerActor,
      action: AUDIT_ACTIONS.authRegister,
      entityType: "Staff",
      entityId: staff.id,
      metadata: {
        method: "google",
        roleCode: staff.roleCode,
        isActive: staff.isActive,
        pendingApproval: !staff.isActive,
        shopCreated: true,
      },
    });

    if (!staff.isActive) {
      return clearGoogleAuthCookies(
        NextResponse.redirect(
          authPageUrl(request, "/login", { auth_success: "pending_approval" }),
        ),
      );
    }

    await createSessionForStaff(staff.id);
    const session = await loadStaffSession(staff.id);
    await writeAudit({
      ...auditMetaFromRequest(request),
      actor: session,
      action: AUDIT_ACTIONS.authLogin,
      entityType: "Session",
      entityId: staff.id,
      metadata: { method: "google", shopCreated: true },
    });

    return clearGoogleAuthCookies(NextResponse.redirect(absoluteAppUrl(request, PROFILE_ONBOARD_PATH)));
  } catch (err) {
    const message = err instanceof Error ? err.message : "google_failed";
    const codeName = classifyGoogleOAuthFailure(message);
    console.error("[google-oauth] callback failed", {
      code: codeName,
      redirectUri: config.redirectUri,
      detail: message.slice(0, 200),
    });
    await writeAudit({
      ...auditMetaFromRequest(request),
      action: AUDIT_ACTIONS.authLoginFail,
      entityType: "Session",
      metadata: { reason: codeName, method: "google", detail: message.slice(0, 200) },
    });
    const failedMode = statePayload.mode === "register" ? "register" : "login";
    const url = authPageUrl(request, failedMode === "register" ? "/register" : "/login", {
      auth_error: codeName,
    });
    return clearGoogleAuthCookies(NextResponse.redirect(url));
  }
}
