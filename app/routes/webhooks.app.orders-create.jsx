import { authenticate } from "../shopify.server";
import { GraphqlClient } from "@shopify/shopify-api"; // 👈 Direct GraphQL client
import db from "../db.server";

export const action = async ({ request }) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  console.log(`📦 Webhook received: ${topic} from ${shop}`);
  console.log("🧾 Order payload:", payload);

  const orderGID = payload.admin_graphql_api_id;

  if (!orderGID) {
    console.error("❌ Missing order GID");
    return new Response("Missing order GID", { status: 400 });
  }

  // 🔍 Fetch access token from DB
  const store = await db.session.findUnique({ where: { shop } });
  const accessToken = store?.accessToken;

  if (!accessToken) {
    console.error("❌ No access token found for shop:", shop);
    return new Response("Missing access token", { status: 401 });
  }

  // ✅ Create GraphQL client
  const graphqlClient = new GraphqlClient(shop, accessToken);

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
    const response = await graphqlClient.query({ data: { query: mutation, variables } });
    const { metafieldsSet } = response.body.data;

    if (metafieldsSet.userErrors.length > 0) {
      console.error("❌ Metafield Errors:", metafieldsSet.userErrors);
      return new Response("Metafield creation failed", { status: 500 });
    }

    console.log("✅ Metafield Created:", metafieldsSet.metafields);
    return new Response("Metafield created", { status: 200 });
  } catch (err) {
    console.error("❌ GraphQL Error:", err);
    return new Response("Server error", { status: 500 });
  }
};
