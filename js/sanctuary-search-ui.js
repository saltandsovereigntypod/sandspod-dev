(function initializeSanctuarySearchUI(global) {
  if (typeof document === "undefined" || !global.SanctuarySearch) return;
  let modal = null;
  let trigger = null;
  let activeIndex = -1;
  let requestId = 0;

  const escapeHtml = (value = "") => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function libraryRecords() {
    if (!global.Library?.getAllEntitiesSorted) return [];
    const settings = typeof global.getLocalMySettings === "function" ? global.getLocalMySettings() : {};
    const showTraditional = settings.library_traditional_enabled !== false;
    const showMyPractice = settings.library_myPractice_enabled !== false;
    const showCommunity = settings.library_community_enabled !== false;
    return global.Library.getAllEntitiesSorted().map((entity) => {
      const canonicalId = global.Library.resolveCanonicalEntityId?.(entity.id);
      if (!canonicalId || canonicalId !== entity.id) return null;
      const hasPersonalLayer = (showMyPractice && Object.keys(entity.myPractice || {}).length) ||
        (showCommunity && Object.keys(entity.community || {}).length);
      if (!showTraditional && !hasPersonalLayer) return null;
      const references = global.LivingConnections?.getReferences?.(entity.id, { library: global.Library }) || {};
      const relatedNames = (references.relatedEntities || []).map((record) => record.label);
      return {
        id: entity.id, group: "library", source: "living-library", type: entity.type,
        entityId: entity.id, title: entity.name, aliases: entity.aliases || [],
        subtitle: `${entity.type || "Entry"} · Living Library`,
        fields: [showMyPractice ? entity.myPractice : {}, showTraditional ? entity.traditional : {}, showCommunity ? entity.community : {}],
        relationshipText: relatedNames,
        relationshipContext: relatedNames.length ? `Linked to ${relatedNames.slice(0, 3).join(", ")}` : "",
        timestamp: entity.updatedAt || entity.createdAt
      };
    }).filter(Boolean);
  }

  function pageRecords() {
    return (global.SanctuarySearchPageSource || []).map((page) => ({
      id: page.id, group: "pages", type: page.type || "page", title: page.title || "Untitled Page",
      subtitle: page.type === "ritual_journal" ? "Ritual Journal · Book of Shadows" : "Book of Shadows Page",
      fields: [page.metadata, page._searchBlocks, page.blocks, page.content], href: `/grimoire/?page=${encodeURIComponent(page.id)}`,
      timestamp: page.updated_at || page.created_at
    })).concat((global.SanctuarySearchSectionSource || []).map((section) => ({
      id: `section:${section.id}`, group: "pages", type: "section", title: section.title || "Untitled Section",
      subtitle: "Book of Shadows Section", fields: section.description || ""
    })));
  }

  function recipeRecords() {
    const recipes = typeof global.getApothecaryItems === "function" ? global.getApothecaryItems() : [];
    return recipes.map((item) => {
      const ingredients = item.ingredients || [];
      const names = ingredients.map((ingredient) => ingredient.label || ingredient.name).filter(Boolean);
      return {
        id: item.id, group: "apothecary", type: item.type || "recipe", title: item.name || "Untitled Recipe",
        subtitle: "Apothecary Recipe", fields: [item.intention, item.notes, names], relationshipText: names,
        relationshipContext: names.length ? `Contains ${names.slice(0, 3).join(", ")}` : "",
        action: typeof global.openApothecaryItemEditor === "function" ? { kind: "apothecary", id: item.id } : null,
        timestamp: item.updatedAt || item.updated_at || item.createdAt || item.created_at
      };
    });
  }

  function objectRecords() {
    if (typeof document === "undefined") return [];
    return [...document.querySelectorAll(".altar-object[data-entity-id]")].map((object) => {
      const canonicalId = global.Library?.resolveCanonicalEntityId?.(object.dataset.entityId);
      if (!canonicalId) return null;
      return {
        id: object.dataset.altarObjectId || object.dataset.instanceId || `${canonicalId}:${object.dataset.label}`,
        group: "objects", type: object.dataset.type || "object", entityId: canonicalId,
        title: object.dataset.label || global.Library.getEntity(canonicalId)?.name || "Altar Object",
        subtitle: "Object currently on the Altar", fields: [object.dataset.type, object.dataset.form]
      };
    }).filter(Boolean);
  }

  function rebuildLocalIndex() {
    global.SanctuarySearch.buildIndex({ library: libraryRecords(), pages: pageRecords(), apothecary: recipeRecords(), objects: objectRecords() });
  }

  async function enrichIndex(token) {
    const tasks = [];
    if (typeof global.getMyRituals === "function") tasks.push(global.getMyRituals().then((records) => ["rituals", records.map((ritual) => ({
      id: ritual.id, group: "rituals", type: ritual.ritual_type || "ritual", title: ritual.title || ritual.name || "Untitled Ritual",
      subtitle: "Ritual", fields: [ritual.intention, ritual.notes, ritual.tags, ritual.altar_snapshot],
      href: ritual.grimoire_page_id ? `/grimoire/?page=${encodeURIComponent(ritual.grimoire_page_id)}` : null,
      timestamp: ritual.completed_at || ritual.updated_at || ritual.created_at
    }))]));
    if (typeof global.getRitualTemplates === "function") tasks.push(global.getRitualTemplates().then((records) => ["templates", records.map((template) => ({
      id: template.id, group: "templates", type: template.ritual_type || "template", title: template.name || template.title || "Untitled Template",
      subtitle: "Ritual Template", fields: [template.description, template.intention, template.ritual_template_steps],
      href: `/altar/?editRitualTemplate=${encodeURIComponent(template.id)}`, timestamp: template.updated_at || template.created_at
    }))]));
    const settled = await Promise.allSettled(tasks);
    if (!global.SanctuarySearch.isCurrentRequest(token, requestId, Boolean(modal))) return;
    settled.forEach((result) => { if (result.status === "fulfilled") global.SanctuarySearch.updateSource(result.value[0], result.value[1]); });
    renderResults();
  }

  function resultMarkup(result, index) {
    const href = global.SanctuarySearch.resolveDestination(result, global.Library);
    const body = `<strong>${escapeHtml(result.title)}</strong><span>${escapeHtml(result.subtitle)}</span>${result.relationshipContext || result.matchContext ? `<small>${escapeHtml(result.relationshipContext || result.matchContext)}</small>` : ""}`;
    if (href) return `<a href="${escapeHtml(href)}" data-sanctuary-result data-result-index="${index}">${body}</a>`;
    if (result.action) return `<button type="button" data-sanctuary-result data-result-index="${index}" data-result-action="${escapeHtml(result.action.kind)}" data-result-id="${escapeHtml(result.action.id)}">${body}</button>`;
    return `<div class="sanctuary-search-result is-context">${body}</div>`;
  }

  function renderResults() {
    if (!modal) return;
    const input = modal.querySelector("[data-sanctuary-search-input]");
    const filter = modal.querySelector("[data-sanctuary-search-filter].is-active")?.dataset.sanctuarySearchFilter || "all";
    const query = input.value.trim();
    const container = modal.querySelector("[data-sanctuary-search-results]");
    activeIndex = -1;
    if (!query) {
      const recent = global.SanctuarySearch.getRecent({ limit: 5 });
      container.innerHTML = `<p class="sanctuary-search-empty">Search across your Living Library, Book of Shadows, rituals, recipes, and altar records.</p>${recent.length ? `<section><h3>Recently Recorded</h3><div class="sanctuary-search-list">${recent.map(resultMarkup).join("")}</div></section>` : ""}`;
      return;
    }
    const results = global.SanctuarySearch.search(query, { group: filter });
    const groups = global.SanctuarySearch.groupResults(results);
    let index = 0;
    container.innerHTML = groups.length ? groups.map((group) => `<section><h3>${escapeHtml(group.label)}</h3><div class="sanctuary-search-list">${group.results.slice(0, 8).map((result) => resultMarkup(result, index++)).join("")}</div></section>`).join("") : `<p class="sanctuary-search-empty">Nothing in your Sanctuary matches this search yet.<small>Try another name, purpose, ingredient, ritual, or entry type.</small></p>`;
    modal.querySelector("[data-sanctuary-search-status]").textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;
  }

  function closeSearch() {
    if (!modal) return;
    requestId += 1;
    modal.remove();
    modal = null;
    trigger?.focus();
  }

  function openSearch(button) {
    if (modal) return;
    trigger = button;
    rebuildLocalIndex();
    const supportedGroups = Object.entries(global.SanctuarySearch.GROUP_LABELS).filter(([key]) => {
      if (key === "library") return Boolean(global.Library);
      if (key === "pages") return Boolean(global.SanctuarySearchPageSource || location.pathname.includes("grimoire"));
      if (key === "rituals") return typeof global.getMyRituals === "function";
      if (key === "templates") return typeof global.getRitualTemplates === "function";
      if (key === "apothecary") return typeof global.getApothecaryItems === "function";
      if (key === "objects") return Boolean(document.querySelector("[data-altar-stage]"));
      return false;
    });
    modal = document.createElement("div");
    modal.className = "sanctuary-search-backdrop";
    modal.innerHTML = `<div class="sanctuary-search-dialog" role="dialog" aria-modal="true" aria-labelledby="sanctuary-search-title"><header><div><p class="eyebrow">A Living Index</p><h2 id="sanctuary-search-title">Search the Sanctuary</h2></div><button type="button" data-sanctuary-search-close aria-label="Close search">×</button></header><label class="sanctuary-search-input"><span class="sr-only">Search the Sanctuary</span><input type="search" data-sanctuary-search-input placeholder="Search names, purposes, rituals, or ingredients…" autocomplete="off" /></label><div class="sanctuary-search-filters" role="group" aria-label="Filter search results">${[["all", "All"], ...supportedGroups].map(([key, label], index) => `<button type="button" data-sanctuary-search-filter="${key}" class="${index === 0 ? "is-active" : ""}" aria-pressed="${index === 0}">${label}</button>`).join("")}</div><p class="sr-only" role="status" aria-live="polite" data-sanctuary-search-status></p><div class="sanctuary-search-results" data-sanctuary-search-results></div></div>`;
    document.body.append(modal);
    renderResults();
    modal.querySelector("input").focus();
    const token = ++requestId;
    enrichIndex(token);
  }

  document.addEventListener("click", (event) => {
    const opener = event.target.closest("[data-open-sanctuary-search]");
    if (opener) return openSearch(opener);
    if (!modal) return;
    if (event.target === modal || event.target.closest("[data-sanctuary-search-close]")) return closeSearch();
    const filter = event.target.closest("[data-sanctuary-search-filter]");
    if (filter) {
      modal.querySelectorAll("[data-sanctuary-search-filter]").forEach((item) => { item.classList.toggle("is-active", item === filter); item.setAttribute("aria-pressed", item === filter ? "true" : "false"); });
      return renderResults();
    }
    const action = event.target.closest("[data-result-action]");
    if (action?.dataset.resultAction === "apothecary" && typeof global.openApothecaryItemEditor === "function") {
      closeSearch();
      global.openApothecaryItemEditor(action.dataset.resultId);
    }
  });
  document.addEventListener("input", (event) => { if (modal && event.target.matches("[data-sanctuary-search-input]")) renderResults(); });
  document.addEventListener("keydown", (event) => {
    if (!modal) return;
    if (event.key === "Escape") { event.preventDefault(); return closeSearch(); }
    const results = [...modal.querySelectorAll("[data-sanctuary-result]")];
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
      event.preventDefault();
      activeIndex = event.key === "ArrowDown" ? (activeIndex + 1) % results.length : (activeIndex - 1 + results.length) % results.length;
      results.forEach((item, index) => { item.classList.toggle("is-active", index === activeIndex); item.setAttribute("aria-selected", index === activeIndex ? "true" : "false"); });
      results[activeIndex].focus();
    }
    if (event.key === "Tab") {
      const focusable = [...modal.querySelectorAll("button, a[href], input")].filter((item) => !item.hidden);
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener("living-library:hydrated", () => { if (modal) { rebuildLocalIndex(); renderResults(); } });
  document.addEventListener("sanctuary-search:sources-changed", () => { if (modal) { rebuildLocalIndex(); renderResults(); } });
})(typeof window !== "undefined" ? window : globalThis);
