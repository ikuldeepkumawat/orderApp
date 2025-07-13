import { authenticate } from "../shopify.server";
import shopify from "../shopify.server"; // 👈 Make sure this is the correct path

export const action = async ({ request }) => {
  const { payload, session, shop, topic } = await authenticate.webhook(request);
  const admin = new shopify.api.clients.Graphql({ session });

  console.log(admin);

  console.log(`📦 Webhook received: ${topic} from ${shop}`);
  console.log("🧾 Order payload:", payload);

  const orderGID = payload.admin_graphql_api_id;

  if (!orderGID) {
    console.error("❌ Order GID not found");
    return new Response("Missing order GID", { status: 400 });
  }

  const mutation = `#graphql
    mutation createOrderMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    metafields: [
      {
        ownerId: orderGID,
        namespace: "order_notes",
        key: "created_via_webhook",
        type: "single_line_text_field",
        value: `Order received at ${new Date().toISOString()}`,
      },
    ],
  };

  try {
    const response = await admin.query({ data: { query: mutation, variables } });
    const data = response.body.data;

    if (data.metafieldsSet.userErrors.length > 0) {
      console.error("❌ Metafield creation errors:", data.metafieldsSet.userErrors);
      return new Response("Metafield creation failed", { status: 500 });
    }

    console.log("✅ Metafield created:", data.metafieldsSet.metafields);
    return new Response("Metafield created", { status: 200 });
  } catch (err) {
    console.error("❌ Exception in webhook:", err);
    return new Response("Internal error", { status: 500 });
  }
};
