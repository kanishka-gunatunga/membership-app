import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import {
  billingCallbackOutcome,
  waitForActiveBilling,
} from "../lib/billing.server";
import { BILLING_PAGE_PATH } from "../lib/billing.shared";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticate.admin(request);
  const { chargeAccepted } = billingCallbackOutcome(request);

  if (!chargeAccepted) {
    throw redirect(`${BILLING_PAGE_PATH}?status=declined`);
  }

  const confirmed = await waitForActiveBilling(auth);
  if (confirmed) {
    throw redirect("/app");
  }

  throw redirect(`${BILLING_PAGE_PATH}?status=confirming`);
};

export default function BillingCallback() {
  return null;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
