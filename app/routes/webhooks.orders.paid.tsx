import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  persistMemberOrderSnapshot,
  type OrderPaidWebhookPayload,
} from "../lib/member-order-analytics.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  if (topic !== "ORDERS_PAID") {
    return new Response();
  }

  const payload = (await request.json()) as OrderPaidWebhookPayload;

  try {
    await persistMemberOrderSnapshot(shop, payload);
  } catch (error) {
    console.error(`orders/paid snapshot failed for ${shop}:`, error);
  }

  return new Response();
};
