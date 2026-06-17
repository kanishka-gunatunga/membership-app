import type { authenticate } from "../shopify.server";
import {
  DEFAULT_MEMBERSHIP_CONFIG,
  MEMBERSHIP_CONFIG_METAOBJECT_TYPE,
  type MembershipConfig,
} from "./membership.shared";

type AdminGraphQLClient = Awaited<
  ReturnType<typeof authenticate.admin>
>["admin"];

const MEMBERSHIP_CONFIG_HANDLE = "default";

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

  return {
    title: readField("title") || DEFAULT_MEMBERSHIP_CONFIG.title,
    enabled: readField("enabled") !== "false",
    memberLabel: readField("memberLabel") || DEFAULT_MEMBERSHIP_CONFIG.memberLabel,
    savingsLabel:
      readField("savingsLabel") || DEFAULT_MEMBERSHIP_CONFIG.savingsLabel,
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

export async function saveMembershipConfig(
  admin: AdminGraphQLClient,
  config: MembershipConfig,
): Promise<void> {
  try {
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
    throw error;
  }
}
