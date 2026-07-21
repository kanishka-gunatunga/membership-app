import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, redirect, useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import {
  APP_BILLING_AMOUNT_USD,
  APP_BILLING_DESCRIPTION,
  APP_BILLING_TRIAL_DAYS,
  APP_DISPLAY_NAME,
  MONTHLY_PLAN,
  PRIVACY_POLICY_PATH,
  parseBillingPageStatus,
} from "../lib/billing.shared";
import {
  getAppBillingStatus,
  requestAppBilling,
} from "../lib/billing.server";
import styles from "../styles/billing-page.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticate.admin(request);
  const billingStatus = await getAppBillingStatus(auth);

  if (billingStatus.hasActivePayment) {
    throw redirect("/app");
  }

  const appUrl = process.env.SHOPIFY_APP_URL || new URL(request.url).origin;

  return {
    planName: MONTHLY_PLAN,
    amountUsd: APP_BILLING_AMOUNT_USD,
    trialDays: APP_BILLING_TRIAL_DAYS,
    description: APP_BILLING_DESCRIPTION,
    appName: APP_DISPLAY_NAME,
    privacyPolicyUrl: `${appUrl.replace(/\/$/, "")}${PRIVACY_POLICY_PATH}`,
    billingStatus,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const auth = await authenticate.admin(request);
  return requestAppBilling(auth, request);
};

export default function AppBillingPage() {
  const {
    planName,
    amountUsd,
    trialDays,
    description,
    appName,
    privacyPolicyUrl,
    billingStatus,
  } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const pageStatus = parseBillingPageStatus(searchParams.get("status"));

  return (
    <s-page heading={`Subscribe to ${appName}`}>
      <s-section heading="Choose your plan">
        {pageStatus === "declined" ? (
          <s-banner tone="warning">
            You declined the subscription charge. You can review the plan below
            and subscribe when you are ready.
          </s-banner>
        ) : null}

        {pageStatus === "confirming" ? (
          <s-banner tone="info">
            We are confirming your subscription with Shopify. If this message
            persists, click Subscribe again or refresh in a few seconds.
          </s-banner>
        ) : null}

        <div className={styles.planCard}>
          <s-stack gap="base">
            <s-heading>{planName} plan</s-heading>
            <s-paragraph>
              <s-text type="strong">${amountUsd}/month</s-text> after a{" "}
              {trialDays}-day free trial.
            </s-paragraph>
            <s-paragraph color="subdued">{description}</s-paragraph>
            <s-unordered-list>
              <s-list-item>
                Member pricing on product pages and collection cards
              </s-list-item>
              <s-list-item>
                Automatic checkout discounts for logged-in customers
              </s-list-item>
              <s-list-item>Theme app blocks and guided setup</s-list-item>
            </s-unordered-list>

            {billingStatus.isTest ? (
              <s-badge tone="warning">Test billing mode</s-badge>
            ) : null}

            <Form method="post">
              <s-button type="submit" variant="primary">
                Subscribe — ${amountUsd}/month
              </s-button>
            </Form>

            <s-paragraph color="subdued">
              You will be redirected to Shopify to approve this recurring
              charge. You can decline and return here to subscribe later.
              Charges appear in Shopify Admin under Settings → Apps → {appName}.
            </s-paragraph>

            <s-link href={privacyPolicyUrl} target="_blank">
              Privacy policy
            </s-link>
          </s-stack>
        </div>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
