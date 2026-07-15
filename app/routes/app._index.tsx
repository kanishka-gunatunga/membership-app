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
import {
  DEFAULT_MEMBERSHIP_CONFIG,
  parseMetafieldSource,
} from "../lib/membership.shared";
import { getThemeCardSetupGuide, getCardSnippetSource } from "../lib/theme-card-install.server";
import { getMemberPriceCatalogStatus } from "../lib/membership-products.server";
import {
  getThemeAppEmbedUrl,
  getThemeCollectionCardBlockUrl,
  getThemeCartBlockUrl,
  getThemeProductBlockUrl,
  getProductsAdminUrl,
  getThemesAdminUrl,
  loadMainTheme,
} from "../lib/theme-admin-urls.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  let discountActive = await isMembershipDiscountActive(admin);
  if (!discountActive) {
    try {
      await syncMembershipDiscount(admin, DEFAULT_MEMBERSHIP_CONFIG);
      discountActive = true;
    } catch {
      // Function extension may not be deployed yet.
    }
  }

  const config = await loadMembershipConfigFromDiscount(admin);
  const [cardSetup, mainTheme, catalogStatus] = await Promise.all([
    session.shop
      ? getThemeCardSetupGuide(admin, session.shop)
      : Promise.resolve(null),
    loadMainTheme(admin),
    getMemberPriceCatalogStatus(admin, config.metafieldSource),
  ]);

  const apiKey = process.env.SHOPIFY_API_KEY || "";
  const shop = session.shop;

  const themeEditorUrl =
    shop && mainTheme?.id
      ? getThemeProductBlockUrl(shop, mainTheme.id, apiKey, "member_pricing")
      : null;
  const cardBlockEditorUrl =
    shop && mainTheme?.id
      ? getThemeCollectionCardBlockUrl(
          shop,
          mainTheme.id,
          apiKey,
          "member_pricing_card",
        )
      : null;
  const cartBlockEditorUrl =
    shop && mainTheme?.id
      ? getThemeCartBlockUrl(shop, mainTheme.id, apiKey, "member_pricing_cart")
      : null;
  const cardStylesEmbedUrl =
    shop && mainTheme?.id
      ? getThemeAppEmbedUrl(shop, mainTheme.id, apiKey, "member_pricing_styles")
      : null;
  const themesAdminUrl = shop ? getThemesAdminUrl(shop) : null;
  const productsAdminUrl = shop ? getProductsAdminUrl(shop) : null;
  const cardSnippetSource = getCardSnippetSource();

  return {
    config,
    discountActive,
    themeEditorUrl,
    cardBlockEditorUrl,
    cartBlockEditorUrl,
    cardStylesEmbedUrl,
    themesAdminUrl,
    productsAdminUrl,
    cardSetup,
    catalogStatus,
    cardSnippetSource,
  };
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
    metafieldSource: parseMetafieldSource(formData.get("metafieldSource")),
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
