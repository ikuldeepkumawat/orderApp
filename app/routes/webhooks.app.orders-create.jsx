import { authenticate } from "../shopify.server";
import { shopifyApi } from "@shopify/shopify-api";

export const action = async ({ request }) => {
  const { session, topic, shop, payload } = await authenticate.webhook(request);

  console.log(`✅ Received ${topic} webhook from ${shop}`);

  const orderId = payload.id;

  // Create metafield
  const metafield = new shopifyApi.rest.Metafield({ session });
  metafield.owner_id = orderId;
  metafield.owner_resource = "order";
  metafield.namespace = "custom";
  metafield.key = "message";
  metafield.value = "Thank you for your order!";
  metafield.type = "single_line_text_field";

  await metafield.save({ update: true });

  console.log(`📦 Metafield created for order #${orderId}`);

  return new Response("Metafield created", { status: 200 });
};
