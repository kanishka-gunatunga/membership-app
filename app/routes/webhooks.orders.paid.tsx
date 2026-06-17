import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  if (topic !== "ORDERS_PAID") {
    return new Response();
  }

  // Module 6: persist member discount analytics from order payload.
  console.log(`orders/paid webhook received for ${shop}`);

  return new Response();
};
