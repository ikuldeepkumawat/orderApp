import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`📦 Webhook received: ${topic} from ${shop}`);
  console.log("🧾 Order payload:", payload);

  const orderId = payload?.id;

  if (!orderId) {
    console.error("❌ Order ID not found in webhook payload");
    return new Response("Order ID missing", { status: 400 });
  }

  const client = new shopify.api.clients.Rest({ session });


  console.log("client method here:", client)
  try {
    const metafieldResponse = await client.post({
      path: "metafields",
      data: {
        metafield: {
          namespace: "order",
          key: "webhook_note",
          value: `Order #${orderId} created via webhook`,
          type: "single_line_text_field",
          owner_resource: "order",
          owner_id: orderId,
        },
      },
      type: "application/json",
    });

    console.log("✅ Metafield created:", metafieldResponse?.body);
    return new Response("Metafield created", { status: 200 });
  } catch (error) {
    console.error("❌ Failed to create metafield:", error);
    return new Response("Metafield creation failed", { status: 500 });
  }
};
