export const MEMBER_LEVEL_PHASE1 = 1;

export const MEMBER_PRICE_METAFIELD_KEY = "member_price";

export const CAMPAIGN_METAFIELD_KEY = "campaign";

export const MEMBERSHIP_CONFIG_METAOBJECT_TYPE = "$app:membership_config";

export const MEMBERSHIP_DISCOUNT_METAFIELD_KEY = "membership_config";

export const MEMBERSHIP_DISCOUNT_TITLE = "MemberPro";

/** Previous checkout discount title — kept for existing installs. */
export const LEGACY_MEMBERSHIP_DISCOUNT_TITLE = "Member Pricing";

export const MEMBERSHIP_DISCOUNT_TITLES = [
  MEMBERSHIP_DISCOUNT_TITLE,
  LEGACY_MEMBERSHIP_DISCOUNT_TITLE,
] as const;

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
  title: "MemberPro",
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

export function parseCampaignStrike(
  metafield: { jsonValue?: unknown; value?: string | null } | null | undefined,
): boolean {
  if (!metafield) return false;
  if (metafield.jsonValue === true || metafield.jsonValue === "true") return true;
  if (metafield.value === "true") return true;
  return false;
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
