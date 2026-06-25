import type { authenticate } from "../shopify.server";
import {
  APP_BILLING_TRIAL_DAYS,
  MONTHLY_PLAN,
} from "./billing.shared";

type AdminAuth = Awaited<ReturnType<typeof authenticate.admin>>;

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
  if (process.env.SHOPIFY_BILLING_SKIP === "true") return false;
  if (process.env.SHOPIFY_BILLING_FORCE === "true") return true;
  return process.env.NODE_ENV === "production";
}

export async function requireAppBilling(
  auth: AdminAuth,
  request: Request,
): Promise<void> {
  if (!shouldRequireBilling()) return;

  const { billing } = auth;
  const isTest = isBillingTestMode();
  const returnPath = new URL("/app", request.url);
  if (
    returnPath.protocol === "http:" &&
    returnPath.hostname !== "localhost" &&
    returnPath.hostname !== "127.0.0.1"
  ) {
    returnPath.protocol = "https:";
  }
  const returnUrl = returnPath.toString();

  await billing.require({
    plans: [MONTHLY_PLAN],
    isTest,
    onFailure: async () =>
      billing.request({
        plan: MONTHLY_PLAN,
        isTest,
        trialDays: APP_BILLING_TRIAL_DAYS,
        returnUrl,
      }),
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

  const { billing } = auth;

  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [MONTHLY_PLAN],
    isTest,
  });

  const subscription = appSubscriptions[0];

  return {
    hasActivePayment,
    isTest,
    trialDays: subscription?.trialDays ?? APP_BILLING_TRIAL_DAYS,
    planName: subscription?.name ?? null,
    status: subscription?.status ?? null,
  };
}
