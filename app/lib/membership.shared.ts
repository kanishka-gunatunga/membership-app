export const MEMBER_LEVEL_PHASE1 = 1;

export const MEMBER_PRICE_METAFIELD_KEY = "member_price";

export const CAMPAIGN_METAFIELD_KEY = "campaign";

export const MEMBERSHIP_CONFIG_METAOBJECT_TYPE = "$app:membership_config";

export const MEMBERSHIP_DISCOUNT_METAFIELD_KEY = "membership_config";

export const MEMBERSHIP_DISCOUNT_TITLE = "Member Pricing";

export type MoneyValue = {
  amount: string;
  currencyCode: string;
};

export type MembershipConfig = {
  title: string;
  enabled: boolean;
  memberLabel: string;
  savingsLabel: string;
};

export const DEFAULT_MEMBERSHIP_CONFIG: MembershipConfig = {
  title: "Default membership",
  enabled: true,
  memberLabel: "Member price",
  savingsLabel: "You save",
};

export function parseMoneyToCents(amount: string | number): number {
  const value = typeof amount === "number" ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function centsToDecimalAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function resolveMemberPriceCents(
  variantMemberPrice: MoneyValue | null | undefined,
  productMemberPrice: MoneyValue | null | undefined,
): number | null {
  const source = variantMemberPrice ?? productMemberPrice;
  if (!source?.amount) return null;

  const cents = parseMoneyToCents(source.amount);
  return cents > 0 ? cents : null;
}
