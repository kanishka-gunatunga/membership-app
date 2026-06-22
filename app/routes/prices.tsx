import type { LoaderFunctionArgs } from "react-router";

import { memberPricingPricesLoader } from "../lib/member-pricing-prices.loader.server";

export const loader = (args: LoaderFunctionArgs) =>
  memberPricingPricesLoader(args);
