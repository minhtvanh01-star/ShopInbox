import { describe, expect, it } from "vitest";
import {
  HSTS_VALUE,
  applySecurityHeaders,
  configuredPublicHost,
  httpsRedirectLocation,
  isCrossOriginPublicPath,
  isLoopbackHost,
  productionSecurityHeaders,
  requestUsesHttps,
  shouldEnforceHttps,
} from "./security-headers";

describe("shouldEnforceHttps", () => {
  it("only on production, unless FORCE_HTTPS=0", () => {
    expect(shouldEnforceHttps({ NODE_ENV: "development" })).toBe(false);
    expect(shouldEnforceHttps({ NODE_ENV: "production" })).toBe(true);
    expect(shouldEnforceHttps({ NODE_ENV: "production", FORCE_HTTPS: "0" })).toBe(false);
  });
});

describe("requestUsesHttps / isLoopbackHost", () => {
  it("prefers x-forwarded-proto", () => {
    expect(requestUsesHttps({ forwardedProto: "https, http", protocol: "http:" })).toBe(true);
    expect(requestUsesHttps({ forwardedProto: "http", protocol: "https:" })).toBe(false);
    expect(requestUsesHttps({ protocol: "https:" })).toBe(true);
  });

  it("treats localhost as loopback", () => {
    expect(isLoopbackHost("localhost:3000")).toBe(true);
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("shopinbox.example.com")).toBe(false);
  });
});

describe("httpsRedirectLocation", () => {
  it("upgrades protocol and host from the proxy", () => {
    const url = httpsRedirectLocation({
      url: "http://localhost:8080/login?next=/inbox",
      forwardedHost: "shopinbox.example.com",
      configuredHost: null,
    });
    expect(url.toString()).toBe("https://shopinbox.example.com/login?next=/inbox");
  });

  it("prefers the configured public host over X-Forwarded-Host", () => {
    const url = httpsRedirectLocation({
      url: "http://localhost:8080/login?next=/inbox",
      forwardedHost: "evil.example",
      configuredHost: "shopinbox.example.com",
    });
    expect(url.toString()).toBe("https://shopinbox.example.com/login?next=/inbox");
  });

  it("ignores malformed forwarded hosts", () => {
    const url = httpsRedirectLocation({
      url: "http://shopinbox.example.com/login",
      forwardedHost: "evil.example/phish",
      configuredHost: null,
    });
    expect(url.toString()).toBe("https://shopinbox.example.com/login");
  });
});

describe("configuredPublicHost", () => {
  it("skips localhost and invalid URLs", () => {
    expect(configuredPublicHost({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" })).toBeNull();
    expect(configuredPublicHost({ NEXT_PUBLIC_APP_URL: "https://app.shopinbox.vn" })).toBe(
      "app.shopinbox.vn",
    );
    expect(configuredPublicHost({ NEXT_PUBLIC_APP_URL: "shopinboxn2.linhgunxy.xyz" })).toBe(
      "shopinboxn2.linhgunxy.xyz",
    );
    expect(configuredPublicHost({ APP_URL: "://bad" })).toBeNull();
  });
});

describe("productionSecurityHeaders", () => {
  it("includes the production baseline", () => {
    const keys = productionSecurityHeaders().map((item) => item.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
    expect(
      productionSecurityHeaders().find((item) => item.key === "Content-Security-Policy")?.value,
    ).toMatch(/upgrade-insecure-requests/);
    expect(
      productionSecurityHeaders({ hsts: false }).some((item) => item.key === "Strict-Transport-Security"),
    ).toBe(false);
    const devCsp = productionSecurityHeaders({
      hsts: false,
      upgradeInsecureRequests: false,
      unsafeEval: true,
    }).find((item) => item.key === "Content-Security-Policy")?.value;
    expect(devCsp).not.toMatch(/upgrade-insecure-requests/);
    expect(devCsp).toMatch(/'unsafe-eval'/);
    expect(devCsp).toMatch(/ws:/);
    expect(
      productionSecurityHeaders().find((item) => item.key === "Content-Security-Policy")?.value,
    ).not.toMatch(/'unsafe-eval'/);
  });

  it("applies onto Headers", () => {
    const headers = new Headers();
    applySecurityHeaders(headers);
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Strict-Transport-Security")).toBe(HSTS_VALUE);
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });

  it("allows CORP cross-origin for the public widget", () => {
    expect(isCrossOriginPublicPath("/widget.js")).toBe(true);
    expect(isCrossOriginPublicPath("/api/webhooks/web")).toBe(true);
    expect(isCrossOriginPublicPath("/api/webhooks/web/poll")).toBe(true);
    expect(isCrossOriginPublicPath("/api/webhooks/meta")).toBe(false);
    expect(
      productionSecurityHeaders({ crossOriginResource: true }).find(
        (item) => item.key === "Cross-Origin-Resource-Policy",
      )?.value,
    ).toBe("cross-origin");
  });
});
