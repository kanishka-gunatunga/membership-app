import { describe, expect, it } from "vitest";

import { hasMemberPriceMetafieldValue } from "./membership-products.server";

describe("hasMemberPriceMetafieldValue", () => {
  it("accepts money JSON with a positive amount", () => {
    expect(
      hasMemberPriceMetafieldValue(
        JSON.stringify({ amount: "12.50", currency_code: "USD" }),
      ),
    ).toBe(true);
  });

  it("rejects empty, zero, and invalid values", () => {
    expect(hasMemberPriceMetafieldValue(null)).toBe(false);
    expect(hasMemberPriceMetafieldValue("")).toBe(false);
    expect(
      hasMemberPriceMetafieldValue(
        JSON.stringify({ amount: "0", currency_code: "USD" }),
      ),
    ).toBe(false);
    expect(hasMemberPriceMetafieldValue("not-money")).toBe(false);
  });
});
