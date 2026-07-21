import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Outlet,
  useLoaderData,
  useLocation,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { isBillingExemptPath, PRIVACY_POLICY_PATH } from "../lib/billing.shared";
import { getAppBillingStatus, requireAppBilling } from "../lib/billing.server";
import "../styles/app-shell.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticate.admin(request);
  const pathname = new URL(request.url).pathname;

  if (!isBillingExemptPath(pathname)) {
    await requireAppBilling(auth, request);
  }

  const billingStatus = await getAppBillingStatus(auth);
  const appBaseUrl =
    process.env.SHOPIFY_APP_URL || new URL(request.url).origin;

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    billingStatus,
    privacyPolicyUrl: `${appBaseUrl.replace(/\/$/, "")}${PRIVACY_POLICY_PATH}`,
  };
};

export default function App() {
  const { apiKey, billingStatus, privacyPolicyUrl } =
    useLoaderData<typeof loader>();
  const location = useLocation();
  const onBillingPage = isBillingExemptPath(location.pathname);

  return (
    <AppProvider embedded apiKey={apiKey}>
      {!onBillingPage ? (
        <s-app-nav>
          <s-link href="/app">Settings</s-link>
        </s-app-nav>
      ) : null}
      <Outlet context={{ billingStatus, privacyPolicyUrl }} />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
