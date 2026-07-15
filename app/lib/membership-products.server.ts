import {
  parseMetafieldSource,
  type MetafieldSource,
} from "./membership.shared";

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

const PRODUCTS_WITH_APP_MEMBER_PRICE_QUERY = `#graphql
  query ProductsWithAppMemberPrice($first: Int!) {
    products(first: $first, query: "metafields.$app.member_price:*") {
      nodes {
        id
        title
        handle
      }
    }
  }
`;

const PRODUCTS_WITH_CUSTOM_MEMBER_PRICE_QUERY = `#graphql
  query ProductsWithCustomMemberPrice($first: Int!) {
    products(first: $first, query: "metafields.custom.member_price:*") {
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

export async function getMemberPriceCatalogStatus(
  admin: AdminClient,
  metafieldSource: MetafieldSource = "app",
): Promise<MemberPriceCatalogStatus> {
  try {
    const source = parseMetafieldSource(metafieldSource);
    const query =
      source === "custom"
        ? PRODUCTS_WITH_CUSTOM_MEMBER_PRICE_QUERY
        : PRODUCTS_WITH_APP_MEMBER_PRICE_QUERY;
    const response = await admin.graphql(query, {
      variables: { first: 50 },
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
