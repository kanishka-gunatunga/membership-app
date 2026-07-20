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
  DEFAULT_LINKED_METAFIELDS,
  DEFAULT_MEMBERSHIP_CONFIG,
  formatMetafieldHandle,
  parseMetafieldHandle,
  parseMetafieldSource,
  type MembershipConfig,
} from "../lib/membership.shared";
import { getThemeCardSetupGuide, getCardSnippetSource } from "../lib/theme-card-install.server";
import { getMemberPriceCatalogStatus } from "../lib/membership-products.server";
import { getLinkableMetafieldOptions } from "../lib/metafield-definitions.server";
import { syncLinkedMetafieldsToApp } from "../lib/sync-linked-metafields.server";
import {
  getThemeAppEmbedUrl,
  getThemeCollectionCardBlockUrl,
  getThemeCartBlockUrl,
  getThemeProductBlockUrl,
  getProductsAdminUrl,
  getThemesAdminUrl,
  loadMainTheme,
} from "../lib/theme-admin-urls.server";

function parseConfigFromForm(formData: FormData): MembershipConfig {
  const metafieldSource = parseMetafieldSource(formData.get("metafieldSource"));

  const productMemberPrice =
    parseMetafieldHandle(formData.get("linkedProductMemberPrice")) ??
    DEFAULT_LINKED_METAFIELDS.productMemberPrice;
  const variantMemberPrice =
    parseMetafieldHandle(formData.get("linkedVariantMemberPrice")) ??
    DEFAULT_LINKED_METAFIELDS.variantMemberPrice;
  const campaign =
    parseMetafieldHandle(formData.get("linkedCampaign")) ??
    DEFAULT_LINKED_METAFIELDS.campaign;

  if (metafieldSource === "linked") {
    if (
      !formData.get("linkedProductMemberPrice") ||
      !formData.get("linkedVariantMemberPrice") ||
      !formData.get("linkedCampaign")
    ) {
      throw new Error(
        "Select product member price, variant member price, and campaign fields before saving.",
      );
    }
  }

  return {
    title: String(formData.get("title") || DEFAULT_MEMBERSHIP_CONFIG.title).trim(),
    enabled: formData.get("enabled") === "on",
    memberLabel:
      String(formData.get("memberLabel") || "").trim() ||
      DEFAULT_MEMBERSHIP_CONFIG.memberLabel,
    savingsLabel:
      String(formData.get("savingsLabel") || "").trim() ||
      DEFAULT_MEMBERSHIP_CONFIG.savingsLabel,
    metafieldSource,
    linkedMetafields: {
      productMemberPrice,
      variantMemberPrice,
      campaign,
    },
  };
}

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
  const [cardSetup, mainTheme, catalogStatus, metafieldOptions] =
    await Promise.all([
      session.shop
        ? getThemeCardSetupGuide(admin, session.shop)
        : Promise.resolve(null),
      loadMainTheme(admin),
      getMemberPriceCatalogStatus(admin, config),
      getLinkableMetafieldOptions(admin),
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
    config: {
      ...config,
      linkedProductMemberPrice: formatMetafieldHandle(
        config.linkedMetafields.productMemberPrice,
      ),
      linkedVariantMemberPrice: formatMetafieldHandle(
        config.linkedMetafields.variantMemberPrice,
      ),
      linkedCampaign: formatMetafieldHandle(config.linkedMetafields.campaign),
    },
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
    metafieldOptions,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  try {
    const config = parseConfigFromForm(formData);
    const { discountId } = await syncMembershipDiscount(admin, config);
    const { synced } = await syncLinkedMetafieldsToApp(admin, config);
    return { ok: true as const, discountId, synced };
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
