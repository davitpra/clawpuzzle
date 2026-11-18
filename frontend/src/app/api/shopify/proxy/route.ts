import { NextResponse } from "next/server";
import { getPostHogLogger } from "@/instrumentation";

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const accessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

function logShopifyProxyOutcome(
  severityText: "INFO" | "ERROR",
  outcome: "success" | "configuration_missing" | "upstream_error" | "graphql_error" | "exception",
  statusCode: number,
  errorType?: string,
) {
  getPostHogLogger()?.emit({
    severityText,
    body: "shopify_proxy_completed",
    attributes: {
      route: "shopify_proxy",
      outcome,
      status_code: statusCode,
      ...(errorType ? { error_type: errorType } : {}),
    },
  });
}

export async function POST(request: Request) {
  try {
    const { query, variables } = await request.json();

    if (!domain || !accessToken) {
      logShopifyProxyOutcome("ERROR", "configuration_missing", 500);
      return NextResponse.json(
        { error: "Shopify credentials not configured on server" },
        { status: 500 },
      );
    }

    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const endpoint = `https://${cleanDomain}/api/2026-01/graphql.json`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Shopify API Error:", data);
      logShopifyProxyOutcome("ERROR", "upstream_error", res.status);
      return NextResponse.json(data, { status: res.status });
    }

    if (data.errors) {
      console.error("Shopify GraphQL Errors:", data.errors);
      logShopifyProxyOutcome("ERROR", "graphql_error", res.status);
      // We still return 200 if it's a GraphQL error, but the client should handle it
    } else {
      logShopifyProxyOutcome("INFO", "success", res.status);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Shopify Proxy Exception:", error);
    logShopifyProxyOutcome(
      "ERROR",
      "exception",
      500,
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      {
        error: "Internal Server Error during Shopify fetch",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 },
    );
  }
}
