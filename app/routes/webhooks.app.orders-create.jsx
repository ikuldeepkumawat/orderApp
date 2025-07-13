import { authenticate } from "../shopify.server";
import db from "../db.server";


export const action = async ({ request }) => {
  const { payload, topic, shop } = await authenticate.webhook(request);
  console.log(`📦 Webhook received: ${topic} from ${shop}`);

  
  const orderGID = payload.admin_graphql_api_id;
  if (!orderGID) return new Response("Missing order GID", { status: 400 });

  // ✅ Get token from DB
  const session = await db.session.findFirst({ where: { shop } });
  const accessToken = session?.accessToken;
  if (!accessToken) return new Response("Missing access token", { status: 401 });

  // ✅ Prepare mutation
  const mutation = `
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

  // ✅ Simple fetch call to Shopify Admin GraphQL
  try {
    const res = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    const json = await res.json();
    const errors = json.data?.metafieldsSet?.userErrors;

    if (errors?.length) {
      console.error("❌ Metafield Errors:", errors);
      return new Response("Metafield creation failed", { status: 500 });
    }

    console.log("✅ Metafield Created:", json.data?.metafieldsSet?.metafields);
    return new Response("Metafield created", { status: 200 });

  } catch (err) {
    console.error("❌ GraphQL Error:", err);
    return new Response("Server error", { status: 500 });
  }
};
