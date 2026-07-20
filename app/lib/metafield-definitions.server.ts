type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type MetafieldDefinitionOption = {
  /** `namespace.key` */
  handle: string;
  namespace: string;
  key: string;
  name: string;
  type: string;
  ownerType: "PRODUCT" | "PRODUCTVARIANT";
};

const DEFINITIONS_QUERY = `#graphql
  query MembershipMetafieldDefinitions($ownerType: MetafieldOwnerType!, $first: Int!) {
    metafieldDefinitions(ownerType: $ownerType, first: $first) {
      nodes {
        name
        namespace
        key
        type {
          name
        }
      }
    }
  }
`;

function isMoneyType(typeName: string): boolean {
  return typeName === "money";
}

function isBooleanType(typeName: string): boolean {
  return typeName === "boolean";
}

async function loadDefinitions(
  admin: AdminClient,
  ownerType: "PRODUCT" | "PRODUCTVARIANT",
): Promise<MetafieldDefinitionOption[]> {
  try {
    const response = await admin.graphql(DEFINITIONS_QUERY, {
      variables: { ownerType, first: 100 },
    });
    const json = await response.json();
    const nodes = json.data?.metafieldDefinitions?.nodes ?? [];

    return nodes
      .map(
        (node: {
          name?: string;
          namespace?: string;
          key?: string;
          type?: { name?: string };
        }) => {
          const namespace = node.namespace?.trim() ?? "";
          const key = node.key?.trim() ?? "";
          const type = node.type?.name ?? "";
          // Prefer merchant-owned definitions for linking (not app-reserved).
          if (
            !namespace ||
            !key ||
            namespace === "$app" ||
            namespace === "app" ||
            namespace.startsWith("app--")
          ) {
            return null;
          }
          return {
            handle: `${namespace}.${key}`,
            namespace,
            key,
            name: node.name?.trim() || key,
            type,
            ownerType,
          } satisfies MetafieldDefinitionOption;
        },
      )
      .filter(Boolean) as MetafieldDefinitionOption[];
  } catch {
    return [];
  }
}

export type LinkableMetafieldOptions = {
  productMoney: MetafieldDefinitionOption[];
  variantMoney: MetafieldDefinitionOption[];
  productBoolean: MetafieldDefinitionOption[];
};

export async function getLinkableMetafieldOptions(
  admin: AdminClient,
): Promise<LinkableMetafieldOptions> {
  const [productDefs, variantDefs] = await Promise.all([
    loadDefinitions(admin, "PRODUCT"),
    loadDefinitions(admin, "PRODUCTVARIANT"),
  ]);

  return {
    productMoney: productDefs.filter((def) => isMoneyType(def.type)),
    variantMoney: variantDefs.filter((def) => isMoneyType(def.type)),
    productBoolean: productDefs.filter((def) => isBooleanType(def.type)),
  };
}
