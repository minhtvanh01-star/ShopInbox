import { requireSession } from "@/backend/auth";
import { canSendEmailOtp } from "@/backend/email";
import { getGoogleOAuthConfig } from "@/backend/google-oauth";
import { prisma } from "@/backend/prisma";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { maskEmail } from "@/lib/mask-email";

type ProfilePageProps = {
  searchParams: Promise<{
    auth_success?: string;
    auth_error?: string;
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const session = await requireSession();
  const params = await searchParams;

  const staff = await prisma.staff.findUniqueOrThrow({
    where: { id: session.staffId },
  });

  const hasPassword = Boolean(staff.passwordHash);
  const hasGoogle = Boolean(staff.googleId);
  const authMethod = hasPassword && hasGoogle ? "both" : hasGoogle ? "google" : "email";
  const emailVerified = Boolean(staff.emailVerifiedAt || staff.googleId);

  return (
    <ProfileForm
      profile={{
        name: staff.name,
        emailMasked: maskEmail(staff.email),
        phone: staff.phone ?? "",
        avatarUrl: staff.avatarUrl ?? "",
        authMethod,
        emailVerified,
        hasPassword,
        canSendEmailOtp: canSendEmailOtp(),
        canLinkGoogle: hasPassword && !hasGoogle,
        googleOAuthConfigured: Boolean(getGoogleOAuthConfig()),
      }}
      flash={{
        success: params.auth_success,
        error: params.auth_error,
      }}
    />
  );
}
