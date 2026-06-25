import { describe, expect, it } from "vitest";

import {
  parseCampaignStrike,
  parseMoneyToCents,
  resolveMemberPriceCents,
} from "./membership.shared";

describe("parseMoneyToCents", () => {
  it("parses decimal strings", () => {
    expect(parseMoneyToCents("12.50")).toBe(1250);
  });

  it("returns 0 for invalid values", () => {
    expect(parseMoneyToCents("not-a-number")).toBe(0);
  });
});

describe("parseCampaignStrike", () => {
  it("returns true for boolean jsonValue", () => {
    expect(parseCampaignStrike({ jsonValue: true })).toBe(true);
  });

  it("returns true for string metafield value", () => {
    expect(parseCampaignStrike({ value: "true" })).toBe(true);
  });

  it("returns false when unset", () => {
    expect(parseCampaignStrike(null)).toBe(false);
  });
});

describe("resolveMemberPriceCents", () => {
  it("prefers variant member price over product", () => {
    expect(
      resolveMemberPriceCents(
        { amount: "10.00", currencyCode: "USD" },
        { amount: "20.00", currencyCode: "USD" },
      ),
    ).toBe(1000);
  });
});
