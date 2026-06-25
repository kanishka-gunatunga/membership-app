import type { LoaderFunctionArgs } from "react-router";

import { getStorefrontPricingByHandles } from "../lib/member-pricing-storefront.server";
import { loadMembershipConfigFromDiscount } from "../lib/membership-discount.server";
import { authenticate, unauthenticated } from "../shopify.server";

/** App proxy handler — Shopify forwards /apps/membership-pricing/prices to /prices on the app. */
export async function memberPricingPricesLoader({ request }: LoaderFunctionArgs) {
  const proxyContext = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const shop =
    proxyContext.session?.shop ?? url.searchParams.get("shop") ?? undefined;

  if (!shop) {
    return Response.json({ products: {}, error: "missing_shop" }, { status: 400 });
  }

  let admin = proxyContext.admin;
  if (!admin) {
    ({ admin } = await unauthenticated.admin(shop));
  }

  const handles =
    url.searchParams
      .get("handles")
      ?.split(",")
      .map((handle) => handle.trim())
      .filter(Boolean) ?? [];

  const [products, config] = await Promise.all([
    getStorefrontPricingByHandles(admin, handles),
    loadMembershipConfigFromDiscount(admin),
  ]);

  return Response.json(
    {
      products,
      labels: {
        memberLabel: config.memberLabel,
        rrpLabel: "RRP",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Content-Type": "application/json",
      },
    },
  );
}
