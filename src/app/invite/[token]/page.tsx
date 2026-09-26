import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { AcceptInviteForm } from "@/components/invite/AcceptInviteForm";
import { loadUsableInviteByToken } from "@/backend/shop-invite";
import { roleLabel } from "@/lib/rbac-catalog";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invite = await loadUsableInviteByToken(token);

  if (!invite) {
    return (
      <AuthShell
        title="Lời mời không hợp lệ"
        subtitle="Link đã hết hạn hoặc đã dùng"
        intro="Nhờ chủ shop gửi lại lời mời mới, hoặc đăng nhập nếu bạn đã có tài khoản."
      >
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-teal-700 hover:underline">
            Về trang đăng nhập
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Tham gia cửa hàng"
      subtitle={invite.shop.name}
      intro="Tạo tài khoản nhân viên trên đúng shop đã mời bạn. Không tạo shop mới."
    >
      <AcceptInviteForm
        token={token}
        shopName={invite.shop.name}
        lockedEmail={invite.email}
        roleLabel={roleLabel(invite.roleCode)}
      />
    </AuthShell>
  );
}
