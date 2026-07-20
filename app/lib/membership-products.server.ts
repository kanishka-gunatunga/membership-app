import {
  parseMoneyToCents,
  type MembershipConfig,
  type MetafieldRef,
} from "./membership.shared";

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

const CATALOG_PAGE_SIZE = 50;
/** Cap scans so settings load stays bounded on large catalogs. */
const CATALOG_MAX_PRODUCTS = 500;

const MEMBER_PRICE_CATALOG_PAGE_QUERY = `#graphql
  query MemberPriceCatalogPage(
    $first: Int!
    $after: String
    $productNamespace: String!
    $productKey: String!
    $variantNamespace: String!
    $variantKey: String!
  ) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        memberPrice: metafield(namespace: $productNamespace, key: $productKey) {
          value
        }
        variants(first: 100) {
          nodes {
            memberPrice: metafield(
              namespace: $variantNamespace
              key: $variantKey
            ) {
              value
            }
          }
        }
      }
    }
  }
`;

export type MemberPriceCatalogStatus = {
  productsWithMemberPrice: number;
  sampleProductTitles: string[];
  sampleProductHandle: string | null;
};

type CatalogProductNode = {
  id?: string;
  title?: string;
  handle?: string;
  memberPrice?: { value?: string | null } | null;
  variants?: {
    nodes?: Array<{
      memberPrice?: { value?: string | null } | null;
    }>;
  } | null;
};

function productMemberPriceRef(config: MembershipConfig): MetafieldRef {
  if (config.metafieldSource === "linked") {
    return config.linkedMetafields.productMemberPrice;
  }
  return { namespace: "$app", key: "member_price" };
}

function variantMemberPriceRef(config: MembershipConfig): MetafieldRef {
  if (config.metafieldSource === "linked") {
    return config.linkedMetafields.variantMemberPrice;
  }
  return { namespace: "$app", key: "member_price" };
}

/** True when a money metafield stores a positive member price. */
export function hasMemberPriceMetafieldValue(
  value: string | null | undefined,
): boolean {
  if (!value?.trim()) return false;

  try {
    const parsed = JSON.parse(value) as { amount?: string | number };
    if (parsed && typeof parsed === "object" && parsed.amount != null) {
      return parseMoneyToCents(parsed.amount) > 0;
    }
  } catch {
    // Fall through for plain numeric strings.
  }

  return parseMoneyToCents(value) > 0;
}

function productHasMemberPrice(node: CatalogProductNode): boolean {
  if (hasMemberPriceMetafieldValue(node.memberPrice?.value)) return true;

  return (node.variants?.nodes ?? []).some((variant) =>
    hasMemberPriceMetafieldValue(variant.memberPrice?.value),
  );
}

export async function getMemberPriceCatalogStatus(
  admin: AdminClient,
  config: MembershipConfig,
): Promise<MemberPriceCatalogStatus> {
  try {
    const productRef = productMemberPriceRef(config);
    const variantRef = variantMemberPriceRef(config);

    const priced: CatalogProductNode[] = [];
    let after: string | null = null;
    let scanned = 0;
    let hasNextPage = true;

    while (hasNextPage && scanned < CATALOG_MAX_PRODUCTS) {
      const pageSize = Math.min(CATALOG_PAGE_SIZE, CATALOG_MAX_PRODUCTS - scanned);
      const response = await admin.graphql(MEMBER_PRICE_CATALOG_PAGE_QUERY, {
        variables: {
          first: pageSize,
          after,
          productNamespace: productRef.namespace,
          productKey: productRef.key,
          variantNamespace: variantRef.namespace,
          variantKey: variantRef.key,
        },
      });
      const json = await response.json();
      const connection = json.data?.products;
      const nodes: CatalogProductNode[] = connection?.nodes ?? [];

      scanned += nodes.length;
      for (const node of nodes) {
        if (productHasMemberPrice(node)) {
          priced.push(node);
        }
      }

      hasNextPage = Boolean(connection?.pageInfo?.hasNextPage);
      after = connection?.pageInfo?.endCursor ?? null;
      if (nodes.length === 0) break;
    }

    return {
      productsWithMemberPrice: priced.length,
      sampleProductTitles: priced
        .slice(0, 3)
        .map((node) => node.title)
        .filter((title): title is string => Boolean(title)),
      sampleProductHandle: priced[0]?.handle ?? null,
    };
  } catch {
    return {
      productsWithMemberPrice: 0,
      sampleProductTitles: [],
      sampleProductHandle: null,
    };
  }
}
