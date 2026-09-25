export function pickLatestAccount<T extends { connectedAt?: Date | null; lastWebhookAt?: Date | null }>(
  rows: T[],
) {
  if (rows.length <= 1) return rows[0] ?? null;
  return [...rows].sort((a, b) => {
    const aTs = a.connectedAt?.getTime() ?? a.lastWebhookAt?.getTime() ?? 0;
    const bTs = b.connectedAt?.getTime() ?? b.lastWebhookAt?.getTime() ?? 0;
    return bTs - aTs;
  })[0]!;
}

export function pickOwnedChannelAccount<
  T extends { shopId: string; connectedAt?: Date | null; lastWebhookAt?: Date | null },
>(rows: T[]) {
  if (rows.length === 0) return null;
  const shopIds = new Set(rows.map((row) => row.shopId));
  if (shopIds.size > 1) {
    console.warn("[findChannelAccount] nhiều shop cùng Page/OA — bỏ qua để tránh nhầm tenant", {
      count: rows.length,
    });
    return null;
  }
  return pickLatestAccount(rows);
}
