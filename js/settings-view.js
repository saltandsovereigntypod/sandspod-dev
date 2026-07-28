(function initializeLivingSettingsView(global) {
  const CATEGORIES = ["identity", "appearance", "book", "library", "companion", "objects"];
  const categoryForName = (name = "") => name.startsWith("library_") ? "library" : name.startsWith("companion_") ? "companion" : name.startsWith("living_state_") ? "objects" : ["preferred_name", "pronouns", "magical_name", "sanctuary_greeting_name"].includes(name) ? "identity" : ["default_altar_background"].includes(name) ? "appearance" : "book";
  function backgroundOptions(items = [], saved = "") {
    const names = [...new Set(items.map((item) => item?.background || item?.name).filter(Boolean))];
    if (saved && !names.includes(saved)) names.unshift(saved);
    return names;
  }
  function categoryDefaults(settings, category, defaults) {
    const next = { ...settings };
    Object.keys(defaults).filter((key) => categoryForName(key) === category).forEach((key) => { next[key] = defaults[key]; });
    return next;
  }
  function isStale(token, current, dirty) { return token !== current || dirty; }
  function render(panel) {
    const form = panel?.querySelector("[data-my-settings-form]");
    if (!form || form.dataset.categorized) return;
    form.dataset.categorized = "true";
    const defaults = global.getDefaultMySettings();
    const saved = global.getLocalMySettings();
    const magical = form.querySelector('[name="magical_name"]')?.closest("label");
    magical?.insertAdjacentHTML("afterend", '<label>Greeting name<select name="sanctuary_greeting_name"><option value="preferred">Use preferred name</option><option value="magical">Use magical name</option><option value="none">Use no name</option></select></label>');
    const background = form.querySelector('[name="default_altar_background"]');
    if (background) background.innerHTML = '<option value="">No default</option>' + backgroundOptions(global.cabinetItems || [], saved.default_altar_background).map((name) => `<option value="${name.replaceAll('"', '&quot;')}">${name}</option>`).join("");
    const nav = document.createElement("nav"); nav.className = "settings-category-nav"; nav.setAttribute("aria-label", "Settings categories");
    const labels = { identity: "Identity", appearance: "Appearance", book: "Book of Shadows", library: "Living Library", companion: "Companion", objects: "Living Objects" };
    CATEGORIES.forEach((category, index) => nav.insertAdjacentHTML("beforeend", `<button type="button" data-settings-category="${category}" aria-pressed="${index === 0}">${labels[category]}</button>`));
    form.prepend(nav);
    const buckets = Object.fromEntries(CATEGORIES.map((category) => { const fieldset = document.createElement("fieldset"); fieldset.className = "settings-category"; fieldset.dataset.settingsPanel = category; fieldset.hidden = category !== "identity"; fieldset.innerHTML = `<legend>${labels[category]}</legend>`; form.insertBefore(fieldset, form.querySelector('button[type="submit"]')); return [category, fieldset]; }));
    [...form.querySelectorAll(":scope > label, :scope > fieldset:not(.settings-category)")].forEach((node) => { const name = node.querySelector("[name]")?.name || ""; buckets[categoryForName(name)]?.append(node); });
    form.querySelectorAll("[name]").forEach((input) => { const value = saved[input.name]; if (input.type === "checkbox") input.checked = Boolean(value); else if (value != null) input.value = value; });
    const status = document.createElement("p"); status.className = "settings-save-status"; status.setAttribute("role", "status"); status.textContent = "No unsaved changes."; form.append(status);
    form.addEventListener("input", () => { form.dataset.dirty = "true"; status.textContent = "Unsaved changes."; });
    form.addEventListener("submit", () => { form.dataset.dirty = "false"; status.textContent = "Settings saved."; });
    nav.addEventListener("click", (event) => { const button = event.target.closest("[data-settings-category]"); if (!button) return; nav.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button))); Object.entries(buckets).forEach(([key, node]) => { node.hidden = key !== button.dataset.settingsCategory; }); buckets[button.dataset.settingsCategory].querySelector("legend")?.focus?.(); });
    form.querySelector('[name="companion_copy_grimoire_settings"]')?.addEventListener("change", (event) => { form.querySelector("[data-settings-panel=companion]")?.classList.toggle("is-copying", event.target.checked); });
  }
  const api = { CATEGORIES, categoryForName, backgroundOptions, categoryDefaults, isStale, render };
  global.LivingSettingsView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
