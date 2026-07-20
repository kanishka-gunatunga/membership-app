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

/** App-managed fields, or merchant-linked existing definitions. */
export const METAFIELD_SOURCES = ["app", "linked"] as const;
export type MetafieldSource = (typeof METAFIELD_SOURCES)[number];

export type MetafieldRef = {
  namespace: string;
  key: string;
};

export type LinkedMetafields = {
  productMemberPrice: MetafieldRef;
  variantMemberPrice: MetafieldRef;
  campaign: MetafieldRef;
};

/** Built-in Function dual-read path for the common `custom.*` setup. */
export const FUNCTION_CUSTOM_PRODUCT_MEMBER_PRICE: MetafieldRef = {
  namespace: "custom",
  key: "member_price",
};
export const FUNCTION_CUSTOM_VARIANT_MEMBER_PRICE: MetafieldRef = {
  namespace: "custom",
  key: "variant_member_price",
};
export const DEFAULT_LINKED_METAFIELDS: LinkedMetafields = {
  productMemberPrice: { namespace: "custom", key: "member_price" },
  variantMemberPrice: { namespace: "custom", key: "variant_member_price" },
  campaign: { namespace: "custom", key: "cross_rrp" },
};

export type MoneyValue = {
  amount: string;
  currencyCode: string;
};

export type MembershipConfig = {
  title: string;
  enabled: boolean;
  memberLabel: string;
  savingsLabel: string;
  metafieldSource: MetafieldSource;
  linkedMetafields: LinkedMetafields;
};

export const DEFAULT_MEMBERSHIP_CONFIG: MembershipConfig = {
  title: "MemberPro",
  enabled: true,
  memberLabel: "Member price",
  savingsLabel: "You save",
  metafieldSource: "app",
  linkedMetafields: DEFAULT_LINKED_METAFIELDS,
};

export function parseMetafieldSource(value: unknown): MetafieldSource {
  // "custom" kept for older saved configs
  if (value === "linked" || value === "custom") return "linked";
  return "app";
}

/** Parse `namespace.key` (splits on the first dot). */
export function parseMetafieldHandle(value: unknown): MetafieldRef | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const dot = trimmed.indexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) return null;
  const namespace = trimmed.slice(0, dot).trim();
  const key = trimmed.slice(dot + 1).trim();
  if (!namespace || !key) return null;
  return { namespace, key };
}

export function formatMetafieldHandle(ref: MetafieldRef): string {
  return `${ref.namespace}.${ref.key}`;
}

export function refsEqual(a: MetafieldRef, b: MetafieldRef): boolean {
  return a.namespace === b.namespace && a.key === b.key;
}

export function parseLinkedMetafields(value: unknown): LinkedMetafields {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_LINKED_METAFIELDS;
  }

  const record = value as Record<string, unknown>;

  const fromHandleOrParts = (
    handleOrRef: unknown,
    fallback: MetafieldRef,
  ): MetafieldRef => {
    if (typeof handleOrRef === "string") {
      return parseMetafieldHandle(handleOrRef) ?? fallback;
    }
    if (handleOrRef && typeof handleOrRef === "object") {
      const ref = handleOrRef as Record<string, unknown>;
      if (typeof ref.namespace === "string" && typeof ref.key === "string") {
        const namespace = ref.namespace.trim();
        const key = ref.key.trim();
        if (namespace && key) return { namespace, key };
      }
    }
    return fallback;
  };

  return {
    productMemberPrice: fromHandleOrParts(
      record.productMemberPrice,
      DEFAULT_LINKED_METAFIELDS.productMemberPrice,
    ),
    variantMemberPrice: fromHandleOrParts(
      record.variantMemberPrice,
      DEFAULT_LINKED_METAFIELDS.variantMemberPrice,
    ),
    campaign: fromHandleOrParts(
      record.campaign,
      DEFAULT_LINKED_METAFIELDS.campaign,
    ),
  };
}

/**
 * Checkout Function can only dual-read fixed `custom.*` keys (query complexity).
 * Other linked definitions are displayed live, but checkout uses app fields after sync.
 */
export function usesFunctionCustomPath(config: MembershipConfig): boolean {
  if (config.metafieldSource !== "linked") return false;
  return (
    refsEqual(
      config.linkedMetafields.productMemberPrice,
      FUNCTION_CUSTOM_PRODUCT_MEMBER_PRICE,
    ) &&
    refsEqual(
      config.linkedMetafields.variantMemberPrice,
      FUNCTION_CUSTOM_VARIANT_MEMBER_PRICE,
    )
  );
}

/** Value stored on the discount metafield for the Function. */
export function functionMetafieldSource(
  config: MembershipConfig,
): "app" | "custom" {
  return usesFunctionCustomPath(config) ? "custom" : "app";
}

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
