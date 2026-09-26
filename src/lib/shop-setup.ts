import { isPlatformAdminPath, isSuperAdminSession, SUPER_ADMIN_HOME } from "@/lib/super-admin";

export const SHOP_SETUP_PATH = "/setup";
export const PROFILE_ONBOARD_PATH = "/register/profile";

export function isShopSetupPending(
  session: { shopSetupComplete?: boolean; isSuperAdmin?: boolean } | null | undefined,
) {
  if (isSuperAdminSession(session)) return false;
  return session?.shopSetupComplete === false;
}

export function postAuthPath(
  session: { shopSetupComplete?: boolean; isSuperAdmin?: boolean } | null | undefined,
  nextPath = "/inbox",
) {
  if (isSuperAdminSession(session)) {
    if (nextPath && isPlatformAdminPath(nextPath)) {
      return nextPath;
    }
    return SUPER_ADMIN_HOME;
  }
  return isShopSetupPending(session) ? PROFILE_ONBOARD_PATH : nextPath;
}

export function isShopSetupExemptPath(
  pathname: string,
  session?: { isSuperAdmin?: boolean } | null,
) {
  if (pathname === PROFILE_ONBOARD_PATH || pathname.startsWith(`${PROFILE_ONBOARD_PATH}/`)) {
    return true;
  }
  if (pathname === SHOP_SETUP_PATH || pathname.startsWith(`${SHOP_SETUP_PATH}/`)) {
    return true;
  }
  return isSuperAdminSession(session) && isPlatformAdminPath(pathname);
}
