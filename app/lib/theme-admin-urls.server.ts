function getStoreHandle(shop: string): string {
  return shop.replace(/\.myshopify\.com$/i, "");
}

function getThemeNumericId(themeGid: string): string {
  const parts = themeGid.split("/");
  return parts[parts.length - 1] ?? themeGid;
}

/** Opens the legacy theme code editor on a specific file. */
export function getThemeCodeEditorUrl(
  shop: string,
  filename: string,
  themeGid: string,
): string {
  const handle = getStoreHandle(shop);
  const themeId = getThemeNumericId(themeGid);
  const key = encodeURIComponent(filename);

  return `https://admin.shopify.com/store/${handle}/themes/${themeId}?key=${key}`;
}

/** Opens the Online Store → Themes list for the shop. */
export function getThemesAdminUrl(shop: string): string {
  const handle = getStoreHandle(shop);
  return `https://admin.shopify.com/store/${handle}/themes`;
}

/** Opens the theme visual editor (Online Store 2.0). */
export function getThemeVisualEditorUrl(shop: string, themeGid: string): string {
  const handle = getStoreHandle(shop);
  const themeId = getThemeNumericId(themeGid);
  return `https://admin.shopify.com/store/${handle}/themes/${themeId}/editor`;
}

export function getThemeAppEmbedUrl(
  shop: string,
  themeGid: string,
  apiKey: string,
  appBlockHandle: string,
): string {
  const handle = getStoreHandle(shop);
  const themeId = getThemeNumericId(themeGid);
  return `https://admin.shopify.com/store/${handle}/themes/${themeId}/editor?context=apps&activateAppId=${apiKey}/${appBlockHandle}`;
}

export function getThemeProductBlockUrl(
  shop: string,
  themeGid: string,
  apiKey: string,
  appBlockHandle: string,
): string {
  const handle = getStoreHandle(shop);
  const themeId = getThemeNumericId(themeGid);
  return `https://admin.shopify.com/store/${handle}/themes/${themeId}/editor?template=product&addAppBlockId=${apiKey}/${appBlockHandle}&target=mainSection`;
}

/** Opens the collection template in the theme editor to add a product-card app block. */
export function getThemeCollectionCardBlockUrl(
  shop: string,
  themeGid: string,
  apiKey: string,
  appBlockHandle: string,
): string {
  const handle = getStoreHandle(shop);
  const themeId = getThemeNumericId(themeGid);
  return `https://admin.shopify.com/store/${handle}/themes/${themeId}/editor?template=collection&addAppBlockId=${apiKey}/${appBlockHandle}`;
}

/** Opens the cart template in the theme editor to add the cart pricing block. */
export function getThemeCartBlockUrl(
  shop: string,
  themeGid: string,
  apiKey: string,
  appBlockHandle: string,
): string {
  const handle = getStoreHandle(shop);
  const themeId = getThemeNumericId(themeGid);
  return `https://admin.shopify.com/store/${handle}/themes/${themeId}/editor?template=cart&addAppBlockId=${apiKey}/${appBlockHandle}`;
}

export function getProductsAdminUrl(shop: string): string {
  const handle = getStoreHandle(shop);
  return `https://admin.shopify.com/store/${handle}/products`;
}

/** Test app proxy pricing on the storefront (open while logged out). */
export function getAppProxyPricingTestUrl(
  shop: string,
  productHandle: string,
): string {
  return `https://${shop}/apps/membership-pricing/prices?handles=${encodeURIComponent(productHandle)}`;
}

export const MAIN_THEME_QUERY = `#graphql
  query MainTheme {
    themes(first: 1, roles: [MAIN]) {
      nodes {
        id
        name
      }
    }
  }
`;

export async function loadMainTheme(
  admin: { graphql: (query: string) => Promise<Response> },
): Promise<{ id: string; name: string } | null> {
  const response = await admin.graphql(MAIN_THEME_QUERY);
  const json = await response.json();
  return json.data?.themes?.nodes?.[0] ?? null;
}
