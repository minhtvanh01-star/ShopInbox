import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getGoogleOAuthConfig, isLocalGoogleRedirect } from "@/backend/google-oauth";
import { safeInternalPath } from "@/backend/safe-path";

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

  return (
    <AuthShell
      title="Đăng nhập"
      subtitle="Inbox đa kênh cho cửa hàng"
      intro={
        <>
          Đăng nhập bằng email/mật khẩu hoặc Google đã liên kết. Chủ shop mới đăng ký sẽ vào màn
          cấu hình cửa hàng trước. Nhân viên vào shop bằng link mời, không đăng ký công khai.
        </>
      }
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
      />
    </AuthShell>
  );
}
