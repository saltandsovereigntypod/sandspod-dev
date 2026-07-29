import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const defaultOrigins = [
  "https://saltandsovereignty.com",
  "https://www.saltandsovereignty.com",
  "https://dev.saltandsovereignty.com",
  "https://saltandsovereigntypod.github.io"
];
const allowedOrigins = new Set([...(Deno.env.get("ACCOUNT_DELETE_ALLOWED_ORIGINS") || "").split(",").map((value) => value.trim()).filter(Boolean), ...defaultOrigins]);
const childTables = ["ritual_links", "ritual_session_steps", "ritual_template_steps", "grimoire_page_links", "grimoire_blocks", "library_relations", "object_instance_events", "community_submission_messages"];
const parentTables = ["user_rituals", "ritual_sessions", "ritual_templates", "grimoire_pages", "grimoire_sections", "grimoire_books", "object_instances", "living_library_entries", "apothecary_items", "saved_altars", "custom_altar_backgrounds", "custom_cabinet_items", "custom_cabinet_image_overrides", "user_settings"];

function response(origin: string, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "POST, OPTIONS", "vary": "Origin" } });
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
  const userId = authData.user.id;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const completed: string[] = [];

  try {
    // Approved public submissions remain but lose attribution. Draft, pending,
    // and rejected submissions are private user data and are removed.
    const { data: privateSubmissions, error: privateLookupError } = await admin.from("community_submissions").select("id").eq("user_id", userId).not("status", "in", '("approved","published")');
    if (privateLookupError) throw new Error("community_inventory_failed");
    const privateSubmissionIds = (privateSubmissions || []).map((submission) => submission.id);
    if (privateSubmissionIds.length) {
      const { error: privateMessageError } = await admin.from("community_submission_messages").delete().in("submission_id", privateSubmissionIds);
      if (privateMessageError) throw new Error("community_message_cleanup_failed");
    }
    const { error: anonymizeError } = await admin.from("community_submissions").update({ user_id: null, display_name: null, display_as: "anonymous", anonymous: true }).eq("user_id", userId).in("status", ["approved", "published"]);
    if (anonymizeError) throw new Error("community_anonymization_failed");
    const { error: submissionError } = await admin.from("community_submissions").delete().eq("user_id", userId).not("status", "in", '("approved","published")');
    if (submissionError) throw new Error("community_cleanup_failed");
    completed.push("community_policy");

    for (const table of [...childTables, ...parentTables]) {
      const { error } = await admin.from(table).delete().eq("user_id", userId);
      if (error) throw new Error(`${table}_cleanup_failed`);
      completed.push(table);
    }

    const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
    if (bucketError) throw new Error("storage_inventory_failed");
    for (const bucket of buckets || []) {
      const { data: objects, error: listError } = await admin.storage.from(bucket.name).list(userId, { limit: 1000 });
      if (listError) throw new Error("storage_list_failed");
      const paths = (objects || []).map((object) => `${userId}/${object.name}`);
      if (paths.length) {
        const { error: removeError } = await admin.storage.from(bucket.name).remove(paths);
        if (removeError) throw new Error("storage_remove_failed");
      }
    }
    completed.push("storage");

    // Authentication is deliberately deleted last. Retrying before this stage
    // is safe because scoped deletes and anonymization are idempotent.
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
    if (deleteAuthError) throw new Error("auth_delete_failed");
    completed.push("auth_user");
    return response(origin, 200, { complete: true, completed });
  } catch (error) {
    console.error("Account deletion stopped", { stage: error instanceof Error ? error.message : "unknown", completedCount: completed.length });
    return response(origin, 500, { complete: false, error: "deletion_incomplete", completed });
  }
});
