import {
  MEMBER_LEVEL_PHASE1,
  MEMBERSHIP_DISCOUNT_TITLES,
  parseMoneyToCents,
} from "./membership.shared";
import db from "../db.server";

export type OrderPaidWebhookPayload = {
  id: number | string;
  name?: string;
  currency?: string;
  customer?: { id?: number | string } | null;
  subtotal_price?: string;
  total_discounts?: string;
  line_items?: Array<unknown>;
  discount_applications?: Array<{ title?: string }>;
};

export function isMemberPricingOrder(payload: OrderPaidWebhookPayload): boolean {
  const applications = payload.discount_applications ?? [];
  return applications.some(
    (entry) =>
      entry.title != null &&
      MEMBERSHIP_DISCOUNT_TITLES.includes(
        entry.title as (typeof MEMBERSHIP_DISCOUNT_TITLES)[number],
      ),
  );
}

export async function persistMemberOrderSnapshot(
  shop: string,
  payload: OrderPaidWebhookPayload,
): Promise<void> {
  if (!isMemberPricingOrder(payload)) return;

  const orderId = String(payload.id);
  const discountCents = parseMoneyToCents(payload.total_discounts ?? "0");
  if (discountCents <= 0) return;

  const subtotalCents = parseMoneyToCents(payload.subtotal_price ?? "0");
  const customerId =
    payload.customer?.id != null ? String(payload.customer.id) : null;

  await db.memberOrderSnapshot.upsert({
    where: {
      shop_orderId: {
        shop,
        orderId,
      },
    },
    create: {
      shop,
      orderId,
      orderName: payload.name ?? orderId,
      customerId,
      memberLevel: MEMBER_LEVEL_PHASE1,
      subtotalCents,
      discountCents,
      currencyCode: payload.currency ?? "USD",
      lineItemCount: payload.line_items?.length ?? 0,
    },
    update: {
      orderName: payload.name ?? orderId,
      customerId,
      subtotalCents,
      discountCents,
      currencyCode: payload.currency ?? "USD",
      lineItemCount: payload.line_items?.length ?? 0,
    },
  });
}

export async function deleteMemberOrderSnapshotsForShop(shop: string): Promise<void> {
  await db.memberOrderSnapshot.deleteMany({ where: { shop } });
}
