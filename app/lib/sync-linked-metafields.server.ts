import {
  CAMPAIGN_METAFIELD_KEY,
  MEMBER_PRICE_METAFIELD_KEY,
  type MembershipConfig,
  usesFunctionCustomPath,
} from "./membership.shared";

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

const PRODUCTS_WITH_LINKED_QUERY = `#graphql
  query LinkedMetafieldProductsPage(
    $first: Int!
    $cursor: String
    $productNamespace: String!
    $productKey: String!
    $variantNamespace: String!
    $variantKey: String!
    $campaignNamespace: String!
    $campaignKey: String!
  ) {
    products(first: $first, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        memberPrice: metafield(namespace: $productNamespace, key: $productKey) {
          type
          value
        }
        campaign: metafield(
          namespace: $campaignNamespace
          key: $campaignKey
        ) {
          type
          value
        }
        variants(first: 100) {
          nodes {
            id
            memberPrice: metafield(
              namespace: $variantNamespace
              key: $variantKey
            ) {
              type
              value
            }
          }
        }
      }
    }
  }
`;

const METAFIELDS_SET = `#graphql
  mutation SyncLinkedMemberPrices($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors {
        message
      }
    }
  }
`;

type MetafieldNode = {
  type?: string;
  value?: string | null;
} | null;

/**
 * Copies linked merchant metafields into app-owned `$app` fields so checkout
 * can apply member prices when the Function cannot read arbitrary namespaces.
 * Skipped when linked fields already match the Function's built-in custom path.
 */
export async function syncLinkedMetafieldsToApp(
  admin: AdminClient,
  config: MembershipConfig,
): Promise<{ synced: number }> {
  if (config.metafieldSource !== "linked") {
    return { synced: 0 };
  }
  if (usesFunctionCustomPath(config)) {
    return { synced: 0 };
  }

  const linked = config.linkedMetafields;
  let cursor: string | null = null;
  let synced = 0;
  const batch: Array<{
    ownerId: string;
    namespace: string;
    key: string;
    type: string;
    value: string;
  }> = [];

  const flush = async () => {
    while (batch.length > 0) {
      const chunk = batch.splice(0, 25);
      const response = await admin.graphql(METAFIELDS_SET, {
        variables: { metafields: chunk },
      });
      const json = await response.json();
      const errors = json.data?.metafieldsSet?.userErrors ?? [];
      if (errors.length > 0) {
        throw new Error(errors.map((e: { message: string }) => e.message).join("; "));
      }
      synced += chunk.length;
    }
  };

  for (;;) {
    const response = await admin.graphql(PRODUCTS_WITH_LINKED_QUERY, {
      variables: {
        first: 25,
        cursor,
        productNamespace: linked.productMemberPrice.namespace,
        productKey: linked.productMemberPrice.key,
        variantNamespace: linked.variantMemberPrice.namespace,
        variantKey: linked.variantMemberPrice.key,
        campaignNamespace: linked.campaign.namespace,
        campaignKey: linked.campaign.key,
      },
    });
    const json = await response.json();
    if (json.errors?.length) {
      throw new Error(
        json.errors.map((e: { message: string }) => e.message).join("; "),
      );
    }

    const connection = json.data?.products;
    const nodes = connection?.nodes ?? [];

    for (const product of nodes) {
      const productPrice = product.memberPrice as MetafieldNode;
      if (productPrice?.value) {
        batch.push({
          ownerId: product.id,
          namespace: "$app",
          key: MEMBER_PRICE_METAFIELD_KEY,
          type: productPrice.type || "money",
          value: productPrice.value,
        });
      }

      const campaign = product.campaign as MetafieldNode;
      if (campaign?.value != null && campaign.value !== "") {
        batch.push({
          ownerId: product.id,
          namespace: "$app",
          key: CAMPAIGN_METAFIELD_KEY,
          type: campaign.type || "boolean",
          value: campaign.value,
        });
      }

      for (const variant of product.variants?.nodes ?? []) {
        const variantPrice = variant.memberPrice as MetafieldNode;
        if (variantPrice?.value) {
          batch.push({
            ownerId: variant.id,
            namespace: "$app",
            key: MEMBER_PRICE_METAFIELD_KEY,
            type: variantPrice.type || "money",
            value: variantPrice.value,
          });
        }
      }
    }

    if (batch.length >= 25) {
      await flush();
    }

    if (!connection?.pageInfo?.hasNextPage) break;
    cursor = connection.pageInfo.endCursor;
  }

  await flush();
  return { synced };
}
