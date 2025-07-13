import { authenticate } from "../shopify.server";
import db from "../db.server";
import { shopifyApi, ApiVersion } from "@shopify/shopify-api";

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`📦 Webhook received: ${topic} from ${shop}`);
  console.log("🧾 Order payload:", payload);
  console.log("session", session);

  const orderGID = payload.admin_graphql_api_id;

  if (!orderGID) {
    console.error("❌ Missing order GID");
    return new Response("Missing order GID", { status: 400 });
  }

  // ✅ Fetch accessToken from DB
  const store = await db.session.findFirst({ where: { shop } });
  const accessToken = store?.accessToken;

  if (!accessToken) {
    console.error("❌ No access token found for shop:", shop);
    return new Response("Missing access token", { status: 401 });
  }

  // ✅ Create Shopify API instance
  const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SCOPES.split(","),
    hostName: process.env.HOST.replace(/^https?:\/\//, ""),
    apiVersion: ApiVersion.July24,
    isEmbeddedApp: true,
  });

  // ✅ Create GraphQL client using raw token
  const graphqlClient = new shopify.clients.Graphql({
    shop,
    accessToken,
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
    const response = await graphqlClient.query({
      data: {
        query: mutation,
        variables,
      },
    });

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
