import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const defaultOrigins = [
  "https://saltandsovereignty.com",
  "https://www.saltandsovereignty.com",
  "https://dev.saltandsovereignty.com",
  "https://saltandsovereigntypod.github.io"
];
const configuredOrigins = (Deno.env.get("ACCOUNT_DELETE_ALLOWED_ORIGINS") || "").split(",").map((value) => value.trim()).filter(Boolean);
const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);
const PREVIEW_TTL_MS = 20 * 60 * 1000;
const CONFIRMATION = "DELETE MY SALT AND SOVEREIGNTY ACCOUNT";
const OWNED_TABLES = [
  "user_settings", "saved_altars", "custom_altar_backgrounds", "custom_cabinet_items",
  "custom_cabinet_image_overrides", "grimoire_books", "grimoire_sections", "grimoire_pages",
  "grimoire_blocks", "grimoire_page_links", "living_library_entries", "library_relations",
  "object_instances", "object_instance_events", "apothecary_items", "ritual_templates",
  "ritual_template_steps", "ritual_sessions", "ritual_session_steps", "user_rituals", "ritual_links"
];
const USER_BUCKETS = ["user-assets"];

function flag(name: string) { return Deno.env.get(name) === "true"; }
function capability() {
  const environment = Deno.env.get("ACCOUNT_DELETE_ENVIRONMENT") || "unconfigured";
  const state = {
    functionAvailable: true,
    inventoryVerified: flag("ACCOUNT_DELETE_INVENTORY_VERIFIED"),
    storageVerified: flag("ACCOUNT_DELETE_STORAGE_VERIFIED"),
    communityPolicyVerified: flag("ACCOUNT_DELETE_COMMUNITY_POLICY_VERIFIED"),
    recentAuthVerified: false, // No server-verifiable reauthentication challenge exists yet.
    disposableAccountTestPassed: flag("ACCOUNT_DELETE_DISPOSABLE_TEST_PASSED"),
    productionEnabled: false,
    environment
  };
  const blockers = Object.entries(state).filter(([key, value]) => key !== "environment" && key !== "functionAvailable" && value !== true).map(([key]) => key);
  if (environment !== "development") blockers.push("development_only");
  return { ...state, blockers: [...new Set(blockers)], executeEnabled: false };
}

function response(origin: string, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "POST, OPTIONS", "vary": "Origin" } });
}

async function countOwned(admin: ReturnType<typeof createClient>, table: string, userId: string) {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq("user_id", userId);
  if (error) return { table, count: null, blocker: `${table}_inventory_unverified` };
  return { table, count: count || 0 };
}

async function countStorage(admin: ReturnType<typeof createClient>, userId: string) {
  const results: Array<{ bucket: string; count: number; blocker?: string }> = [];
  for (const bucket of USER_BUCKETS) {
    let count = 0; let offset = 0;
    for (;;) {
      const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 100, offset });
      if (error) { results.push({ bucket, count, blocker: `${bucket}_storage_inventory_unverified` }); break; }
      count += (data || []).filter((item) => item.id).length;
      if (!data || data.length < 100) { results.push({ bucket, count }); break; }
      offset += data.length;
    }
  }
  return results;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  if (!allowedOrigins.has(origin)) return new Response("Origin not allowed", { status: 403 });
  if (request.method === "OPTIONS") return response(origin, 204, {});
  if (request.method !== "POST") return response(origin, 405, { error: "method_not_allowed" });

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return response(origin, 401, { error: "authentication_required" });
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return response(origin, 503, { error: "function_not_configured" });

  const verifier = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: authData, error: authError } = await verifier.auth.getUser();
  if (authError || !authData.user) return response(origin, 401, { error: "session_expired" });
  const userId = authData.user.id; // Request bodies never select deletion ownership.
  const admin = createClient(url, service, { auth: { persistSession: false } });
  let body: { action?: string; confirmation?: string; previewId?: string; backupDigest?: string } = {};
  try { body = await request.json(); } catch { return response(origin, 400, { error: "invalid_request" }); }

  if (body.action === "capability") return response(origin, 200, { capability: capability() });
  if (body.action === "preview") {
    const records = await Promise.all(OWNED_TABLES.map((table) => countOwned(admin, table, userId)));
    const storage = await countStorage(admin, userId);
    const { count: privateCommunity, error: privateError } = await admin.from("community_submissions").select("*", { count: "exact", head: true }).eq("user_id", userId).not("status", "in", '("approved","published")');
    const { count: publicCommunity, error: publicError } = await admin.from("community_submissions").select("*", { count: "exact", head: true }).eq("user_id", userId).in("status", ["approved", "published"]);
    const blockers = [...capability().blockers, ...records.flatMap((item) => item.blocker ? [item.blocker] : []), ...storage.flatMap((item) => item.blocker ? [item.blocker] : [])];
    if (privateError || publicError) blockers.push("community_inventory_unverified");
    const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS).toISOString();
    const previewSource = JSON.stringify({ userId, records: records.map(({ table, count }) => [table, count]), storage: storage.map(({ bucket, count }) => [bucket, count]), privateCommunity, publicCommunity, expiresAt });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(previewSource));
    const previewId = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return response(origin, 200, { preview: { previewId, expiresAt, records, storage, community: { privateDelete: privateCommunity || 0, publicAnonymize: publicCommunity || 0 }, blockers: [...new Set(blockers)], warnings: publicCommunity ? ["Published contributions would be retained only after anonymization."] : [], writeFree: true } });
  }

  if (body.action === "execute") {
    // Fail closed until a server-verifiable recent-auth challenge, backup challenge,
    // schema inventory, Storage inventory, and disposable-account run are complete.
    if (body.confirmation !== CONFIRMATION) return response(origin, 400, { error: "confirmation_mismatch" });
    return response(origin, 503, { error: "account_deletion_not_verified", capability: capability(), retryable: false });
  }
  return response(origin, 400, { error: "unknown_action" });
});
