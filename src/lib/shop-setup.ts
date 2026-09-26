import { isPlatformAdminPath, isSuperAdminSession, SUPER_ADMIN_HOME } from "@/lib/super-admin";

export const SHOP_SETUP_PATH = "/setup";

export function isShopSetupPending(session: { shopSetupComplete?: boolean } | null | undefined) {
  return session?.shopSetupComplete === false;
}

export function postAuthPath(
  session: { shopSetupComplete?: boolean; isSuperAdmin?: boolean } | null | undefined,
  nextPath = "/inbox",
) {
  if (isSuperAdminSession(session)) {
    if (nextPath && nextPath !== "/inbox" && !isShopSetupPending(session)) {
      return nextPath;
    }
    return SUPER_ADMIN_HOME;
  }
  return isShopSetupPending(session) ? SHOP_SETUP_PATH : nextPath;
}

export function isShopSetupExemptPath(
  pathname: string,
  session?: { isSuperAdmin?: boolean } | null,
) {
  if (pathname === SHOP_SETUP_PATH || pathname.startsWith(`${SHOP_SETUP_PATH}/`)) {
    return true;
  }
  return isSuperAdminSession(session) && isPlatformAdminPath(pathname);
}
