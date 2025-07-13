import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { session, topic, shop } = await authenticate.webhook(request);
  const payload = await request.json();

  console.log(`📦 Webhook received: ${topic} from ${shop}`);
  console.log("🧾 Order payload:", payload);

  const orderId = payload.id; // 🟢 Shopify se aaya order ID

  if (!orderId) {
    console.error("❌ Order ID not found in webhook payload");
    return new Response("Order ID missing", { status: 400 });
  }

  const client = new shopify.api.clients.Rest({ session });

  try {
    await client.post({
      path: "metafields",
      data: {
        metafield: {
          namespace: "order",
          key: "webhook_note",
          value: "Order created from webhook",
          type: "single_line_text_field",
          owner_resource: "order",
          owner_id: orderId, // ✅ Dynamic order ID
        },
      },
      type: "application/json",
    });

    console.log(`✅ Metafield created for order ${orderId}`);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("❌ Failed to create metafield:", error);
    return new Response("Metafield error", { status: 500 });
  }
};
