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
import { getPendingMetaPages } from "@/app/(app)/settings/actions";
import { getShopContext, getChannelAccounts } from "@/lib/queries";
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";
import { PERMISSION_CODES } from "@/lib/rbac-catalog";

type SettingsPageProps = {
  searchParams: Promise<{
    oauth_success?: string;
    oauth_error?: string;
    oauth_message?: string;
    oauth_pick?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const [channels, shop, pendingMetaPages] = await Promise.all([
    getChannelAccounts(),
    getShopContext(),
    getPendingMetaPages(),
  ]);

  const metaConfig = getMetaOAuthConfig();
  const zaloConfig = getZaloOAuthConfig();
  const metaMissingEnvVars = listMissingMetaOAuthEnvVars();
  const zaloMissingEnvVars = listMissingZaloOAuthEnvVars();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SettingsWorkspace
        channels={channels}
        canConnect={shop.permissions.includes(PERMISSION_CODES.channelsConnect)}
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
