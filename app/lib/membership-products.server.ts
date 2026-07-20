import type { MembershipConfig, MetafieldRef } from "./membership.shared";

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

const PRODUCTS_WITH_MEMBER_PRICE_QUERY = `#graphql
  query ProductsWithMemberPrice($first: Int!, $query: String!) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
        handle
      }
    }
  }
`;

export type MemberPriceCatalogStatus = {
  productsWithMemberPrice: number;
  sampleProductTitles: string[];
  sampleProductHandle: string | null;
};

function productMemberPriceRef(config: MembershipConfig): MetafieldRef {
  if (config.metafieldSource === "linked") {
    return config.linkedMetafields.productMemberPrice;
  }
  return { namespace: "$app", key: "member_price" };
}

export async function getMemberPriceCatalogStatus(
  admin: AdminClient,
  config: MembershipConfig,
): Promise<MemberPriceCatalogStatus> {
  try {
    const ref = productMemberPriceRef(config);
    const searchQuery = `metafields.${ref.namespace}.${ref.key}:*`;
    const response = await admin.graphql(PRODUCTS_WITH_MEMBER_PRICE_QUERY, {
      variables: { first: 50, query: searchQuery },
    });
    const json = await response.json();
    const nodes = json.data?.products?.nodes ?? [];

    return {
      productsWithMemberPrice: nodes.length,
      sampleProductTitles: nodes
        .slice(0, 3)
        .map((node: { title?: string }) => node.title)
        .filter(Boolean),
      sampleProductHandle: nodes[0]?.handle ?? null,
    };
  } catch {
    return {
      productsWithMemberPrice: 0,
      sampleProductTitles: [],
      sampleProductHandle: null,
    };
  }
}
