/* =========================================================
   RITUALS IN THE LIVING LIBRARY
   Routes ritual journals and templates into the unified knowledge graph.
   ========================================================= */

function getRitualLivingLibraryEntityId(kind, recordId) {
  return `${kind}:${recordId}`;
}

async function persistRitualLivingLibraryEntity(entity) {
  if (!entity) return null;

  if (typeof saveLivingLibraryEntityToSupabase === "function") {
    await saveLivingLibraryEntityToSupabase(entity.id);
  }

  return entity;
}

async function upsertRitualTemplateLivingLibraryEntity(user, templateData) {
  if (typeof Library === "undefined") {
    throw new Error("The Living Library is not available.");
  }

  const entityId = getRitualLivingLibraryEntityId("ritual-template", templateData.id);
  const existing = Library.getEntity(entityId);
  const myPractice = {
    EntryType: "Ritual Template",
    Purpose: templateData.intention || "",
    Preparation: templateData.preparation || "",
    Closing: templateData.closing || "",
    EstimatedDurationSeconds: Number(templateData.estimated_duration_seconds || 0),
    LinkedAltarId: templateData.linked_altar_id || "",
    RitualTemplateId: templateData.id,
    Status: templateData.status || "active"
  };

  const metadata = {
    ...(existing?.metadata || {}),
    ritualTemplateId: templateData.id,
    recordType: "ritual_template",
    editor: "ritual-template-editor"
  };

  const entity = existing
    ? Library.updateEntity(entityId, {
        name: templateData.title || "Untitled Ritual Template",
        type: "ritual_template",
        myPractice,
        metadata
      })
    : Library.createEntity({
        id: entityId,
        name: templateData.title || "Untitled Ritual Template",
        type: "ritual_template",
        myPractice,
        metadata
      });

  await persistRitualLivingLibraryEntity(entity);
  return entity;
}

async function upsertRitualJournalLivingLibraryEntity(user, ritual, formValues = {}, summary = {}) {
  if (typeof Library === "undefined") {
    throw new Error("The Living Library is not available.");
  }

  const entityId = getRitualLivingLibraryEntityId("ritual", ritual.id);
  const existing = Library.getEntity(entityId);
  const altarItems = (summary.objects || []).map((item) => item.label).filter(Boolean);

  const myPractice = {
    EntryType: "Ritual Journal",
    Date: ritual.ritual_date || "",
    DayOfWeek: ritual.day_of_week || "",
    TimeOfDay: ritual.time_of_day || "",
    MoonPhase: ritual.moon_phase || "",
    DurationSeconds: Number(ritual.duration_seconds || 0),
    Intention: ritual.intention || "",
    FeelingsBefore: ritual.feelings_before || "",
    WhatHappenedDuring: ritual.what_happened_during || "",
    FeelingsDuring: ritual.feelings_during || "",
    SignsAndSymbols: ritual.signs_and_symbols || "",
    WhatHappenedAfter: ritual.what_happened_after || "",
    FeelingsAfter: ritual.feelings_after || "",
    DreamsAndFollowUp: ritual.dreams_and_follow_up || "",
    Results: ritual.results || "",
    ChangesForNextTime: ritual.changes_for_next_time || "",
    Notes: ritual.notes || "",
    AltarItems: altarItems,
    RitualId: ritual.id,
    SessionId: ritual.session_id || "",
    RitualTemplateId: ritual.template_id || "",
    LinkedAltarId: ritual.linked_altar_id || ""
  };

  const metadata = {
    ...(existing?.metadata || {}),
    ritualId: ritual.id,
    sessionId: ritual.session_id || null,
    ritualTemplateId: ritual.template_id || null,
    recordType: "ritual_journal",
    source: ritual.source || "digital_altar"
  };

  const entity = existing
    ? Library.updateEntity(entityId, {
        name: ritual.title || "Untitled Ritual",
        type: "ritual",
        myPractice,
        metadata
      })
    : Library.createEntity({
        id: entityId,
        name: ritual.title || "Untitled Ritual",
        type: "ritual",
        myPractice,
        metadata
      });

  await persistRitualLivingLibraryEntity(entity);

  const linkedEntityIds = new Set(
    (summary.objects || []).map((item) => item.entityId).filter(Boolean)
  );

  for (const linkedEntityId of linkedEntityIds) {
    if (!Library.getEntity(linkedEntityId)) continue;
    Library.connect(entity.id, LIBRARY_RELATIONS.CONTAINS, linkedEntityId);

    if (typeof saveLivingLibraryRelationToSupabase === "function") {
      await saveLivingLibraryRelationToSupabase(
        entity.id,
        LIBRARY_RELATIONS.CONTAINS,
        linkedEntityId,
        { source: "ritual_journal", ritualId: ritual.id }
      );
    }
  }

  if (ritual.template_id) {
    const templateEntityId = getRitualLivingLibraryEntityId("ritual-template", ritual.template_id);
    if (Library.getEntity(templateEntityId)) {
      Library.connect(entity.id, LIBRARY_RELATIONS.RELATED_TO, templateEntityId);

      if (typeof saveLivingLibraryRelationToSupabase === "function") {
        await saveLivingLibraryRelationToSupabase(
          entity.id,
          LIBRARY_RELATIONS.RELATED_TO,
          templateEntityId,
          { source: "ritual_template" }
        );
      }
    }
  }

  return entity;
}

// The legacy helper names are retained because the existing save flows call them.
// They now create Living Library entities and intentionally return null instead
// of a grimoire_pages UUID.
if (typeof ensureRitualTemplateGrimoirePage === "function") {
  ensureRitualTemplateGrimoirePage = async function routeTemplateToLivingLibrary(user, templateData) {
    await upsertRitualTemplateLivingLibraryEntity(user, templateData);
    return null;
  };
}

if (typeof ensureRitualJournalGrimoirePage === "function") {
  ensureRitualJournalGrimoirePage = async function routeJournalToLivingLibrary(user, ritual, formValues, summary) {
    await upsertRitualJournalLivingLibraryEntity(user, ritual, formValues, summary);
    return null;
  };
}
