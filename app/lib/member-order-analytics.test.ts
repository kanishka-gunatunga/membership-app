import { describe, expect, it } from "vitest";

import {
  isMemberPricingOrder,
  type OrderPaidWebhookPayload,
} from "./member-order-analytics.server";
import { MEMBERSHIP_DISCOUNT_TITLE } from "./membership.shared";

describe("isMemberPricingOrder", () => {
  it("detects member pricing discount applications", () => {
    const payload: OrderPaidWebhookPayload = {
      id: 1,
      discount_applications: [{ title: MEMBERSHIP_DISCOUNT_TITLE }],
    };

    expect(isMemberPricingOrder(payload)).toBe(true);
  });

  it("ignores unrelated discounts", () => {
    const payload: OrderPaidWebhookPayload = {
      id: 1,
      discount_applications: [{ title: "Summer sale" }],
    };

    expect(isMemberPricingOrder(payload)).toBe(false);
  });
});
