import { describe, expect, it } from "vitest";

import {
  DEFAULT_LINKED_METAFIELDS,
  formatMetafieldHandle,
  functionMetafieldSource,
  parseCampaignStrike,
  parseLinkedMetafields,
  parseMetafieldHandle,
  parseMetafieldSource,
  parseMoneyToCents,
  resolveMemberPriceCents,
  usesFunctionCustomPath,
  type MembershipConfig,
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

describe("parseMetafieldSource", () => {
  it("accepts linked and legacy custom", () => {
    expect(parseMetafieldSource("linked")).toBe("linked");
    expect(parseMetafieldSource("custom")).toBe("linked");
  });

  it("defaults to app for unknown values", () => {
    expect(parseMetafieldSource("other")).toBe("app");
    expect(parseMetafieldSource(undefined)).toBe("app");
  });
});

describe("parseMetafieldHandle", () => {
  it("parses namespace.key", () => {
    expect(parseMetafieldHandle("custom.member_price")).toEqual({
      namespace: "custom",
      key: "member_price",
    });
  });

  it("rejects invalid handles", () => {
    expect(parseMetafieldHandle("nodot")).toBeNull();
    expect(parseMetafieldHandle(".key")).toBeNull();
  });
});

describe("linked metafield helpers", () => {
  const linkedConfig: MembershipConfig = {
    title: "MemberPro",
    enabled: true,
    memberLabel: "Member price",
    savingsLabel: "You save",
    metafieldSource: "linked",
    linkedMetafields: DEFAULT_LINKED_METAFIELDS,
  };

  it("detects the Function custom path", () => {
    expect(usesFunctionCustomPath(linkedConfig)).toBe(true);
    expect(functionMetafieldSource(linkedConfig)).toBe("custom");
  });

  it("falls back to app path for other linked handles", () => {
    const other = {
      ...linkedConfig,
      linkedMetafields: {
        ...DEFAULT_LINKED_METAFIELDS,
        productMemberPrice: { namespace: "acme", key: "vip_price" },
      },
    };
    expect(usesFunctionCustomPath(other)).toBe(false);
    expect(functionMetafieldSource(other)).toBe("app");
  });

  it("formats and parses linked metafield records", () => {
    expect(
      formatMetafieldHandle(DEFAULT_LINKED_METAFIELDS.productMemberPrice),
    ).toBe("custom.member_price");
    expect(
      parseLinkedMetafields({
        productMemberPrice: "acme.vip_price",
      }).productMemberPrice,
    ).toEqual({ namespace: "acme", key: "vip_price" });
  });
});
