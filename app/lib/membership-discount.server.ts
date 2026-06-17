import type { authenticate } from "../shopify.server";
import {
  DEFAULT_MEMBERSHIP_CONFIG,
  MEMBERSHIP_DISCOUNT_METAFIELD_KEY,
  MEMBERSHIP_DISCOUNT_TITLE,
  type MembershipConfig,
} from "./membership.shared";

type AdminGraphQLClient = Awaited<
  ReturnType<typeof authenticate.admin>
>["admin"];

export const MEMBER_DISCOUNT_FUNCTION_HANDLE = "member-pricing-discount";

const LIST_APP_DISCOUNTS_QUERY = `#graphql
  query ListAppAutomaticDiscounts {
    discountNodes(first: 25, query: "type:app") {
      nodes {
        id
        metafield(key: "${MEMBERSHIP_DISCOUNT_METAFIELD_KEY}") {
          jsonValue
        }
        discount {
          ... on DiscountAutomaticApp {
            discountId
            title
            status
          }
        }
      }
    }
  }
`;

const CREATE_DISCOUNT_MUTATION = `#graphql
  mutation CreateMemberPricingDiscount($discount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $discount) {
      automaticAppDiscount {
        discountId
        title
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const SET_METAFIELDS_MUTATION = `#graphql
  mutation SetMembershipDiscountMetafield($metafields: [MetafieldsSetInput!]!) {
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

type GraphqlPayload = {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
};

function assertGraphqlOk(payload: GraphqlPayload, context: string): void {
  if (payload.errors?.length) {
    throw new Error(
      `${context}: ${payload.errors.map((error) => error.message).join("; ")}`,
    );
  }
}

function functionConfigJson(config: MembershipConfig): string {
  return JSON.stringify({
    title: config.title,
    enabled: config.enabled,
    memberLabel: config.memberLabel,
    savingsLabel: config.savingsLabel,
  });
}

function metafieldInput(config: MembershipConfig) {
  return {
    namespace: "$app",
    key: MEMBERSHIP_DISCOUNT_METAFIELD_KEY,
    type: "json",
    value: functionConfigJson(config),
  };
}

async function findAutomaticDiscountId(
  admin: AdminGraphQLClient,
): Promise<string | null> {
  const response = await admin.graphql(LIST_APP_DISCOUNTS_QUERY);
  const payload = (await response.json()) as GraphqlPayload;
  assertGraphqlOk(payload, "List discounts");

  const nodes =
    (payload.data?.discountNodes as { nodes?: Array<Record<string, unknown>> })
      ?.nodes ?? [];

  for (const node of nodes) {
    const discount = node.discount as
      | { discountId?: string; title?: string }
      | undefined;
    if (discount?.title === MEMBERSHIP_DISCOUNT_TITLE && discount.discountId) {
      return discount.discountId;
    }
  }

  return null;
}

async function createAutomaticDiscount(
  admin: AdminGraphQLClient,
  config: MembershipConfig,
): Promise<string> {
  const response = await admin.graphql(CREATE_DISCOUNT_MUTATION, {
    variables: {
      discount: {
        title: MEMBERSHIP_DISCOUNT_TITLE,
        functionHandle: MEMBER_DISCOUNT_FUNCTION_HANDLE,
        discountClasses: ["PRODUCT"],
        startsAt: new Date().toISOString(),
        metafields: [metafieldInput(config)],
      },
    },
  });

  const payload = (await response.json()) as GraphqlPayload;
  assertGraphqlOk(payload, "Create discount");

  const createResult = payload.data?.discountAutomaticAppCreate as
    | {
        userErrors?: Array<{ message: string }>;
        automaticAppDiscount?: { discountId?: string };
      }
    | undefined;

  const userErrors = createResult?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((error) => error.message).join("; "));
  }

  const discountId = createResult?.automaticAppDiscount?.discountId;
  if (!discountId) {
    throw new Error(
      "Create discount returned no discountId. Deploy the member-pricing-discount function extension first.",
    );
  }

  return discountId;
}

async function setDiscountMetafield(
  admin: AdminGraphQLClient,
  discountId: string,
  config: MembershipConfig,
): Promise<void> {
  const response = await admin.graphql(SET_METAFIELDS_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: discountId,
          ...metafieldInput(config),
        },
      ],
    },
  });

  const payload = (await response.json()) as GraphqlPayload;
  assertGraphqlOk(payload, "Set discount metafield");

  const userErrors =
    (
      payload.data?.metafieldsSet as {
        userErrors?: Array<{ message: string }>;
      }
    )?.userErrors ?? [];

  if (userErrors.length > 0) {
    throw new Error(userErrors.map((error) => error.message).join("; "));
  }
}

export async function isMembershipDiscountActive(
  admin: AdminGraphQLClient,
): Promise<boolean> {
  const discountId = await findAutomaticDiscountId(admin);
  return Boolean(discountId);
}

export async function syncMembershipDiscount(
  admin: AdminGraphQLClient,
  config: MembershipConfig,
): Promise<{ discountId: string }> {
  let discountId = await findAutomaticDiscountId(admin);

  if (!discountId) {
    discountId = await createAutomaticDiscount(admin, config);
  } else {
    await setDiscountMetafield(admin, discountId, config);
  }

  return { discountId };
}

export async function loadMembershipConfigFromDiscount(
  admin: AdminGraphQLClient,
): Promise<MembershipConfig> {
  const response = await admin.graphql(LIST_APP_DISCOUNTS_QUERY);
  const payload = (await response.json()) as GraphqlPayload;
  assertGraphqlOk(payload, "List discounts");

  const nodes =
    (payload.data?.discountNodes as { nodes?: Array<Record<string, unknown>> })
      ?.nodes ?? [];

  for (const node of nodes) {
    const discount = node.discount as { title?: string } | undefined;
    if (discount?.title !== MEMBERSHIP_DISCOUNT_TITLE) continue;

    const jsonValue = (node.metafield as { jsonValue?: unknown } | undefined)
      ?.jsonValue;
    if (!jsonValue || typeof jsonValue !== "object" || Array.isArray(jsonValue)) {
      return DEFAULT_MEMBERSHIP_CONFIG;
    }

    const record = jsonValue as Record<string, unknown>;
    return {
      title:
        typeof record.title === "string" && record.title.trim()
          ? record.title
          : DEFAULT_MEMBERSHIP_CONFIG.title,
      enabled: record.enabled !== false,
      memberLabel:
        typeof record.memberLabel === "string" && record.memberLabel.trim()
          ? record.memberLabel
          : DEFAULT_MEMBERSHIP_CONFIG.memberLabel,
      savingsLabel:
        typeof record.savingsLabel === "string" && record.savingsLabel.trim()
          ? record.savingsLabel
          : DEFAULT_MEMBERSHIP_CONFIG.savingsLabel,
    };
  }

  return DEFAULT_MEMBERSHIP_CONFIG;
}
