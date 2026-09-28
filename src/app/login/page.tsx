import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getGoogleOAuthConfig, isLocalGoogleRedirect } from "@/backend/google-oauth";
import { probeDatabase } from "@/backend/db-status";
import { prisma } from "@/backend/prisma";
import { ensureDatabaseReady } from "@/backend/prod-bootstrap";
import { safeInternalPath } from "@/backend/safe-path";
import { classifyDatabaseError, type DatabaseErrorCode } from "@/lib/database-url";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    auth_error?: string;
    auth_success?: string;
    reset?: string;
    reason?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeInternalPath(params.next);
  const google = getGoogleOAuthConfig();
  const platform = await loadLoginPlatformState();

  return (
    <AuthShell
      title="Đăng nhập"
      subtitle="Inbox đa kênh cho cửa hàng"
    >
      <LoginForm
        shopName="Nexo"
        nextPath={nextPath}
        googleOAuthConfigured={Boolean(google)}
        googleLocalRedirect={Boolean(
          google && process.env.NODE_ENV === "production" && isLocalGoogleRedirect(google.redirectUri),
        )}
        authError={params.auth_error}
        authSuccess={params.auth_success}
        resetSuccess={params.reset === "1"}
        idleTimeout={params.reason === "idle"}
        dbOk={platform.dbOk}
        dbError={platform.dbError}
        emptyPlatform={platform.empty}
      />
    </AuthShell>
  );
}

async function loadLoginPlatformState() {
  let probe = await probeDatabase();
  if (!probe.ok && (probe.code === "schema" || probe.code === "unknown")) {
    try {
      await ensureDatabaseReady();
      probe = await probeDatabase();
    } catch (error) {
      console.error("[login] ensureDatabaseReady failed", error);
    }
  }
  if (!probe.ok) {
    return { dbOk: false, empty: false, dbError: probe.code };
  }
  try {
    const staffCount = await prisma.staff.count();
    return { dbOk: true, empty: staffCount === 0, dbError: null as DatabaseErrorCode | null };
  } catch (error) {
    return { dbOk: false, empty: false, dbError: classifyDatabaseError(error) };
  }
}
