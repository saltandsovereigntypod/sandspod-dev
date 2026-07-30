(function initializeLivingLibraryReconciliation(global) {
  "use strict";

  const STRONG_FIELDS = Object.freeze([
    ["ritual-template", ["RitualTemplateId", "ritualTemplateId", "ritual_template_id", "templateId"]],
    ["ritual", ["RitualId", "ritualId", "ritual_id"]],
    ["apothecary", ["ApothecaryItemId", "apothecaryItemId", "apothecary_item_id"]],
    ["traditional", ["TraditionalId", "traditionalId", "traditional_id", "canonicalSourceId"]],
    ["object-source", ["ObjectInstanceId", "objectInstanceId", "object_instance_id"]],
    ["migration", ["migrationFingerprint", "legacyMigrationFingerprint"]]
  ]);

  function plain(value) { return value && typeof value === "object" && !Array.isArray(value); }
  function walk(value, output = {}) {
    if (!plain(value)) return output;
    for (const [key, child] of Object.entries(value)) {
      if (child !== "" && child != null && typeof child !== "object" && output[key] == null) output[key] = String(child);
      if (plain(child)) walk(child, output);
    }
    return output;
  }

  function stableIdentity(entry) {
    const values = walk({ ...(entry.my_practice || {}), ...(entry.metadata || {}), ...(entry.layout || {}) });
    for (const [kind, fields] of STRONG_FIELDS) {
      const field = fields.find((candidate) => values[candidate]);
      if (field) return { kind, value: values[field], field, evidence: `${field} matches a stable source record` };
    }
    const entityId = String(entry.entity_id || entry.id || "");
    if (/^(?:ritual|ritual-template|apothecary|traditional|cabinet-item):[^:]+$/i.test(entityId)) {
      const [kind, ...rest] = entityId.split(":");
      return { kind, value: rest.join(":"), field: "entity_id", evidence: "Deterministic canonical entity ID" };
    }
    if (entry.source_type && entry.source_id) return { kind: String(entry.source_type), value: String(entry.source_id), field: "source_id", evidence: "Source type and source ID match" };
    return null;
  }

  function comparable(entry) {
    return JSON.stringify({ type: entry.type || "", image: entry.image || "", my_practice: entry.my_practice || {}, community: entry.community || {} });
  }

  function richness(entry) {
    const authored = JSON.stringify({ my_practice: entry.my_practice || {}, community: entry.community || {}, image: entry.image || "" });
    return authored.replace(/[{}\[\],:\"\s]/g, "").length;
  }

  function chooseSurvivor(entries, identity) {
    return [...entries].sort((left, right) => {
      const expected = `${identity.kind}:${identity.value}`;
      const canonicalDifference = Number(String(right.entity_id) === expected) - Number(String(left.entity_id) === expected);
      if (canonicalDifference) return canonicalDifference;
      const richnessDifference = richness(right) - richness(left);
      if (richnessDifference) return richnessDifference;
      return String(left.created_at || left.entity_id || left.id).localeCompare(String(right.created_at || right.entity_id || right.id));
    })[0];
  }

  function authoredConflict(entries) {
    const valuesByPath = new Map();
    function collect(value, path = "") {
      if (!plain(value)) return;
      for (const [key, child] of Object.entries(value)) {
        const nextPath = path ? `${path}.${key}` : key;
        if (plain(child)) collect(child, nextPath);
        else if (child !== "" && child != null && !Array.isArray(child)) valuesByPath.set(nextPath, new Set([...(valuesByPath.get(nextPath) || []), JSON.stringify(child)]));
      }
    }
    entries.forEach((entry) => collect({ my_practice: entry.my_practice || {}, community: entry.community || {} }));
    return [...valuesByPath.values()].some((values) => values.size > 1);
  }

  function relationAudit(relations = []) {
    const groups = new Map();
    for (const relation of relations) {
      const key = [relation.user_id || "", relation.from_entity_id, relation.relation, relation.to_entity_id, JSON.stringify(relation.metadata || {})].join("|");
      groups.set(key, [...(groups.get(key) || []), relation]);
    }
    return [...groups.entries()].filter(([, rows]) => rows.length > 1).map(([key, rows]) => ({ key, classification: "relationship-only-duplicate", count: rows.length, ids: rows.map((row) => row.id).filter(Boolean), evidence: "Same owner, direction, relation type, endpoints, and metadata" }));
  }

  function audit(entries = [], relations = [], userId = "") {
    const owned = entries.filter((entry) => !userId || entry.user_id === userId);
    const strong = new Map(); const names = new Map();
    for (const entry of owned) {
      const identity = stableIdentity(entry);
      if (identity) {
        const key = `${identity.kind}:${identity.value}`;
        strong.set(key, { identity, entries: [...(strong.get(key)?.entries || []), entry] });
      }
      const nameKey = `${String(entry.type || "").toLowerCase()}|${String(entry.name || "").trim().toLowerCase()}`;
      if (entry.name) names.set(nameKey, [...(names.get(nameKey) || []), entry]);
    }

    const groups = [...strong.entries()].filter(([, group]) => group.entries.length > 1).map(([key, group]) => {
      const conflict = authoredConflict(group.entries);
      const exact = new Set(group.entries.map(comparable)).size === 1;
      const survivor = chooseSurvivor(group.entries, group.identity);
      return {
        key,
        classification: conflict ? "manual-review-required" : exact ? "exact-duplicate" : "canonical-identity-collision",
        evidence: [group.identity.evidence, `Same current user (${group.entries.length} records)`],
        survivorId: survivor.entity_id || survivor.id,
        survivorReason: String(survivor.entity_id) === key ? "Already uses deterministic identity" : "Richest compatible authored record, then oldest stable record",
        retireIds: group.entries.filter((entry) => entry !== survivor).map((entry) => entry.entity_id || entry.id),
        entries: group.entries
      };
    });

    const strongIds = new Set(groups.flatMap((group) => group.entries.map((entry) => entry.entity_id || entry.id)));
    const possible = [...names.entries()].filter(([, rows]) => rows.length > 1).map(([key, rows]) => ({ key, classification: "possible-duplicate", count: rows.length, ids: rows.map((row) => row.entity_id || row.id), evidence: "Name and type match only; records remain distinct" })).filter((group) => !group.ids.every((id) => strongIds.has(id)));
    return { groups, possible, relationshipDuplicates: relationAudit(relations.filter((relation) => !userId || relation.user_id === userId)), writesApplied: false };
  }

  function buildPlan(auditResult, dependencies = {}) {
    const eligible = auditResult.groups.filter((group) => ["exact-duplicate", "canonical-identity-collision"].includes(group.classification));
    const blockers = auditResult.groups.filter((group) => group.classification === "manual-review-required").map((group) => ({ group: group.key, reason: "Conflicting authored content" }));
    const redirects = eligible.map((group) => ({ survivorId: group.survivorId, retireIds: group.retireIds, relations: [], objectInstances: [], ritualLinks: [], altarReferences: [] }));
    for (const redirect of redirects) {
      const retired = new Set(redirect.retireIds);
      redirect.relations = (dependencies.relations || []).filter((row) => retired.has(row.from_entity_id) || retired.has(row.to_entity_id));
      redirect.objectInstances = (dependencies.objectInstances || []).filter((row) => retired.has(row.entity_id));
      redirect.ritualLinks = (dependencies.ritualLinks || []).filter((row) => retired.has(row.entity_id));
    }
    const source = JSON.stringify({ eligible: eligible.map((group) => [group.key, group.survivorId, group.retireIds]), redirects, blockers });
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
    return { digest: `reconcile-${(hash >>> 0).toString(16).padStart(8, "0")}`, eligible, redirects, blockers, before: auditResult.groups.reduce((sum, group) => sum + group.entries.length, 0), after: auditResult.groups.length, writesApplied: false };
  }

  async function scan(database, user) {
    if (!user?.id) throw new Error("Sign in before scanning Living Library health.");
    const [entryResult, relationResult, instanceResult, ritualLinkResult] = await Promise.all([
      database.from("living_library_entries").select("*").eq("user_id", user.id),
      database.from("library_relations").select("*").eq("user_id", user.id),
      database.from("object_instances").select("id,entity_id,user_id").eq("user_id", user.id),
      database.from("ritual_links").select("id,entity_id,user_id").eq("user_id", user.id)
    ]);
    const failed = [entryResult, relationResult, instanceResult, ritualLinkResult].find((result) => result.error);
    if (failed) throw new Error("Living Library health could not be scanned safely.");
    const result = audit(entryResult.data || [], relationResult.data || [], user.id);
    return { ...result, plan: buildPlan(result, { relations: relationResult.data || [], objectInstances: instanceResult.data || [], ritualLinks: ritualLinkResult.data || [] }) };
  }

  const api = { STRONG_FIELDS, stableIdentity, relationAudit, audit, chooseSurvivor, buildPlan, scan };
  global.LivingLibraryReconciliation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
