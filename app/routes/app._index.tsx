import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import MembershipSettingsPage from "../components/MembershipSettingsPage";
import {
  isMembershipDiscountActive,
  loadMembershipConfigFromDiscount,
  syncMembershipDiscount,
} from "../lib/membership-discount.server";
import { DEFAULT_MEMBERSHIP_CONFIG } from "../lib/membership.shared";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [config, discountActive] = await Promise.all([
    loadMembershipConfigFromDiscount(admin),
    isMembershipDiscountActive(admin),
  ]);

  const apiKey = process.env.SHOPIFY_API_KEY || "";
  const themeEditorUrl = session.shop
    ? `https://${session.shop}/admin/themes/current/editor?template=product&addAppBlockId=${apiKey}/member_pricing&target=mainSection`
    : null;

  return { config, discountActive, themeEditorUrl };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const config = {
    title: String(formData.get("title") || DEFAULT_MEMBERSHIP_CONFIG.title).trim(),
    enabled: formData.get("enabled") === "on",
    memberLabel:
      String(formData.get("memberLabel") || "").trim() ||
      DEFAULT_MEMBERSHIP_CONFIG.memberLabel,
    savingsLabel:
      String(formData.get("savingsLabel") || "").trim() ||
      DEFAULT_MEMBERSHIP_CONFIG.savingsLabel,
  };

  try {
    const { discountId } = await syncMembershipDiscount(admin, config);
    return { ok: true as const, discountId };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to save settings",
    };
  }
};

export default function Index() {
  return <MembershipSettingsPage />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
