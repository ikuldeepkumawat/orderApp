import { authenticate } from "../shopify.server";
import { Graphql } from "@shopify/shopify-api";

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`📦 Webhook received: ${topic} from ${shop}`);
  console.log("🧾 Order payload:", payload);

  const orderGID = payload.admin_graphql_api_id;

  if (!orderGID) {
    console.error("❌ Missing order GID");
    return new Response("Missing order GID", { status: 400 });
  }

  const admin = new Graphql({ session });

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
    const response = await admin.query({ data: { query: mutation, variables } });
    const data = response.body.data;

    if (data.metafieldsSet.userErrors.length > 0) {
      console.error("Metafield creation errors:", data.metafieldsSet.userErrors);
      return new Response("Errors in creating metafield", { status: 500 });
    }

    console.log("✅ Metafield created:", data.metafieldsSet.metafields);
    return new Response("Metafield created", { status: 200 });
  } catch (error) {
    console.error("❌ Error creating metafield:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
