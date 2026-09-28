import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getGoogleOAuthConfig } from "@/backend/google-oauth";
import { canSendRegisterOtp, isEmailConfigured } from "@/backend/email";
import { prisma } from "@/backend/prisma";
import { ensureDatabaseReady } from "@/backend/prod-bootstrap";
import { shouldSkipRegisterOtp } from "@/lib/first-run";
import { safeInternalPath } from "@/backend/safe-path";

type RegisterPageProps = {
  searchParams: Promise<{ next?: string; auth_error?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const nextPath = safeInternalPath(params.next);
  const firstRun = await loadFirstRun();

  return (
    <AuthShell
      title="Đăng ký"
      subtitle="Tạo cửa hàng của bạn"
    >
      <RegisterForm
        nextPath={nextPath}
        googleOAuthConfigured={Boolean(getGoogleOAuthConfig())}
        emailConfigured={isEmailConfigured()}
        canSendRegisterOtp={canSendRegisterOtp()}
        firstRun={firstRun}
        authError={params.auth_error}
      />
    </AuthShell>
  );
}

async function loadFirstRun() {
  try {
    return shouldSkipRegisterOtp(await prisma.staff.count());
  } catch {
    try {
      await ensureDatabaseReady();
      return shouldSkipRegisterOtp(await prisma.staff.count());
    } catch {
      return false;
    }
  }
}
