/**
 * Cloudflare Worker — Generic Proxy (Upstream from env)
 *
 * ✅ Single-purpose: forward incoming requests to an upstream base URL read from env.
 * ✅ No Bark-specific assumptions.
 * ✅ Preserves method/path/query/body.
 * ✅ Strips IP-identifying forwarding headers so upstream sees Cloudflare egress IP.
 *
 * Required env:
 *   UPSTREAM_BASE = "https://api.day.app"   (or your own upstream base)
 *
 * Behavior:
 *   Incoming:  https://worker.example.com/<path>?<query>
 *   Upstream:  ${UPSTREAM_BASE}/<path>?<query>
 *
 * Notes:
 * - This does not decrypt/inspect payload.
 * - This is a “dumb pipe”, but with privacy-hardening header handling.
 */

export default {
  async fetch(request, env, ctx) {
    const upstreamBase = (env.UPSTREAM_BASE || "").trim();
    if (!upstreamBase) {
      return new Response("Missing env.UPSTREAM_BASE", {
        status: 500,
        headers: baseHeaders(),
      });
    }

    const inUrl = new URL(request.url);
    const baseUrl = new URL(upstreamBase);

    // Build upstream URL: base + incoming path + incoming query
    // Ensure we don't end up with double slashes
    baseUrl.pathname = joinPath(baseUrl.pathname, inUrl.pathname);
    baseUrl.search = inUrl.search;

    // Clone & sanitize headers
    const headers = new Headers(request.headers);

    // Remove hop-by-hop headers (RFC 7230) and common proxy / IP chain headers
    const STRIP = [
      "connection",
      "keep-alive",
      "proxy-authenticate",
      "proxy-authorization",
      "te",
      "trailer",
      "transfer-encoding",
      "upgrade",

      // IP / identity-related headers
      "x-forwarded-for",
      "x-forwarded-proto",
      "x-forwarded-host",
      "x-real-ip",
      "forwarded",
      "true-client-ip",
      "cf-connecting-ip",
      "cf-ipcountry",
      "cf-ray",
      "cf-visitor",
      "via",
      "x-client-ip",
      "x-cluster-client-ip",
    ];
    for (const h of STRIP) headers.delete(h);

    // Privacy + avoid caching (both directions)
    headers.set("cache-control", "no-store");

    const method = request.method.toUpperCase();

    // OPTIONS passthrough (or you can short-circuit for CORS if you want)
    const init = {
      method,
      headers,
      redirect: "manual",
      // CF supports streaming request bodies; keep as-is for POST/PUT/PATCH
      body: shouldHaveBody(method) ? request.body : undefined,
    };

    let upstreamResp;
    try {
      upstreamResp = await fetch(baseUrl.toString(), init);
    } catch (e) {
      return new Response(`Upstream fetch failed: ${e?.message || String(e)}`, {
        status: 502,
        headers: baseHeaders(),
      });
    }

    // Pass upstream response through, but add “no-store” and some safe headers.
    const outHeaders = new Headers(upstreamResp.headers);
    outHeaders.set("cache-control", "no-store");
    for (const [k, v] of Object.entries(baseHeaders())) {
      if (!outHeaders.has(k)) outHeaders.set(k, v);
    }

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: outHeaders,
    });
  },
};

function shouldHaveBody(method) {
  return !["GET", "HEAD"].includes(method);
}

function joinPath(basePath, addPath) {
  const a = (basePath || "").replace(/\/+$/, "");
  const b = (addPath || "").replace(/^\/+/, "");
  // If basePath is "/" or empty, just return "/<addPath>"
  if (!a || a === "/") return "/" + b;
  return a + "/" + b;
}

function baseHeaders() {
  return {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cache-control": "no-store",
  };
}
