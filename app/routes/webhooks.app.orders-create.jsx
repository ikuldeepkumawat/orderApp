import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { payload, admin, shop, topic } = await authenticate.webhook(request);

  console.log(`📦 Webhook received: ${topic} from ${shop}`);
  console.log("🧾 Order payload:", payload);

  const orderGID = payload.admin_graphql_api_id; // Example: gid://shopify/Order/1234567890

  if (!orderGID) {
    console.error("❌ admin_graphql_api_id not found");
    return new Response("Missing order GID", { status: 400 });
  }

  const query = `#graphql
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
    const response = await admin.graphql(query, { variables });
    const json = await response.json();

    if (json.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error("❌ Metafield creation error:", json.data.metafieldsSet.userErrors);
      return new Response("Metafield creation failed", { status: 500 });
    }

    console.log("✅ Metafield created:", json.data.metafieldsSet.metafields);
    return new Response("Metafield created", { status: 200 });
  } catch (err) {
    console.error("❌ Exception in webhook:", err);
    return new Response("Internal error", { status: 500 });
  }
};
