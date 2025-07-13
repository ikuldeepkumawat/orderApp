import { authenticate } from "../shopify.server";
import { shopifyApi } from "@shopify/shopify-api";

export const action = async ({ request }) => {
  try {
    const { session, topic, shop, payload } = await authenticate.webhook(request);

    console.log(`📦 Webhook received: ${topic} from ${shop}`);
    const orderId = payload?.id;

    if (!orderId) {
      console.error("❌ Order ID not found in payload.");
      return new Response("No Order ID", { status: 400 });
    }

    const metafield = new shopifyApi.rest.Metafield({ session });
    metafield.owner_id = orderId;
    metafield.owner_resource = "order";
    metafield.namespace = "custom";
    metafield.key = "message";
    metafield.value = "Thank you for your order!";
    metafield.type = "single_line_text_field";

    await metafield.save({ update: true });

    console.log("✅ Metafield created");
    return new Response("Metafield created", { status: 200 });
  } catch (err) {
    console.error("❌ Error in webhook:", err);
    return new Response("Error", { status: 500 });
  }
};
