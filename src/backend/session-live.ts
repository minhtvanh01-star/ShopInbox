export function sessionVersionOf(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function isLiveStaffSession(
  payload: { staffId: string; shopId: string; sessionVersion?: number },
  staff: {
    id: string;
    shopId: string;
    isActive: boolean;
    sessionVersion: number;
  } | null,
) {
  if (!staff || !staff.isActive) return false;
  if (staff.id !== payload.staffId || staff.shopId !== payload.shopId) return false;
  return sessionVersionOf(payload.sessionVersion) === sessionVersionOf(staff.sessionVersion);
}
