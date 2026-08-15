import { describe, expect, it } from "vitest";
import { buildMetaOAuthUrl, metaScopesForChannel } from "@/backend/meta-oauth";

describe("metaScopesForChannel", () => {
  it("does not request deprecated Instagram scopes", () => {
    const facebook = metaScopesForChannel("facebook");
    const instagram = metaScopesForChannel("instagram");
    for (const scopes of [facebook, instagram]) {
      expect(scopes).toContain("pages_messaging");
      expect(scopes).not.toContain("instagram_basic");
      expect(scopes).not.toContain("instagram_manage_messages");
    }
  });
});

describe("buildMetaOAuthUrl", () => {
  it("puts channel scopes into the authorize URL", () => {
    const url = new URL(
      buildMetaOAuthUrl(
        {
          appId: "app-1",
          appSecret: "secret",
          redirectUri: "https://shopinbox-production.up.railway.app/api/connect/meta/callback",
          webhookVerifyToken: "",
        },
        "state-1",
        "facebook",
      ),
    );
    expect(url.searchParams.get("scope")).toBe(metaScopesForChannel("facebook"));
    expect(url.searchParams.get("client_id")).toBe("app-1");
  });
});
