import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { deleteMemberOrderSnapshotsForShop } from "../lib/member-order-analytics.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
      break;

    case "SHOP_REDACT":
      await db.session.deleteMany({ where: { shop } });
      await deleteMemberOrderSnapshotsForShop(shop);
      break;

    default:
      console.warn(`Unhandled compliance topic: ${topic}`);
  }

  return new Response();
};
