import { afterEach, describe, expect, it } from "vitest";

import {
  BILLING_CALLBACK_PATH,
  BILLING_PAGE_PATH,
  isBillingExemptPath,
  parseBillingPageStatus,
} from "./billing.shared";
import {
  billingCallbackOutcome,
  buildSecureAppUrl,
  shouldRequireBilling,
} from "./billing.server";

describe("shouldRequireBilling", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("requires billing in production by default", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
    };
    delete process.env.SHOPIFY_BILLING_SKIP;
    delete process.env.SHOPIFY_BILLING_FORCE;

    expect(shouldRequireBilling()).toBe(true);
  });

  it("skips billing in development by default", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
    };
    delete process.env.SHOPIFY_BILLING_FORCE;

    expect(shouldRequireBilling()).toBe(false);
  });

  it("throws when SHOPIFY_BILLING_SKIP is set in production", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      SHOPIFY_BILLING_SKIP: "true",
    };

    expect(() => shouldRequireBilling()).toThrow(/cannot be enabled in production/i);
  });
});

describe("buildSecureAppUrl", () => {
  it("upgrades non-local http URLs to https", () => {
    const request = new Request("http://app.example.com/app");
    expect(buildSecureAppUrl(request, "/app/billing/callback")).toBe(
      "https://app.example.com/app/billing/callback",
    );
  });

  it("keeps localhost on http", () => {
    const request = new Request("http://localhost:3000/app");
    expect(buildSecureAppUrl(request, "/app/billing/callback")).toBe(
      "http://localhost:3000/app/billing/callback",
    );
  });
});

describe("isBillingExemptPath", () => {
  it("exempts billing pages from the auto-charge gate", () => {
    expect(isBillingExemptPath(BILLING_PAGE_PATH)).toBe(true);
    expect(isBillingExemptPath(BILLING_CALLBACK_PATH)).toBe(true);
    expect(isBillingExemptPath("/app")).toBe(false);
  });
});

describe("parseBillingPageStatus", () => {
  it("accepts known status values", () => {
    expect(parseBillingPageStatus("declined")).toBe("declined");
    expect(parseBillingPageStatus("confirming")).toBe("confirming");
  });

  it("rejects unknown values", () => {
    expect(parseBillingPageStatus("unknown")).toBeNull();
    expect(parseBillingPageStatus(null)).toBeNull();
  });
});

describe("billingCallbackOutcome", () => {
  it("detects accepted charges via charge_id", () => {
    const request = new Request(
      "https://app.example.com/app/billing/callback?charge_id=123",
    );
    expect(billingCallbackOutcome(request)).toEqual({ chargeAccepted: true });
  });

  it("treats missing charge_id as declined", () => {
    const request = new Request(
      "https://app.example.com/app/billing/callback",
    );
    expect(billingCallbackOutcome(request)).toEqual({ chargeAccepted: false });
  });
});
