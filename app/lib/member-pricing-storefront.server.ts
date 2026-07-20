import {
  parseCampaignStrike,
  type MembershipConfig,
  type MetafieldRef,
} from "./membership.shared";

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type StorefrontProductPricing = {
  rrpCents: number;
  memberCents: number;
  campaignStrike: boolean;
};

const PRICES_BY_HANDLES_QUERY = `#graphql
  query MemberPricingByHandles(
    $query: String!
    $productNamespace: String!
    $productKey: String!
    $variantNamespace: String!
    $variantKey: String!
    $campaignNamespace: String!
    $campaignKey: String!
  ) {
    products(first: 50, query: $query) {
      nodes {
        handle
        campaign: metafield(namespace: $campaignNamespace, key: $campaignKey) {
          value
          jsonValue
        }
        memberPrice: metafield(namespace: $productNamespace, key: $productKey) {
          jsonValue
        }
        variants(first: 1) {
          nodes {
            price
            memberPrice: metafield(
              namespace: $variantNamespace
              key: $variantKey
            ) {
              jsonValue
            }
          }
        }
      }
    }
  }
`;

function parseMoneyMetafieldToCents(value: unknown): number {
  if (value == null || value === "") return 0;

  if (typeof value === "object" && value !== null) {
    const amount = (value as { amount?: string | number }).amount;
    if (amount != null && amount !== "") {
      return Math.round(Number(amount) * 100);
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{")) {
      try {
        return parseMoneyMetafieldToCents(JSON.parse(trimmed));
      } catch {
        // fall through
      }
    }
    const cleaned = trimmed.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed * 100);
    }
  }

  if (typeof value === "number") {
    return value > 1000 ? Math.round(value) : Math.round(value * 100);
  }

  return 0;
}

function buildHandleQuery(handles: string[]): string {
  return handles.map((handle) => `handle:${handle}`).join(" OR ");
}

function resolvePriceRefs(config: MembershipConfig): {
  product: MetafieldRef;
  variant: MetafieldRef;
  campaign: MetafieldRef;
} {
  if (config.metafieldSource === "linked") {
    return {
      product: config.linkedMetafields.productMemberPrice,
      variant: config.linkedMetafields.variantMemberPrice,
      campaign: config.linkedMetafields.campaign,
    };
  }

  return {
    product: { namespace: "$app", key: "member_price" },
    variant: { namespace: "$app", key: "member_price" },
    campaign: { namespace: "$app", key: "campaign" },
  };
}

export async function getStorefrontPricingByHandles(
  admin: AdminClient,
  handles: string[],
  config: MembershipConfig,
): Promise<Record<string, StorefrontProductPricing>> {
  const uniqueHandles = [...new Set(handles.map((h) => h.trim()).filter(Boolean))];
  if (uniqueHandles.length === 0) return {};

  const refs = resolvePriceRefs(config);
  const response = await admin.graphql(PRICES_BY_HANDLES_QUERY, {
    variables: {
      query: buildHandleQuery(uniqueHandles),
      productNamespace: refs.product.namespace,
      productKey: refs.product.key,
      variantNamespace: refs.variant.namespace,
      variantKey: refs.variant.key,
      campaignNamespace: refs.campaign.namespace,
      campaignKey: refs.campaign.key,
    },
  });
  const json = await response.json();

  if (json.errors?.length) {
    console.error("Member pricing GraphQL errors:", json.errors);
  }

  const nodes = json.data?.products?.nodes ?? [];
  const result: Record<string, StorefrontProductPricing> = {};

  for (const node of nodes) {
    const variant = node.variants?.nodes?.[0];
    if (!variant || !node.handle) continue;

    const variantMemberCents = parseMoneyMetafieldToCents(
      variant.memberPrice?.jsonValue,
    );
    const productMemberCents = parseMoneyMetafieldToCents(
      node.memberPrice?.jsonValue,
    );
    const memberCents =
      variantMemberCents > 0 ? variantMemberCents : productMemberCents;
    const campaignStrike = parseCampaignStrike(node.campaign);

    const priceDecimal = Number(variant.price);
    const rrpCents = Math.round(priceDecimal * 100);

    result[node.handle] = {
      rrpCents: Number.isFinite(rrpCents) ? rrpCents : 0,
      memberCents,
      campaignStrike,
    };
  }

  return result;
}
