export const SHOP_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SHOP_INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export function invitePath(token: string) {
  return `/invite/${token}`;
}

export function isInviteUsable(invite: {
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}, now = new Date()) {
  if (invite.usedAt || invite.revokedAt) return false;
  return invite.expiresAt.getTime() > now.getTime();
}

export function inviteEmailMatches(inviteEmail: string | null | undefined, submitted: string) {
  if (!inviteEmail) return true;
  return inviteEmail.trim().toLowerCase() === submitted.trim().toLowerCase();
}

export function isInviteTokenShape(token: string) {
  return SHOP_INVITE_TOKEN_RE.test(token.trim());
}
