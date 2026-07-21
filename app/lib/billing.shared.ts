/** Internal billing plan key — must match shopify.server.ts billing config. */
export const MONTHLY_PLAN = "Monthly";

export const APP_BILLING_AMOUNT_USD = 20;

export const APP_BILLING_TRIAL_DAYS = 14;

/** Public app name — update TOML + Partner listing to match. */
export const APP_DISPLAY_NAME = "MemberPro";

export const APP_TAGLINE = "Build, Manage, and Grow Memberships";

export const APP_BILLING_DESCRIPTION =
  "Member pricing on product pages, collection cards, and checkout for logged-in customers.";

/** Where Shopify redirects after the merchant approves or declines a charge. */
export const BILLING_CALLBACK_PATH = "/app/billing/callback";

/** In-app page shown when billing is required or was declined. */
export const BILLING_PAGE_PATH = "/app/billing";

export const PRIVACY_POLICY_PATH = "/privacy";

/** Shopify adds this query param when a charge is accepted. */
export const BILLING_CHARGE_ID_PARAM = "charge_id";

export type BillingPageStatus = "declined" | "confirming" | "required";

export function parseBillingPageStatus(
  value: string | null,
): BillingPageStatus | null {
  if (
    value === "declined" ||
    value === "confirming" ||
    value === "required"
  ) {
    return value;
  }
  return null;
}

export function isBillingExemptPath(pathname: string): boolean {
  return (
    pathname === BILLING_PAGE_PATH ||
    pathname.startsWith(`${BILLING_PAGE_PATH}/`) ||
    pathname === BILLING_CALLBACK_PATH
  );
}
