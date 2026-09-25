import { createHash, randomBytes } from "node:crypto";
import type { ZaloOAuthConfig } from "@/backend/oauth-config";

export function generateZaloPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

type ZaloTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string | number;
  error?: number;
  error_name?: string;
  error_description?: string;
};

type ZaloOaResponse = {
  data?: {
    id?: string;
    name?: string;
    oa_id?: string;
  };
  error?: number;
  message?: string;
};

function readZaloError(data: ZaloTokenResponse | ZaloOaResponse) {
  if ("error_description" in data && data.error_description) {
    return data.error_description;
  }
  if ("message" in data && data.message) {
    return data.message;
  }
  if ("error_name" in data && data.error_name) {
    return data.error_name;
  }
  return "Zalo API lỗi";
}

export function buildZaloOAuthUrl(
  config: ZaloOAuthConfig,
  state: string,
  codeChallenge?: string,
) {
  const url = new URL("https://oauth.zaloapp.com/v4/oa/permission");
  url.searchParams.set("app_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  if (codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

export async function exchangeZaloCode(
  config: ZaloOAuthConfig,
  code: string,
  codeVerifier?: string | null,
) {
  const body = new URLSearchParams({
    app_id: config.appId,
    code,
    grant_type: "authorization_code",
  });
  if (codeVerifier) {
    body.set("code_verifier", codeVerifier);
  }

  const response = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: config.appSecret,
    },
    body: body.toString(),
  });

  const data = (await response.json()) as ZaloTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(readZaloError(data));
  }

  const expiresIn =
    typeof data.expires_in === "string" ? Number.parseInt(data.expires_in, 10) : data.expires_in;

  const expiresAt = new Date(
    Date.now() +
      (typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0
        ? expiresIn * 1000
        : 25 * 60 * 60 * 1000),
  );

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt,
  };
}

export async function fetchZaloOaInfo(accessToken: string) {
  const url = new URL("https://openapi.zalo.me/v2.0/oa/getoa");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url.toString());
  const data = (await response.json()) as ZaloOaResponse;

  if (!response.ok || data.error) {
    throw new Error(readZaloError(data));
  }

  const oaId = data.data?.oa_id ?? data.data?.id ?? "";
  const name = data.data?.name ?? "Zalo OA";

  if (!oaId) {
    throw new Error("Không lấy được OA ID từ Zalo");
  }

  return { oaId, name };
}

export async function refreshZaloAccessToken(
  config: ZaloOAuthConfig,
  refreshToken: string,
) {
  const body = new URLSearchParams({
    app_id: config.appId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: config.appSecret,
    },
    body: body.toString(),
  });

  const data = (await response.json()) as ZaloTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(readZaloError(data));
  }

  const expiresIn =
    typeof data.expires_in === "string" ? Number.parseInt(data.expires_in, 10) : data.expires_in;

  const expiresAt = new Date(
    Date.now() +
      (typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0
        ? expiresIn * 1000
        : 25 * 60 * 60 * 1000),
  );

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt,
  };
}

type ZaloSendResponse = {
  data?: { message_id?: string; msg_id?: string };
  error?: number;
  message?: string;
};

/** Gửi tin CS từ OA tới user (Zalo Open API). */
export async function sendZaloOaMessage(input: {
  accessToken: string;
  recipientId: string;
  text: string;
}) {
  const url = new URL("https://openapi.zalo.me/v3.0/oa/message/cs");

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: input.accessToken,
    },
    body: JSON.stringify({
      recipient: { user_id: input.recipientId },
      message: { text: input.text },
    }),
  });

  const data = (await response.json()) as ZaloSendResponse;
  if (!response.ok || (typeof data.error === "number" && data.error !== 0)) {
    throw new Error(readZaloError(data));
  }

  const externalMessageId = data.data?.message_id ?? data.data?.msg_id;
  if (!externalMessageId) {
    throw new Error(data.message ?? "Zalo không trả về message_id");
  }

  return { externalMessageId };
}
