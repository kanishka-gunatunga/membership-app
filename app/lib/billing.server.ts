import type { authenticate } from "../shopify.server";
import {
  APP_BILLING_TRIAL_DAYS,
  BILLING_CALLBACK_PATH,
  BILLING_CHARGE_ID_PARAM,
  isBillingExemptPath,
  MONTHLY_PLAN,
} from "./billing.shared";

type AdminAuth = Awaited<ReturnType<typeof authenticate.admin>>;

const BILLING_CONFIRM_MAX_ATTEMPTS = 8;
const BILLING_CONFIRM_DELAY_MS = 500;

export function isBillingTestMode(): boolean {
  if (process.env.SHOPIFY_BILLING_TEST === "true") return true;
  if (process.env.SHOPIFY_BILLING_TEST === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Billing is required in production. Local dev skips by default so charge-approval
 * redirects do not block development (and to avoid HTTP 431 from oversized cookies
 * on recurring charge confirmation). Set SHOPIFY_BILLING_FORCE=true to test billing locally.
 */
export function shouldRequireBilling(): boolean {
  if (
    process.env.SHOPIFY_BILLING_SKIP === "true" &&
    process.env.NODE_ENV === "production"
  ) {
    throw new Error(
      "SHOPIFY_BILLING_SKIP cannot be enabled in production. Remove it before App Store submission.",
    );
  }
  if (process.env.SHOPIFY_BILLING_SKIP === "true") return false;
  if (process.env.SHOPIFY_BILLING_FORCE === "true") return true;
  return process.env.NODE_ENV === "production";
}

export function buildSecureAppUrl(request: Request, pathname: string): string {
  const url = new URL(pathname, request.url);
  if (
    url.protocol === "http:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  ) {
    url.protocol = "https:";
  }
  return url.toString();
}

export function getBillingCallbackUrl(request: Request): string {
  return buildSecureAppUrl(request, BILLING_CALLBACK_PATH);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function checkAppBilling(auth: AdminAuth) {
  if (!shouldRequireBilling()) {
    return {
      hasActivePayment: true,
      isTest: isBillingTestMode(),
      appSubscriptions: [] as Awaited<
        ReturnType<AdminAuth["billing"]["check"]>
      >["appSubscriptions"],
    };
  }

  const isTest = isBillingTestMode();
  return auth.billing.check({
    plans: [MONTHLY_PLAN],
    isTest,
  });
}

export async function waitForActiveBilling(
  auth: AdminAuth,
  options: {
    maxAttempts?: number;
    delayMs?: number;
  } = {},
): Promise<boolean> {
  if (!shouldRequireBilling()) return true;

  const maxAttempts = options.maxAttempts ?? BILLING_CONFIRM_MAX_ATTEMPTS;
  const delayMs = options.delayMs ?? BILLING_CONFIRM_DELAY_MS;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { hasActivePayment } = await checkAppBilling(auth);
    if (hasActivePayment) return true;
    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }

  return false;
}

export async function requestAppBilling(
  auth: AdminAuth,
  request: Request,
): Promise<Response> {
  if (!shouldRequireBilling()) {
    return new Response(null, { status: 204 });
  }

  const { billing } = auth;
  const isTest = isBillingTestMode();

  return billing.request({
    plan: MONTHLY_PLAN,
    isTest,
    trialDays: APP_BILLING_TRIAL_DAYS,
    returnUrl: getBillingCallbackUrl(request),
  });
}

/**
 * Redirects to Shopify charge approval when there is no active subscription.
 * Billing-exempt routes (e.g. /app/billing) must call this explicitly via action.
 */
export async function requireAppBilling(
  auth: AdminAuth,
  request: Request,
): Promise<void> {
  if (!shouldRequireBilling()) return;

  const pathname = new URL(request.url).pathname;
  if (isBillingExemptPath(pathname)) return;

  const { billing } = auth;
  const isTest = isBillingTestMode();

  await billing.require({
    plans: [MONTHLY_PLAN],
    isTest,
    onFailure: async () => requestAppBilling(auth, request),
  });
}

export async function getAppBillingStatus(auth: AdminAuth) {
  const isTest = isBillingTestMode();

  if (!shouldRequireBilling()) {
    return {
      hasActivePayment: true,
      isTest,
      trialDays: APP_BILLING_TRIAL_DAYS,
      planName: null,
      status: null,
    };
  }

  const { hasActivePayment, appSubscriptions } = await checkAppBilling(auth);
  const subscription = appSubscriptions[0];

  return {
    hasActivePayment,
    isTest,
    trialDays: subscription?.trialDays ?? APP_BILLING_TRIAL_DAYS,
    planName: subscription?.name ?? null,
    status: subscription?.status ?? null,
  };
}

export function billingCallbackOutcome(request: Request): {
  chargeAccepted: boolean;
} {
  const url = new URL(request.url);
  return {
    chargeAccepted: url.searchParams.has(BILLING_CHARGE_ID_PARAM),
  };
}

export { isBillingExemptPath };
