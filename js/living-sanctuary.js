(function initializeLivingSanctuary(global) {
  const escapeHtml = (value = "") => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  let sanctuaryRequestId = 0;

  function greeting(settings = {}, user = null) {
    const preference = settings.sanctuary_greeting_name || "preferred";
    const displayName = user?.user_metadata?.display_name || user?.user_metadata?.name || "";
    const name = preference === "none" ? "" : preference === "magical" ? settings.magical_name : settings.preferred_name || (preference === "magical" ? "" : displayName);
    return name ? `Welcome Home, ${name}` : "Welcome Home";
  }

  function validDestination(record, library = global.Library) {
    if (record.entityId) {
      const canonical = library?.resolveCanonicalEntityId?.(record.entityId);
      return canonical ? `/grimoire/?entity=${encodeURIComponent(canonical)}` : null;
    }
    return record.href || record.destination || null;
  }

  function continueItems(records = [], options = {}) {
    const seen = new Set();
    return records.filter((record) => record.timestamp && validDestination(record, options.library)).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).filter((record) => {
      const destination = validDestination(record, options.library); if (seen.has(destination)) return false; seen.add(destination); return true;
    }).slice(0, options.limit || 5).map((record) => ({ ...record, destination: validDestination(record, options.library) }));
  }

  function scopeKey(user) { return user?.id ? `user:${user.id}` : "guest"; }
  function isCurrentRequest(token, currentToken, expectedScope, currentScope, viewOpen = true) { return Boolean(viewOpen) && token === currentToken && expectedScope === currentScope; }

  function indexRecords() {
    global.SanctuarySearchUI?.rebuildLocalIndex?.();
    return global.SanctuarySearch?.getIndex?.() || [];
  }

  function journeyRecords() {
    const records = indexRecords().map((record) => ({ ...record, category: record.group, destination: global.SanctuarySearch.resolveDestination(record, global.Library) }));
    if (typeof global.getStoredActiveRitualSession === "function") {
      const active = global.getStoredActiveRitualSession();
      if (active?.started_at) records.push({ id: `active:${active.id}`, category: "rituals", source: "ritual-session", timestamp: active.started_at, title: active.name || active.title || "Active Ritual Session", description: active.status || "Active", destination: "/altar/" });
    }
    return global.MyJourney?.buildTimeline(records) || [];
  }

  function renderHome(panel, settings) {
    const section = panel.querySelector('[data-sanctuary-view="dashboard"]');
    if (!section) return;
    const records = indexRecords();
    const continues = continueItems(records, { library: global.Library });
    const recent = records.filter((item) => item.timestamp).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const facts = [
      recent.find((item) => item.group === "rituals") && `Your most recent recorded ritual is “${recent.find((item) => item.group === "rituals").title}.”`,
      recent.find((item) => item.group === "pages") && `“${recent.find((item) => item.group === "pages").title}” is your most recent Book of Shadows record.`,
      recent.find((item) => item.group === "library") && `${recent.find((item) => item.group === "library").title} was recently present in your Living Library.`
    ].filter(Boolean);
    section.innerHTML = `<h2 data-my-sanctuary-dashboard-title>${escapeHtml(greeting(settings, global.currentUser))}</h2><p class="my-sanctuary-user">${global.currentUser ? "Cloud-connected Sanctuary" : "Guest Sanctuary · saved in this browser"}</p><p class="my-sanctuary-intro">Your private home within Salt & Sovereignty. Return to your altar, continue your writing, revisit your rituals, and follow the living threads of your practice.</p><nav class="living-sanctuary-nav" aria-label="Sanctuary navigation"><button type="button" data-my-sanctuary-view-button="journey">My Journey</button><a href="/altar/">Digital Altar</a><a href="/grimoire/">Book of Shadows</a><a href="/altar/">Open Apothecary in Altar</a><button type="button" data-my-sanctuary-view-button="rituals">Rituals</button><a href="/grimoire/community-grimoire.html">Community Grimoire</a><button type="button" data-my-sanctuary-view-button="submissions">My Submissions</button><button type="button" data-my-sanctuary-view-button="settings">Settings</button></nav>${continues.length ? `<section class="living-sanctuary-section"><h3>Continue Your Practice</h3><div class="living-sanctuary-continue">${continues.map((item) => `<a href="${escapeHtml(item.destination)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.subtitle || item.type || "Recently recorded")}</span></a>`).join("")}</div></section>` : `<p class="my-sanctuary-soft-note">The things you return to will gather here over time.</p>`}${facts.length ? `<section class="living-sanctuary-section"><h3>In Your Sanctuary</h3>${facts.map((fact) => `<p>${escapeHtml(fact)}</p>`).join("")}</section>` : `<p class="my-sanctuary-soft-note">Your Sanctuary is ready for you. Begin with your altar, open your Book of Shadows, or add something meaningful to your Living Library.</p>`}<div class="my-sanctuary-actions"><button class="button button--ghost" type="button" data-my-sanctuary-show-auth ${global.currentUser ? "hidden" : ""}>Sign In</button><button class="button button--ghost" type="button" data-my-sanctuary-signout ${global.currentUser ? "" : "hidden"}>Sign Out</button></div>`;
  }

  function renderJourney(panel, state = {}) {
    const section = panel.querySelector('[data-sanctuary-view="journey"]'); if (!section) return;
    const all = journeyRecords();
    const categories = [...new Set(all.map((event) => event.category))];
    const events = global.MyJourney.filterEvents(all, { category: state.category || "all", direction: state.direction || "newest", query: state.query || "" });
    const groups = global.MyJourney.groupEvents(events, state.grouping || "month");
    const milestones = global.MyJourney.milestones(all); const summaries = global.MyJourney.reflectiveSummary(all); const threads = global.MyJourney.recentThreads(all);
    section.innerHTML = `<button class="button button--ghost" type="button" data-my-sanctuary-dashboard>← Sanctuary</button><p class="eyebrow">A Personal Chronicle</p><h2>My Journey</h2><p class="my-sanctuary-intro">Every practice tells a story. Some chapters are full of rituals, discoveries, and devotion. Others are quieter, marked only by a journal entry, an offering, or the lighting of a candle. My Journey is not a measure of progress. It gathers the threads of your practice so you can remember how your path unfolded.</p><div class="journey-controls"><label>Search this chronicle<input type="search" data-journey-search value="${escapeHtml(state.query || "")}"></label><label>Order<select data-journey-direction><option value="newest" ${state.direction !== "oldest" ? "selected" : ""}>Newest first</option><option value="oldest" ${state.direction === "oldest" ? "selected" : ""}>Oldest first</option></select></label><label>Group<select data-journey-grouping><option value="month">Month</option><option value="year" ${state.grouping === "year" ? "selected" : ""}>Year</option></select></label></div><div class="journey-filters">${[["all", "All"], ...categories.map((key) => [key, global.MyJourney.CATEGORY_LABELS[key] || key])].map(([key, label]) => `<button type="button" data-journey-filter="${key}" aria-pressed="${(state.category || "all") === key}">${escapeHtml(label)}</button>`).join("")}</div>${groups.length ? `<div class="journey-timeline">${groups.map((group) => `<section><h3>${escapeHtml(group.label)}</h3><ol>${group.items.map((event) => `<li><time>${new Date(event.timestamp).toLocaleDateString()}</time><div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.description)}</p>${event.destination ? `<a href="${escapeHtml(event.destination)}">Open record</a>` : ""}</div></li>`).join("")}</ol></section>`).join("")}</div>` : `<p class="my-sanctuary-empty">Your recorded journey begins with the first thing you choose to keep.</p>`}${milestones.length ? `<section class="living-sanctuary-section"><h3>First Pages</h3>${milestones.map((item) => `<p><strong>${escapeHtml(item.label)}</strong><br>${escapeHtml(item.event.title)}</p>`).join("")}</section>` : ""}${summaries.length ? `<section class="living-sanctuary-section"><h3>Recorded Patterns</h3>${summaries.map((summary) => `<p>${escapeHtml(summary)}</p>`).join("")}</section>` : ""}${threads.length ? `<section class="living-sanctuary-section"><h3>Recent Threads</h3>${threads.map((thread) => `<p>${escapeHtml(thread.text)}</p>`).join("")}</section>` : ""}`;
  }

  function install() {
    const panel = document.querySelector("[data-my-sanctuary-panel]"); if (!panel) return;
    document.querySelectorAll("[data-my-sanctuary-open]").forEach((button) => { button.textContent = "Sanctuary"; });
    if (!panel.querySelector('[data-sanctuary-view="journey"]')) { const journey = document.createElement("section"); journey.className = "my-sanctuary-view"; journey.dataset.sanctuaryView = "journey"; journey.hidden = true; panel.querySelector(".my-sanctuary-card")?.append(journey); }
    const originalSetView = global.setMySanctuaryView;
    global.setMySanctuaryView = function livingSanctuaryView(view) {
      originalSetView(view); const settings = global.getLocalMySettings?.() || {};
      if (view === "dashboard") renderHome(panel, settings);
      if (view === "journey") renderJourney(panel, {});
      if (view === "settings") global.LivingSettingsView?.render?.(panel);
    };
    renderHome(panel, global.getLocalMySettings?.() || {});
  }

  if (typeof document !== "undefined") document.addEventListener("input", (event) => { if (!event.target.matches("[data-journey-search]")) return; const panel = event.target.closest("[data-my-sanctuary-panel]"); renderJourney(panel, { query: event.target.value, direction: panel.querySelector("[data-journey-direction]")?.value, grouping: panel.querySelector("[data-journey-grouping]")?.value, category: panel.querySelector("[data-journey-filter][aria-pressed=true]")?.dataset.journeyFilter }); });
  if (typeof document !== "undefined") document.addEventListener("change", (event) => { if (!event.target.matches("[data-journey-direction], [data-journey-grouping]")) return; const panel = event.target.closest("[data-my-sanctuary-panel]"); renderJourney(panel, { query: panel.querySelector("[data-journey-search]")?.value, direction: panel.querySelector("[data-journey-direction]")?.value, grouping: panel.querySelector("[data-journey-grouping]")?.value, category: panel.querySelector("[data-journey-filter][aria-pressed=true]")?.dataset.journeyFilter }); });
  if (typeof document !== "undefined") document.addEventListener("click", (event) => { const filter = event.target.closest("[data-journey-filter]"); if (!filter) return; const panel = filter.closest("[data-my-sanctuary-panel]"); renderJourney(panel, { query: panel.querySelector("[data-journey-search]")?.value, direction: panel.querySelector("[data-journey-direction]")?.value, grouping: panel.querySelector("[data-journey-grouping]")?.value, category: filter.dataset.journeyFilter }); });
  if (typeof document !== "undefined") document.addEventListener("saltAuthChanged", () => { sanctuaryRequestId += 1; global.SanctuarySearch?.buildIndex?.({}); });

  const api = { greeting, validDestination, continueItems, scopeKey, isCurrentRequest, install };
  global.LivingSanctuary = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document !== "undefined") install();
})(typeof window !== "undefined" ? window : globalThis);
