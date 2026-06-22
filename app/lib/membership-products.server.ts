type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

const PRODUCTS_WITH_MEMBER_PRICE_QUERY = `#graphql
  query ProductsWithMemberPrice($first: Int!) {
    products(first: $first, query: "metafields.$app.member_price:*") {
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
): Promise<MemberPriceCatalogStatus> {
  try {
    const response = await admin.graphql(PRODUCTS_WITH_MEMBER_PRICE_QUERY, {
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
