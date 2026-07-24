import type { authenticate } from "../shopify.server";
import {
  DEFAULT_MEMBERSHIP_CONFIG,
  MEMBERSHIP_CONFIG_METAOBJECT_TYPE,
  STOREFRONT_CONFIG_METAFIELD_KEY,
  formatMetafieldHandle,
  parseLinkedMetafields,
  parseMetafieldHandle,
  parseMetafieldSource,
  storefrontConfigJson,
  type MembershipConfig,
} from "./membership.shared";

type AdminGraphQLClient = Awaited<
  ReturnType<typeof authenticate.admin>
>["admin"];

const MEMBERSHIP_CONFIG_HANDLE = "default";

const DEFINITION_BY_TYPE_QUERY = `#graphql
  query MembershipConfigDefinition {
    metaobjectDefinitionByType(type: "${MEMBERSHIP_CONFIG_METAOBJECT_TYPE}") {
      id
    }
  }
`;

const CREATE_DEFINITION_MUTATION = `#graphql
  mutation CreateMembershipConfigDefinition(
    $definition: MetaobjectDefinitionCreateInput!
  ) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition {
        id
        type
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const LOAD_CONFIG_QUERY = `#graphql
  query LoadMembershipConfig {
    metaobjectByHandle(handle: {
      type: "${MEMBERSHIP_CONFIG_METAOBJECT_TYPE}",
      handle: "${MEMBERSHIP_CONFIG_HANDLE}"
    }) {
      title: field(key: "title") { value }
      enabled: field(key: "enabled") { value }
      memberLabel: field(key: "member_label") { value }
      savingsLabel: field(key: "savings_label") { value }
      metafieldSource: field(key: "metafield_source") { value }
      linkedProductMemberPrice: field(key: "linked_product_member_price") { value }
      linkedVariantMemberPrice: field(key: "linked_variant_member_price") { value }
      linkedCampaign: field(key: "linked_campaign") { value }
    }
  }
`;

const SHOP_ID_QUERY = `#graphql
  query ShopId {
    shop {
      id
    }
  }
