/* =========================================================
   COMPANION PANEL
   Single rendering authority for altar objects, lifecycle state,
   activity history, actions, and Living Library knowledge.
   ========================================================= */

(function initializeCompanion() {
  if (typeof altarCompanionPanel === "undefined" || !altarCompanionPanel) return;

  const companionHeader = altarCompanionPanel.querySelector(".altar-companion-header");
  const companionContent = altarCompanionPanel.querySelector("[data-companion-content]");
  const NON_KNOWLEDGE_FIELDS = new Set([
    "tags", "displayname", "name", "title", "category", "type",
    "candledressings", "dressings", "group", "groups", "groupid",
    "currentritual", "currentritualid", "currentritualname",
    "burntime", "totalburnms", "currentburnstartedat",
    "lastlit", "lastlitat", "lastburned", "lastburnedat", "burnhistory",
    "status", "lifecyclestatus"
  ]);

  let currentCompanionObject = null;
  let currentCompanionEntity = null;
  let currentCompanionInstance = null;
  let currentCompanionEvents = [];
  let currentCompanionEntityEvents = [];
  let currentCompanionConnections = null;
  let renderRequestId = 0;

  function escapeCompanionHtml(value = "") {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function humanizeCompanionKey(value = "") {
    return String(value || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatCompanionDate(value, short = false) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString(undefined, {
      month: short ? "short" : "long",
      day: "numeric",
      year: "numeric"
    });
  }

  function formatRelativeDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const days = Math.round((target.getTime() - today.getTime()) / 86400000);

    if (days < 0) {
      const overdue = Math.abs(days);
      return `${overdue} day${overdue === 1 ? "" : "s"} overdue`;
    }

    if (days === 0) return "due today";
    if (days === 1) return "due tomorrow";
    return `in ${days} days`;
  }

  function getSectionStateKey(title) {
    return `saltAndSovereigntyCompanion:${String(title || "section").toLowerCase()}`;
  }

  function getSavedSectionState(title, defaultOpen = false) {
    const saved = localStorage.getItem(getSectionStateKey(title));
    return saved === null ? defaultOpen : saved === "true";
  }

  function saveSectionState(title, isOpen) {
    localStorage.setItem(getSectionStateKey(title), String(isOpen));
  }

  function getSettings() {
    return typeof getCompanionDisplaySettings === "function"
      ? getCompanionDisplaySettings()
      : {};
  }

  function getEntityForObject(object) {
    return typeof getLibraryEntityForObject === "function"
      ? getLibraryEntityForObject(object)
      : null;
  }

  function getObjectIdentity(object, entity = null) {
    const rawType = String(
      object?.dataset.apothecaryType ||
      object?.dataset.type ||
      entity?.type ||
      "entry"
    ).toLowerCase();

    if (rawType.includes("spell jar") || rawType.includes("spell-jar")) return "spell-jar";
    if (rawType.includes("herb mix") || rawType.includes("herb-mix")) return "herb-blend";
    if (rawType.includes("candle")) return "candle";
    if (rawType.includes("crystal")) return "crystal";
    if (rawType.includes("herb")) return "herb";
    if (rawType.includes("oil")) return "oil";
    if (rawType.includes("incense")) return "incense";
    if (rawType.includes("sachet")) return "sachet";
    if (rawType.includes("spray")) return "spray";
    if (rawType.includes("poppet")) return "poppet";
    if (rawType.includes("deity")) return "deity";
    return rawType.replace(/[^a-z0-9]+/g, "-") || "entry";
  }

  function getHeaderDescriptor(object, entity, identity) {
    const label = object?.dataset.label || entity?.name || "Companion";
    const icon = object && typeof getObjectIcon === "function" ? getObjectIcon(object) : "✦";
    const typeLabel = object && typeof getObjectTypeLabel === "function"
      ? getObjectTypeLabel(object)
      : entity?.type || "entry";
    const form = object?.dataset.form && object.dataset.form !== "standard"
      ? object.dataset.form
      : "";

    const base = { label, icon, typeLabel, secondaryLabel: form, identity, emphasis: [] };

    const hooks = {
      herb: renderHerbHeader,
      crystal: renderCrystalHeader,
      "spell-jar": renderSpellJarHeader,
      candle: renderCandleHeader,
      oil: renderOilHeader
    };

    return hooks[identity] ? hooks[identity](base) : base;
  }

  function renderHerbHeader(header) {
    return { ...header, divider: "botanical", emphasis: ["Correspondences", "Planet", "Element", "Best Uses"] };
  }

  function renderCrystalHeader(header) {
    return { ...header, divider: "crystal", emphasis: ["Correspondences", "Charging", "Cleansing", "Uses"] };
  }

  function renderSpellJarHeader(header) {
    return { ...header, divider: "alchemy", emphasis: ["Ingredients", "Intention", "Creation Date", "Activation History"] };
  }

  function renderCandleHeader(header) {
    return { ...header, divider: "candle", emphasis: ["Color", "Burn State", "Remaining Burn", "Flame History"] };
  }

  function renderOilHeader(header) {
    return { ...header, divider: "alchemy", emphasis: ["Ingredients", "Recipe", "Shelf Life"] };
  }

  function renderLifecycleMarkup(instance) {
    if (!instance) return "";

    const status = String(instance.status || "active").toLowerCase();
    const created = formatCompanionDate(instance.started_at, true);
    const nextTending = instance.tending_enabled && instance.tending_due_at
      ? formatCompanionDate(instance.tending_due_at, true)
      : "";
    const tendingRelative = nextTending ? formatRelativeDate(instance.tending_due_at) : "";
    const expires = instance.expiration_enabled && instance.expires_at
      ? formatCompanionDate(instance.expires_at, true)
      : "";
    const expiresRelative = expires ? formatRelativeDate(instance.expires_at) : "";

    const measures = [];

    if (instance.remaining_amount !== null && instance.remaining_amount !== undefined) {
      measures.push(`${instance.remaining_amount}${instance.amount_unit ? ` ${instance.amount_unit}` : ""} remaining`);
    }

    if (instance.remaining_burn_seconds !== null && instance.remaining_burn_seconds !== undefined) {
      const totalMinutes = Math.max(0, Math.round(Number(instance.remaining_burn_seconds) / 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      measures.push(`${hours ? `${hours}h ` : ""}${minutes}m burn remaining`);
    }

    return `
      <div class="companion-v3-lifecycle" data-companion-lifecycle>
        <div class="companion-v3-lifecycle-primary">
          <span class="companion-v3-status-chip is-${escapeCompanionHtml(status)}">${escapeCompanionHtml(status)}</span>
          ${created ? `<span>Created ${escapeCompanionHtml(created)}</span>` : ""}
        </div>

        ${nextTending ? `
          <p>
            <strong>Next tending</strong>
            <span>${escapeCompanionHtml(nextTending)}${tendingRelative ? ` · ${escapeCompanionHtml(tendingRelative)}` : ""}</span>
          </p>
        ` : ""}

        ${expires ? `
          <p>
            <strong>Review or replace</strong>
            <span>${escapeCompanionHtml(expires)}${expiresRelative ? ` · ${escapeCompanionHtml(expiresRelative)}` : ""}</span>
          </p>
        ` : ""}

        ${measures.map((measure) => `<p><strong>Current state</strong><span>${escapeCompanionHtml(measure)}</span></p>`).join("")}
      </div>
    `;
  }

  function renderHeader(object, entity, instance = null) {
    if (!companionHeader) return;

    const identity = getObjectIdentity(object, entity);
    const descriptor = getHeaderDescriptor(object, entity, identity);
    const heading = companionHeader.querySelector("h2");
    const headerHost = companionHeader.querySelector("div") || companionHeader;

    altarCompanionPanel.dataset.companionIdentity = identity;
    altarCompanionPanel.dataset.companionDivider = descriptor.divider || "standard";

    if (heading) heading.textContent = `${descriptor.icon} ${descriptor.label}`.trim();

    let tags = companionHeader.querySelector("[data-companion-header-tags]");
    if (!tags) {
      tags = document.createElement("div");
      tags.className = "companion-v3-header-tags";
      tags.setAttribute("data-companion-header-tags", "");
      headerHost.appendChild(tags);
    }

    const normalizeTag = (value) => String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const titleKey = normalizeTag(descriptor.label);
    const primaryTag = String(descriptor.typeLabel || "").trim();
    const primaryKey = normalizeTag(primaryTag);
    const secondaryTag = String(descriptor.secondaryLabel || "").trim();
    const secondaryKey = normalizeTag(secondaryTag);
    const headerTags = [primaryTag];

    if (secondaryKey && !` ${primaryKey} `.includes(` ${secondaryKey} `)) {
      headerTags.push(secondaryTag);
    }

    tags.innerHTML = headerTags
      .filter(Boolean)
      .filter((label) => normalizeTag(label) !== titleKey)
      .filter((label, index, labels) => labels.findIndex((item) => normalizeTag(item) === normalizeTag(label)) === index)
      .map((label) => `<span>${escapeCompanionHtml(label)}</span>`)
      .join("");
    tags.hidden = !tags.innerHTML;

    let emphasis = companionHeader.querySelector("[data-companion-emphasis]");
    if (!emphasis) {
      emphasis = document.createElement("div");
      emphasis.className = "companion-v3-emphasis";
      emphasis.setAttribute("data-companion-emphasis", "");
      headerHost.appendChild(emphasis);
    }

    emphasis.innerHTML = descriptor.emphasis
      .map((label) => `<span>${escapeCompanionHtml(label)}</span>`)
      .join("");
    emphasis.hidden = !descriptor.emphasis.length;

    companionHeader.querySelector("[data-companion-lifecycle]")?.remove();

    if (instance) {
      const template = document.createElement("template");
      template.innerHTML = renderLifecycleMarkup(instance);
      if (template.content.firstElementChild) {
        headerHost.appendChild(template.content.firstElementChild);
      }
    }
  }

  function createDetailsMarkup(title, html, defaultOpen = false, extraClass = "") {
    if (!html || !String(html).trim()) return "";

    return `
      <details
        class="companion-v3-section ${extraClass}"
        data-companion-v3-section="${escapeCompanionHtml(title)}"
        ${getSavedSectionState(title, defaultOpen) ? "open" : ""}>
        <summary>${escapeCompanionHtml(title)}</summary>
        <div class="companion-v3-section-body">${html}</div>
      </details>
    `;
  }

  function formatCompanionValue(value) {
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (item && typeof item === "object") {
            const amount = item.amount ? `${item.amount} ` : "";
            return `${amount}${item.libraryName || item.label || item.name || "Item"}`.trim();
          }
          return item;
        })
        .filter(Boolean)
        .join(", ");
    }

    if (value && typeof value === "object") {
      return value.label || value.name || JSON.stringify(value);
    }

    return String(value ?? "");
  }

  function getFieldCategory(key = "") {
    const normalized = String(key).replaceAll("_", "").toLowerCase();
    const categories = {
      meaning: "meanings",
      meanings: "meanings",
      uses: "uses",
      bestuses: "uses",
      domains: "uses",
      purpose: "uses",
      element: "correspondences",
      planet: "correspondences",
      chakra: "correspondences",
      pantheon: "correspondences",
      correspondences: "correspondences",
      ingredients: "ingredients",
      recipe: "ingredients",
      intention: "intentions",
      intentions: "intentions",
      pairswith: "pairings",
      bestwith: "pairings",
      substitutions: "substitutions",
      traditionalwarnings: "warnings",
      warnings: "warnings",
      grimoirestatus: "grimoire",
      candledressings: "dressings",
      groups: "groups",
      notes: "notes",
      sources: "sources",
      source: "sources"
    };
    return categories[normalized] || "notes";
  }

  function shouldShowLayer(settings, layer) {
    return settings[`library_${layer}_enabled`] !== false;
  }

  function shouldShowField(settings, layer, key) {
    return settings[`library_${layer}_${getFieldCategory(key)}`] !== false;
  }

  function getRelationshipBackedFields(entity) {
    const fields = new Set();
    if (!entity?.id || typeof Library === "undefined" || typeof Library.getConnections !== "function") {
      return fields;
    }

    (Library.getConnections(entity.id) || []).forEach((connection) => {
      if (connection.from !== entity.id) return;
      if (connection.relation === "pairs_with") fields.add("pairswith");
      if (connection.relation === "substitutes") fields.add("substitutions");
    });
    return fields;
  }

  function renderJournalFields(data = {}, layer, settings, excludedFields = new Set()) {
    const entries = Object.entries(data).filter(([key, value]) => {
      const normalizedKey = String(key).replaceAll("_", "").toLowerCase();
      if (
        NON_KNOWLEDGE_FIELDS.has(normalizedKey) ||
        excludedFields.has(normalizedKey) ||
        value === "" || value === null || value === undefined
      ) return false;
      if (Array.isArray(value) && !value.length) return false;
      return shouldShowField(settings, layer, key);
    });

    if (!entries.length) return "";

    return `<div class="companion-v3-journal-fields">
      ${entries.map(([key, value]) => `
        <section class="companion-v3-journal-field" data-companion-field="${escapeCompanionHtml(key)}">
          <h4>${escapeCompanionHtml(humanizeCompanionKey(key))}</h4>
          <div>${escapeCompanionHtml(formatCompanionValue(value))}</div>
        </section>
      `).join("")}
    </div>`;
  }

  function renderTraditional(entity, settings) {
    if (!entity || !shouldShowLayer(settings, "traditional")) return "";
    const fields = renderJournalFields(
      entity.traditional || {},
      "traditional",
      settings,
      getRelationshipBackedFields(entity)
    );
    return fields ? createDetailsMarkup("Traditional", fields, true, "companion-v3-traditional") : "";
  }

  function renderMyPractice(entity, settings) {
    if (!entity || !shouldShowLayer(settings, "myPractice")) return "";
    const fields = renderJournalFields(
      entity.myPractice || {},
      "myPractice",
      settings,
      getRelationshipBackedFields(entity)
    );
    return fields ? createDetailsMarkup("My Practice", fields, true, "companion-v3-my-practice") : "";
  }

  function renderCommunity(entity, settings) {
    if (!entity || !shouldShowLayer(settings, "community")) return "";
    const fields = renderJournalFields(
      entity.community || {},
      "community",
      settings,
      getRelationshipBackedFields(entity)
    );
    return fields ? createDetailsMarkup("Community Grimoire", fields, false, "companion-v3-community") : "";
  }

  function getRelationshipLabel(connection, entityId) {
    const isOutgoing = connection.from === entityId;

    if (connection.relation === "pairs_with") return "Pairs Well With";
    if (connection.relation === "substitutes") {
      return isOutgoing ? "Substituted By" : "Substitute For";
    }
    if (connection.relation === "substitute_for") {
      return isOutgoing ? "Substitute For" : "Substituted By";
    }

    if (typeof getReadableRelationLabel === "function") {
      return getReadableRelationLabel(connection, entityId);
    }
    return humanizeCompanionKey(connection.relation || "Related To");
  }

  function renderConnectionRelationships(model) {
    if (!model) return "";
    const pairings = model.pairings || [];
    const referenceGroups = (model.referenceGroups || []).filter((group) => group.key !== "relationships");
    if (!pairings.length && !referenceGroups.length) return "";

    return `
      <div class="companion-v3-connections" aria-label="Connected practice">
        ${pairings.length ? `
          <section>
            <h4>Frequently Used With</h4>
            <div class="companion-v3-relationship-chips">
              ${pairings.map((pairing) => `<button type="button" class="living-library-inline-link companion-v3-relationship-chip" data-open-library-entity="${escapeCompanionHtml(pairing.entityId)}">${escapeCompanionHtml(pairing.label)}</button>`).join("")}
            </div>
          </section>
        ` : ""}
        ${referenceGroups.length ? `
          <section>
            <h4>Appears Within</h4>
            <ul class="companion-v3-connection-counts">
              ${referenceGroups.map((group) => `<li><span>${escapeCompanionHtml(group.label)}</span><strong>${group.total}</strong></li>`).join("")}
            </ul>
          </section>
        ` : ""}
      </div>
    `;
  }

  function renderRelationships(entity, connectionModel = null) {
    if (!entity?.id || typeof Library === "undefined" || typeof Library.getConnections !== "function") return "";

    const connections = Library.getConnections(entity.id) || [];
    const groups = new Map();
    const seen = new Set();

    connections.forEach((connection) => {
      const outgoing = connection.from === entity.id;
      const otherId = outgoing ? connection.to : connection.from;
      const otherEntity = Library.getEntity(otherId);
      if (!otherEntity) return;

      const label = getRelationshipLabel(connection, entity.id);
      const uniqueKey = `${label}|${otherId}`;
      if (seen.has(uniqueKey)) return;
      seen.add(uniqueKey);

      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(otherEntity);
    });

    const relationshipBody = groups.size
      ? Array.from(groups.entries()).map(([label, entities]) => `
          <section class="companion-v3-relationship-group">
            <h4>${escapeCompanionHtml(label)}</h4>
            <div class="companion-v3-relationship-chips">
              ${entities.map((related) => `
                <button
                  type="button"
                  class="living-library-inline-link companion-v3-relationship-chip"
                  data-open-library-entity="${escapeCompanionHtml(related.id)}">
                  ${escapeCompanionHtml(related.name || "Untitled")}
                </button>
              `).join("")}
            </div>
          </section>
        `).join("")
      : "";
    const connectionBody = renderConnectionRelationships(connectionModel);
    const body = relationshipBody || connectionBody
      ? `${relationshipBody}${connectionBody}`
      : `<p class="altar-info-empty">No relationships recorded yet.</p>`;

    return createDetailsMarkup("Relationships", body, false, "companion-v3-relationships");
  }

  function getCandleBurnEvents(object) {
    if (object?.dataset.type !== "candle" || typeof getLivingObjectState !== "function") return [];
    const history = getLivingObjectState(object)?.candle?.burnHistory;
    if (!Array.isArray(history)) return [];

    return history.map((session) => {
      const durationMs = Math.max(0, Number(session.durationMs) || 0);
      const totalMinutes = Math.floor(durationMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const duration = hours
        ? `${hours} hr${hours === 1 ? "" : "s"}${minutes ? ` ${minutes} min` : ""}`
        : minutes
          ? `${minutes} min`
          : "Less than 1 minute";

      return {
        event_type: "candle_burn",
        event_label: "Candle Burned",
        event_notes: duration,
        occurred_at: session.endedAt || session.startedAt || "",
        metadata: { startedAt: session.startedAt || "", durationMs }
      };
    });
  }

  function getLivingWorkflowEvents(object) {
    if (!object || typeof getLivingObjectState !== "function") return [];
    const state = getLivingObjectState(object);
    const readable = (value) => humanizeCompanionKey(value || "").replace(/\b\w/g, (letter, index) => index ? letter.toLowerCase() : letter.toUpperCase());
    const convert = (records, type, label) => (records || []).map((record) => {
      const isCrystalCare = type === "crystal_cleansed" || type === "crystal_charged";
      const notes = isCrystalCare
        ? [
          record.purpose && `Purpose: ${readable(record.purpose)}`,
          record.methods?.length && `Method: ${record.methods.map(readable).join(", ")}`,
          record.intention && `Intention: ${record.intention}`,
          record.intentionHandling && `Intention state: ${readable(record.intentionHandling)}`,
          record.notes && `Reflection: ${record.notes}`
        ].filter(Boolean).join(" · ")
        : [record.purpose && readable(record.purpose), record.dedicatedTo, ...(record.items || []).map((item) => item.label || item), ...(record.methods || []).map(readable), record.intention && `“${record.intention}”`, record.status && `Status: ${readable(record.status)}`, record.perceivedResponse && `Perceived response: ${readable(record.perceivedResponse)}`, record.intentionHandling && readable(record.intentionHandling)].filter(Boolean).join(" · ");
      return {
        id: record.id || "",
        event_type: type,
        event_label: label,
        event_notes: notes,
        occurred_at: record.occurredAt || record.recordedAt || "",
        metadata: record
      };
    });
    return [
      ...convert(state?.crystal?.cleansingHistory, "crystal_cleansed", "Crystal Cleansed"),
      ...convert(state?.crystal?.chargingHistory, "crystal_charged", "Crystal Charged"),
      ...convert(state?.crystal?.dedicationDetails ? [state.crystal.dedicationDetails] : [], "crystal_dedicated", "Crystal Dedicated"),
      ...convert(state?.deity?.offerings, "offering_recorded", "Offering Recorded"),
      ...convert(state?.deity?.offeringStatusHistory, "offering_status_changed", "Offering Status Changed")
    ];
  }

  function mergeHistoryEvents(...sources) {
    const seenIds = new Set();
    const seenContent = new Set();
    const resolveEventTime = (event) => {
      const values = [event.occurred_at, event.completedAt, event.completed_at, event.endedAt, event.created_at, event.metadata?.occurredAt, event.metadata?.recordedAt];
      for (const value of values) { const time = Date.parse(value || ""); if (Number.isFinite(time)) return time; }
      return 0;
    };
    return sources
      .flat()
      .filter(Boolean)
      .filter((event) => {
        const contentKey = [
          event.event_type || "activity",
          event.occurred_at || "",
          event.event_label || "",
          event.event_notes || ""
        ].join("|");
        if ((event.id && seenIds.has(event.id)) || seenContent.has(contentKey)) return false;
        if (event.id) seenIds.add(event.id);
        seenContent.add(contentKey);
        return true;
      })
      .sort((a, b) => {
        const timeDifference = resolveEventTime(b) - resolveEventTime(a);
        if (timeDifference) return timeDifference;
        return String(a.id || `${a.event_type}|${a.event_label}`).localeCompare(String(b.id || `${b.event_type}|${b.event_label}`));
      });
  }

  function renderInstanceEvents(events = []) {
    if (!Array.isArray(events) || !events.length) {
      return `<p class="altar-info-empty">No activity recorded yet.</p>`;
    }

    return `
      <div class="companion-v3-event-list">
        ${events.map((event) => `
          <article class="companion-v3-event">
            <strong>${escapeCompanionHtml(event.event_label || humanizeCompanionKey(event.event_type || "Activity"))}</strong>
            <time datetime="${escapeCompanionHtml(event.occurred_at || "")}">${escapeCompanionHtml(formatCompanionDate(event.occurred_at, true))}</time>
            ${event.event_notes ? `<p>${escapeCompanionHtml(event.event_notes)}</p>` : ""}
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderConnectionHistory(model) {
    if (!model) return "";
    const crossSystemEvents = (model.recentEvents || []).filter((event) =>
      ["ritual", "ritual_template", "apothecary", "grimoire_page", "grimoire_block"].includes(event.source)
    );
    if (!model.summary.length && !crossSystemEvents.length && !model.fullEntryHref) return "";
    return `
      <div class="companion-v3-connections companion-v3-connection-history">
        ${model.summary.length ? `<dl>${model.summary.map((item) => `<div><dt>${escapeCompanionHtml(item.label)}</dt><dd>${escapeCompanionHtml(item.value)}</dd></div>`).join("")}</dl>` : ""}
        ${crossSystemEvents.length ? `<h4>Recent Connected Activity</h4><ul class="companion-v3-connection-events">${crossSystemEvents.map((event) => `<li><span>${escapeCompanionHtml(event.label)}</span><time datetime="${escapeCompanionHtml(event.timestamp)}">${escapeCompanionHtml(event.date)}</time></li>`).join("")}</ul>` : ""}
        ${model.fullEntryHref ? `<a class="companion-v3-full-entry" href="${escapeCompanionHtml(model.fullEntryHref)}">View in Book of Shadows</a>` : ""}
      </div>
    `;
  }

  function renderHistory(object, entity, instanceEvents = [], entityEvents = [], connectionModel = null) {
    const events = mergeHistoryEvents(
      getCandleBurnEvents(object),
      getLivingWorkflowEvents(object),
      instanceEvents,
      entityEvents
    );
    const connectionBody = renderConnectionHistory(connectionModel);
    if (!events.length && !entity?.id && !connectionBody) return "";
    const existingHistory = events.length || !connectionBody ? renderInstanceEvents(events) : "";
    return createDetailsMarkup(
      "History & Activity",
      `${existingHistory}${connectionBody}`,
      false,
      "companion-v3-history"
    );
  }

  function renderKnowledge(entity, settings) {
    if (!entity) return "";

    const layerOrder = String(settings.library_layer_order || "myPractice,traditional,community")
      .split(",")
      .map((layer) => layer.trim())
      .filter(Boolean);

    const renderers = {
      myPractice: renderMyPractice,
      traditional: renderTraditional,
      community: renderCommunity
    };

    return layerOrder
      .map((layer) => renderers[layer]?.(entity, settings) || "")
      .join("");
  }

  function bindSectionStateListeners() {
    companionContent?.querySelectorAll("details[data-companion-v3-section]").forEach((details) => {
      details.addEventListener("toggle", () => {
        saveSectionState(details.dataset.companionV3Section, details.open);
      });
    });
  }

  async function resolveObjectInstance(object) {
    if (!object || typeof getObjectInstance !== "function") return null;

    let instance = object.dataset.instanceId
      ? await getObjectInstance(object.dataset.instanceId)
      : null;

    if (instance) return instance;

    const apothecaryItemId = object.dataset.apothecaryItemId || "";
    const apothecaryItem =
      apothecaryItemId && typeof getApothecaryItemById === "function"
        ? getApothecaryItemById(apothecaryItemId)
        : null;

    if (apothecaryItem?.instanceId) {
      instance = await getObjectInstance(apothecaryItem.instanceId);
    }

    const entityId = object.dataset.entityId || apothecaryItem?.entityId || "";

    if (!instance && entityId && typeof getObjectInstancesByEntity === "function") {
      const instances = await getObjectInstancesByEntity(entityId);
      instance =
        (apothecaryItemId
          ? instances.find((candidate) => candidate.apothecary_item_id === apothecaryItemId)
          : null) ||
        instances.find((candidate) => candidate.status === "active") ||
        instances[0] ||
        null;
    }

    if (instance?.id) {
      object.dataset.instanceId = instance.id;
      object.dataset.entityId = object.dataset.entityId || instance.entity_id || entityId;
      if (typeof saveWorkingAltarDraft === "function") saveWorkingAltarDraft();
    }

    return instance;
  }

  async function getInstanceEvents(instance) {
    if (!instance?.id || typeof getObjectInstanceEvents !== "function") return [];
    return getObjectInstanceEvents(instance.id);
  }

  async function getEntityEvents(entity) {
    if (!entity?.id || typeof getObjectInstanceEventsByEntity !== "function") return [];
    return getObjectInstanceEventsByEntity(entity.id);
  }

  function renderCompanionPage({
    object = null,
    entity = null,
    instance = null,
    events = [],
    entityEvents = [],
    connections = null
  } = {}) {
    if (!companionContent || (!object && !entity)) return;

    const settings = getSettings();

    currentCompanionObject = object;
    currentCompanionEntity = entity;
    currentCompanionInstance = instance;
    currentCompanionEvents = events;
    currentCompanionEntityEvents = entityEvents;
    currentCompanionConnections = connections;

    renderHeader(object, entity, instance);

    companionContent.innerHTML = `
      <div class="companion-v3-page">
        <div class="companion-v3-knowledge">
          ${renderKnowledge(entity, settings)}
          ${renderRelationships(entity, connections)}
          ${renderHistory(object, entity, events, entityEvents, connections)}
        </div>
      </div>
    `;

    bindSectionStateListeners();

    altarCompanionPanel.classList.add("is-visible");
    altarCompanionPanel.classList.remove("is-minimized");

    document.dispatchEvent(new CustomEvent("companion:refreshed", {
      detail: { object, entityOnly: !object }
    }));
  }

  async function renderSelectedObject(object) {
    if (!object) return;

    const requestId = ++renderRequestId;
    const entity = getEntityForObject(object);

    renderCompanionPage({ object, entity });

    const instance = await resolveObjectInstance(object);
    if (requestId !== renderRequestId) return;
    if (typeof selectedObject !== "undefined" && selectedObject !== object) return;

    const [events, entityEvents, connectionResult] = await Promise.all([
      entity?.id ? Promise.resolve([]) : getInstanceEvents(instance),
      getEntityEvents(entity),
      entity?.id && window.LivingConnections?.load
        ? window.LivingConnections.load(entity.id).catch(() => null)
        : Promise.resolve(null)
    ]);
    if (requestId !== renderRequestId) return;
    if (typeof selectedObject !== "undefined" && selectedObject !== object) return;

    const connections = connectionResult && window.LivingConnectionsView
      ? window.LivingConnectionsView.createJourneyModel(connectionResult, { pairingLimit: 3, eventLimit: 5 })
      : null;
    renderCompanionPage({ object, entity, instance, events, entityEvents, connections });
  }

  async function renderLibraryEntity(entityId) {
    if (!entityId || typeof Library === "undefined") return;
    const entity = Library.getEntity(entityId);
    if (!entity) return;
    const requestId = ++renderRequestId;
    renderCompanionPage({ entity });
    const [entityEvents, connectionResult] = await Promise.all([
      getEntityEvents(entity),
      window.LivingConnections?.load ? window.LivingConnections.load(entity.id).catch(() => null) : Promise.resolve(null)
    ]);
    if (requestId !== renderRequestId) return;
    const connections = connectionResult && window.LivingConnectionsView
      ? window.LivingConnectionsView.createJourneyModel(connectionResult, { pairingLimit: 3, eventLimit: 5 })
      : null;
    renderCompanionPage({ entity, entityEvents, connections });
  }

  window.showAltarCompanionPanel = function showUnifiedAltarCompanionPanel(object) {
    return renderSelectedObject(object);
  };

  window.showLibraryEntityInCompanion = function showUnifiedLibraryEntityInCompanion(entityId) {
    return renderLibraryEntity(entityId);
  };

  window.hideAltarCompanionPanel = function hideUnifiedAltarCompanionPanel() {
    ++renderRequestId;
    currentCompanionObject = null;
    currentCompanionEntity = null;
    currentCompanionInstance = null;
    currentCompanionEvents = [];
    currentCompanionEntityEvents = [];
    currentCompanionConnections = null;

    altarCompanionPanel.dataset.companionIdentity = "empty";
    altarCompanionPanel.dataset.companionDivider = "standard";

    const heading = companionHeader?.querySelector("h2");
    if (heading) heading.textContent = "Companion";
    companionHeader?.querySelector("[data-companion-header-tags]")?.replaceChildren();
    companionHeader?.querySelector("[data-companion-emphasis]")?.replaceChildren();
    companionHeader?.querySelector("[data-companion-lifecycle]")?.remove();

    if (companionContent) {
      companionContent.innerHTML = `
        <div class="companion-v3-empty-state">
          <p class="book-divider">✦ ☽ ✦ ☾ ✦</p>
          <p>Select an object to open its living page.</p>
        </div>
      `;
    }
  };

  window.addEventListener("saltSettingsChanged", () => {
    if (currentCompanionObject) {
      renderCompanionPage({
        object: currentCompanionObject,
        entity: currentCompanionEntity,
        instance: currentCompanionInstance,
        events: currentCompanionEvents,
        entityEvents: currentCompanionEntityEvents,
        connections: currentCompanionConnections
      });
    } else if (currentCompanionEntity?.id) {
      renderLibraryEntity(currentCompanionEntity.id);
    }
  });

  if (typeof altarLivingStatePanel !== "undefined" && altarLivingStatePanel) {
    altarLivingStatePanel.hidden = true;
    altarLivingStatePanel.setAttribute("aria-hidden", "true");
    altarLivingStatePanel.remove();
  }

  window.hideAltarCompanionPanel();
})();
