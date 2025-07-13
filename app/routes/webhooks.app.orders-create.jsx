import { authenticate } from "../shopify.server";
import { shopifyApi, ApiVersion } from "@shopify/shopify-api";

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`📦 Webhook received: ${topic} from ${shop}`);
  console.log("🧾 Order payload:", payload);
  console.log("session.accessToken", session.accessToken)
  const orderGID = payload.admin_graphql_api_id;

  if (!orderGID) {
    console.error("❌ Missing order GID");
    return new Response("Missing order GID", { status: 400 });
  }

  const client = shopifyApi({
    adminApiAccessToken: session.accessToken,
    shopDomain: session.shop,
    apiVersion: ApiVersion.July24,
  });

  const mutation = `#graphql
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
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
    }`;

  const variables = {
    metafields: [
      {
        ownerId: orderGID,
        namespace: "order_notes",
        key: "created_via_webhook",
        type: "single_line_text_field",
        value: `Created at ${new Date().toISOString()}`,
      },
    ],
  };

  try {
    const res = await client.admin.graphql({ query: mutation, variables });

    const json = await res.json();

    if (json.data.metafieldsSet.userErrors.length > 0) {
      console.error("Metafield error:", json.data.metafieldsSet.userErrors);
      return new Response("Metafield creation failed", { status: 500 });
    }

    console.log("✅ Metafield created:", json.data.metafieldsSet.metafields);
    return new Response("Metafield created", { status: 200 });
  } catch (err) {
    console.error("❌ GraphQL Error:", err);
    return new Response("Server error", { status: 500 });
  }
};
