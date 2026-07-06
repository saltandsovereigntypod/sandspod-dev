/* =========================================================
   OBJECT INSTANCES
   Tracks placed/created objects once they physically exist
   ========================================================= */

const OBJECT_INSTANCES_TABLE = "object_instances";

function getObjectInstanceUser() {
  if (typeof getUser === "function") return getUser();
  if (typeof currentUser !== "undefined") return currentUser;
  return null;
}

function addDaysToNow(days) {
  if (!days) return null;

  const date = new Date();
  date.setDate(date.getDate() + Number(days));

  return date.toISOString();
}

function getDefaultLifecycleForObject(type = "", subtype = "") {
  const normalizedType = String(type || "").toLowerCase();
  const normalizedSubtype = String(subtype || "").toLowerCase();

  if (normalizedType === "candle") {
    return {
      expiration_enabled: false,
      tending_enabled: false,
      tending_interval_days: null,
      expires_at: null,
      tending_due_at: null
    };
  }

  if (
    normalizedSubtype.includes("oil") ||
    normalizedSubtype.includes("tincture") ||
    normalizedSubtype.includes("spray")
  ) {
    return {
      expiration_enabled: true,
      tending_enabled: false,
      tending_interval_days: null,
      expires_at: addDaysToNow(180),
      tending_due_at: null
    };
  }

  if (
    normalizedSubtype.includes("spell jar") ||
    normalizedSubtype.includes("sachet") ||
    normalizedSubtype.includes("poppet") ||
    normalizedSubtype.includes("charm")
  ) {
    return {
      expiration_enabled: false,
      tending_enabled: true,
      tending_interval_days: 30,
      expires_at: null,
      tending_due_at: addDaysToNow(30)
    };
  }

  if (
    normalizedType === "herb" ||
    normalizedSubtype.includes("herb") ||
    normalizedSubtype.includes("powder") ||
    normalizedSubtype.includes("incense")
  ) {
    return {
      expiration_enabled: true,
      tending_enabled: false,
      tending_interval_days: null,
      expires_at: addDaysToNow(90),
      tending_due_at: null
    };
  }

  return {
    expiration_enabled: false,
    tending_enabled: false,
    tending_interval_days: null,
    expires_at: null,
    tending_due_at: null
  };
}

async function createObjectInstance(instance = {}) {
  const user = getObjectInstanceUser();

  if (!user || typeof db === "undefined") return null;

  const lifecycle = getDefaultLifecycleForObject(
    instance.object_type,
    instance.subtype
  );

  const row = {
    user_id: user.id,

    entity_id: instance.entity_id || null,
    source: instance.source || "altar",
    instance_type: instance.instance_type || "placed_object",

    name: instance.name || "Untitled Object",
    object_type: instance.object_type || "",
    subtype: instance.subtype || "",

    status: instance.status || "active",

    started_at: instance.started_at || new Date().toISOString(),
    expires_at: instance.expires_at ?? lifecycle.expires_at,
    expiration_enabled:
      instance.expiration_enabled ?? lifecycle.expiration_enabled,

    tending_due_at: instance.tending_due_at ?? lifecycle.tending_due_at,
    tending_enabled: instance.tending_enabled ?? lifecycle.tending_enabled,
    tending_interval_days:
      instance.tending_interval_days ?? lifecycle.tending_interval_days,

    remaining_amount: instance.remaining_amount ?? null,
    amount_unit: instance.amount_unit || "",

    remaining_burn_seconds: instance.remaining_burn_seconds ?? null,
    total_burn_seconds: instance.total_burn_seconds ?? null,

    altar_object_key: instance.altar_object_key || "",
    altar_save_id: instance.altar_save_id || null,
    apothecary_item_id: instance.apothecary_item_id || "",

    metadata: instance.metadata || {},
    updated_at: new Date().toISOString()
  };

  const { data, error } = await db
    .from(OBJECT_INSTANCES_TABLE)
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error("Object instance create failed:", error);
    return null;
  }

  return data;
}

async function updateObjectInstance(instanceId, updates = {}) {
  const user = getObjectInstanceUser();

  if (!user || typeof db === "undefined" || !instanceId) return null;

  const { data, error } = await db
    .from(OBJECT_INSTANCES_TABLE)
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq("id", instanceId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Object instance update failed:", error);
    return null;
  }

  return data;
}

async function getObjectInstance(instanceId) {
  const user = getObjectInstanceUser();

  if (!user || typeof db === "undefined" || !instanceId) return null;

  const { data, error } = await db
    .from(OBJECT_INSTANCES_TABLE)
    .select("*")
    .eq("id", instanceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Object instance load failed:", error);
    return null;
  }

  return data;
}

async function getObjectInstancesByEntity(entityId) {
  const user = getObjectInstanceUser();

  if (!user || typeof db === "undefined" || !entityId) return [];

  const { data, error } = await db
    .from(OBJECT_INSTANCES_TABLE)
    .select("*")
    .eq("user_id", user.id)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Object instances load failed:", error);
    return [];
  }

  return data || [];
}

window.createObjectInstance = createObjectInstance;
window.updateObjectInstance = updateObjectInstance;
window.getObjectInstance = getObjectInstance;
window.getObjectInstancesByEntity = getObjectInstancesByEntity;