`;

const STOREFRONT_CONFIG_SET_MUTATION = `#graphql
  mutation SaveStorefrontConfig($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPSERT_CONFIG_MUTATION = `#graphql
  mutation UpsertMembershipConfig($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
    metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
      metaobject {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type GraphqlPayload = {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
};

function isMissingMetaobjectScopeError(message: string): boolean {
  return (
    message.includes("read_metaobjects") ||
    message.includes("write_metaobjects") ||
    message.includes("write_metaobject_definitions")
  );
}

function assertGraphqlOk(payload: GraphqlPayload, context: string): void {
  if (payload.errors?.length) {
    throw new Error(
      `${context}: ${payload.errors.map((error) => error.message).join("; ")}`,
    );
  }
}

function parseConfig(node: Record<string, unknown> | null | undefined): MembershipConfig {
  if (!node) return DEFAULT_MEMBERSHIP_CONFIG;

  const readField = (key: string) =>
    (node[key] as { value?: string } | undefined)?.value;

  const linkedMetafields = parseLinkedMetafields({
    productMemberPrice:
      parseMetafieldHandle(readField("linkedProductMemberPrice")) ??
      DEFAULT_MEMBERSHIP_CONFIG.linkedMetafields.productMemberPrice,
    variantMemberPrice:
      parseMetafieldHandle(readField("linkedVariantMemberPrice")) ??
      DEFAULT_MEMBERSHIP_CONFIG.linkedMetafields.variantMemberPrice,
    campaign:
      parseMetafieldHandle(readField("linkedCampaign")) ??
      DEFAULT_MEMBERSHIP_CONFIG.linkedMetafields.campaign,
  });

  return {
    title: readField("title") || DEFAULT_MEMBERSHIP_CONFIG.title,
    enabled: readField("enabled") !== "false",
    memberLabel: readField("memberLabel") || DEFAULT_MEMBERSHIP_CONFIG.memberLabel,
    savingsLabel:
      readField("savingsLabel") || DEFAULT_MEMBERSHIP_CONFIG.savingsLabel,
    metafieldSource: parseMetafieldSource(readField("metafieldSource")),
    linkedMetafields,
  };
}

export async function loadMembershipConfig(
  admin: AdminGraphQLClient,
): Promise<MembershipConfig> {
  try {
    const response = await admin.graphql(LOAD_CONFIG_QUERY);
    const payload = (await response.json()) as GraphqlPayload;
    assertGraphqlOk(payload, "Load membership config");

    const node = payload.data?.metaobjectByHandle as Record<string, unknown> | null;
    return parseConfig(node);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (isMissingMetaobjectScopeError(message)) {
      return DEFAULT_MEMBERSHIP_CONFIG;
    }
    throw error;
  }
}

function isMissingDefinitionError(message: string): boolean {
  return (
    message.includes("No metaobject definition exists") ||
    (message.includes("metaobject definition") &&
      message.includes("does not exist"))
  );
}

async function ensureMembershipConfigDefinition(
  admin: AdminGraphQLClient,
): Promise<void> {
  const checkResponse = await admin.graphql(DEFINITION_BY_TYPE_QUERY);
  const checkPayload = (await checkResponse.json()) as GraphqlPayload;
  assertGraphqlOk(checkPayload, "Load membership config definition");

  if (
    (checkPayload.data?.metaobjectDefinitionByType as { id?: string } | null)
      ?.id
  ) {
    return;
  }

  const response = await admin.graphql(CREATE_DEFINITION_MUTATION, {
    variables: {
      definition: {
        name: "Membership Config",
        type: MEMBERSHIP_CONFIG_METAOBJECT_TYPE,
        description: "Global membership pricing settings for the shop",
        displayNameKey: "title",
        access: {
          admin: "MERCHANT_READ_WRITE",
          storefront: "PUBLIC_READ",
        },
        fieldDefinitions: [
          {
            key: "title",
            name: "Title",
            type: "single_line_text_field",
            required: true,
          },
          {
            key: "enabled",
            name: "Membership pricing enabled",
            type: "boolean",
          },
          {
            key: "member_label",
            name: "Member label",
            type: "single_line_text_field",
          },
          {
            key: "savings_label",
            name: "Savings label",
            type: "single_line_text_field",
          },
          {
            key: "metafield_source",
            name: "Metafield source",
            type: "single_line_text_field",
          },
          {
            key: "linked_product_member_price",
            name: "Linked product member price",
            type: "single_line_text_field",
          },
          {
            key: "linked_variant_member_price",
            name: "Linked variant member price",
            type: "single_line_text_field",
          },
          {
            key: "linked_campaign",
            name: "Linked campaign field",
            type: "single_line_text_field",
          },
        ],
      },
    },
  });

  const payload = (await response.json()) as GraphqlPayload;
  assertGraphqlOk(payload, "Create membership config definition");

  const userErrors =
    (
      payload.data?.metaobjectDefinitionCreate as {
        userErrors?: Array<{ message: string }>;
      }
    )?.userErrors ?? [];

  if (userErrors.length > 0) {
    const messages = userErrors.map((error) => error.message).join("; ");
    if (
      messages.includes("taken") ||
      messages.includes("already exists") ||
      messages.includes("has already been taken")
    ) {
      return;
    }
    throw new Error(messages);
  }
}

export async function saveStorefrontConfigToShop(
  admin: AdminGraphQLClient,
  config: MembershipConfig,
): Promise<void> {
  const shopResponse = await admin.graphql(SHOP_ID_QUERY);
  const shopPayload = (await shopResponse.json()) as GraphqlPayload;
  assertGraphqlOk(shopPayload, "Load shop id");

  const shopId = (shopPayload.data?.shop as { id?: string } | undefined)?.id;
  if (!shopId) {
    throw new Error("Shop id could not be loaded.");
  }

  const response = await admin.graphql(STOREFRONT_CONFIG_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: shopId,
          namespace: "$app",
          key: STOREFRONT_CONFIG_METAFIELD_KEY,
          type: "json",
          value: storefrontConfigJson(config),
        },
      ],
    },
  });

  const payload = (await response.json()) as GraphqlPayload;
  assertGraphqlOk(payload, "Save storefront config");

  const userErrors =
    (
      payload.data?.metafieldsSet as {
        userErrors?: Array<{ message: string }>;
      }
    )?.userErrors ?? [];

  if (userErrors.length > 0) {
    const messages = userErrors.map((error) => error.message).join("; ");
    if (
      messages.includes("does not exist") ||
      messages.includes("definition") ||
      messages.includes("Definition")
    ) {
      throw new Error(
        `${messages} Run shopify app deploy, then save again.`,
      );
    }
    throw new Error(messages);
  }
}

export async function saveMembershipConfig(
  admin: AdminGraphQLClient,
  config: MembershipConfig,
): Promise<void> {
  try {
    await ensureMembershipConfigDefinition(admin);

    const response = await admin.graphql(UPSERT_CONFIG_MUTATION, {
      variables: {
        handle: {
          type: MEMBERSHIP_CONFIG_METAOBJECT_TYPE,
          handle: MEMBERSHIP_CONFIG_HANDLE,
        },
        metaobject: {
          fields: [
            { key: "title", value: config.title },
            { key: "enabled", value: String(config.enabled) },
            { key: "member_label", value: config.memberLabel },
            { key: "savings_label", value: config.savingsLabel },
            { key: "metafield_source", value: config.metafieldSource },
            {
              key: "linked_product_member_price",
              value: formatMetafieldHandle(
                config.linkedMetafields.productMemberPrice,
              ),
            },
            {
              key: "linked_variant_member_price",
              value: formatMetafieldHandle(
                config.linkedMetafields.variantMemberPrice,
              ),
            },
            {
              key: "linked_campaign",
              value: formatMetafieldHandle(config.linkedMetafields.campaign),
            },
          ],
        },
      },
    });

    const payload = (await response.json()) as GraphqlPayload;
    assertGraphqlOk(payload, "Save membership config");

    const userErrors =
      (
        payload.data?.metaobjectUpsert as {
          userErrors?: Array<{ message: string }>;
        }
      )?.userErrors ?? [];

    if (userErrors.length > 0) {
      throw new Error(userErrors.map((error) => error.message).join("; "));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (isMissingMetaobjectScopeError(message)) {
      throw new Error(
        "Missing app scopes for metaobjects. Reinstall the app after updating scopes.",
      );
    }
    if (isMissingDefinitionError(message)) {
      throw new Error(
        `${message} Run shopify app deploy, then save again. If it persists, reinstall MemberPro on this store.`,
      );
    }
    throw error;
  }
}
