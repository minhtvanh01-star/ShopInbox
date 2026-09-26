import {
  getMetaOAuthConfig,
  getMetaOAuthRedirectUri,
  getMetaWebhookUrl,
  getZaloOAuthConfig,
  getZaloOAuthRedirectUri,
  getZaloWebhookUrl,
  listMissingMetaOAuthEnvVars,
  listMissingZaloOAuthEnvVars,
} from "@/backend/oauth-config";
import { listQuickReplies } from "@/backend/quick-reply";
import { listAutoReplyRules } from "@/backend/auto-reply";
import { ensureDefaultChecklistTemplates } from "@/backend/order-checklist";
import { getPendingMetaPages } from "@/app/(app)/settings/actions";
import { getShopContext, getChannelAccounts } from "@/lib/queries";
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";
import { requireSession } from "@/backend/auth";
import { hasPermission } from "@/backend/rbac";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";
import { redirect } from "next/navigation";

type SettingsPageProps = {
  searchParams: Promise<{
    oauth_success?: string;
    oauth_error?: string;
    oauth_message?: string;
    oauth_pick?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await requireSession();
  const canOpen =
    (await hasPermission(session, PERMISSION_CODES.settingsUpdate)) ||
    (await hasPermission(session, PERMISSION_CODES.channelsConnect));
  if (!canOpen) {
    redirect("/settings/profile");
  }

  const params = await searchParams;
  const [channels, shop, pendingMetaPages] = await Promise.all([
    getChannelAccounts(),
    getShopContext(),
    getPendingMetaPages(),
  ]);
  const quickReplyRows = await listQuickReplies(shop.shopId);
  const autoReplyRows = await listAutoReplyRules(shop.shopId);
  const checklistRows = shop.permissions.includes(PERMISSION_CODES.settingsUpdate)
    ? await ensureDefaultChecklistTemplates(shop.shopId)
    : [];

  const metaConfig = getMetaOAuthConfig();
  const zaloConfig = getZaloOAuthConfig();
  const metaMissingEnvVars = listMissingMetaOAuthEnvVars();
  const zaloMissingEnvVars = listMissingZaloOAuthEnvVars();

  const quickReplies = quickReplyRows.map((row) => ({
    id: row.id,
    title: row.title,
    text: row.text,
  }));

  const autoReplyRules = autoReplyRows.map((row) => ({
    id: row.id,
    enabled: row.enabled,
    kind: row.kind,
    keywords: row.keywords,
    replyText: row.replyText,
    openMinute: row.openMinute,
    closeMinute: row.closeMinute,
    cooldownMinutes: row.cooldownMinutes,
  }));

  const checklistTemplates = checklistRows.map((row) => ({
    id: row.id,
    label: row.label,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SettingsWorkspace
        channels={channels}
        canConnect={shop.permissions.includes(PERMISSION_CODES.channelsConnect)}
        canUpdateSettings={shop.permissions.includes(PERMISSION_CODES.settingsUpdate)}
        shopName={shop.shopName}
        replyClaimTtlMinutes={shop.replyClaimTtlMinutes}
        maxUsersPerShop={shop.maxUsersPerShop}
        quickReplies={quickReplies}
        autoReplyRules={autoReplyRules}
        checklistTemplates={checklistTemplates}
        metaOAuthConfigured={Boolean(metaConfig)}
        zaloOAuthConfigured={Boolean(zaloConfig)}
        metaMissingEnvVars={metaMissingEnvVars}
        zaloMissingEnvVars={zaloMissingEnvVars}
        metaOAuthRedirectUri={getMetaOAuthRedirectUri()}
        zaloOAuthRedirectUri={getZaloOAuthRedirectUri()}
        metaWebhookUrl={getMetaWebhookUrl()}
        zaloWebhookUrl={getZaloWebhookUrl()}
        metaWebhookVerifyToken={
          shop.permissions.includes(PERMISSION_CODES.channelsConnect)
            ? (metaConfig?.webhookVerifyToken ?? process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ?? "")
            : ""
        }
        pendingMetaPages={pendingMetaPages}
        oauthFlash={{
          success: params.oauth_success,
          error: params.oauth_error,
          errorMessage: params.oauth_message,
          pickChannel: params.oauth_pick,
        }}
      />
    </div>
  );
}
