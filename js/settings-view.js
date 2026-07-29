(function initializeLivingSettingsView(global) {
  const CATEGORIES = ["identity", "appearance", "book", "library", "companion", "objects", "account"];
  const categoryForName = (name = "") => name.startsWith("library_") ? "library" : name.startsWith("companion_") ? "companion" : name.startsWith("living_state_") ? "objects" : ["preferred_name", "pronouns", "magical_name", "sanctuary_greeting_name"].includes(name) ? "identity" : ["default_altar_background"].includes(name) ? "appearance" : "book";
  function backgroundOptions(items = [], saved = "") {
    const names = [...new Set(items.map((item) => item?.name || item?.background).filter(Boolean))];
    if (saved && !names.includes(saved)) names.unshift(saved);
    return names;
  }
  function categoryDefaults(settings, category, defaults) {
    const next = { ...settings };
    Object.keys(defaults).filter((key) => categoryForName(key) === category).forEach((key) => { next[key] = defaults[key]; });
    return next;
  }
  function isStale(token, current, dirty) { return token !== current || dirty; }
  function populateBackgroundSelect(select, saved = "") {
    if (!select) return;
    const selected = select.value || saved;
    const definitions = global.SanctuaryAssetCatalog?.getBackgrounds?.() || global.AltarBackgrounds?.getAll?.() || [];
    select.innerHTML = '<option value="">No default</option>' + backgroundOptions(definitions, selected).map((name) => `<option value="${name.replaceAll('"', '&quot;')}">${name}</option>`).join("");
    select.value = selected;
    let picker = select.parentElement.querySelector("[data-background-picker]");
    if (!picker) { picker = document.createElement("div"); picker.className = "sanctuary-background-picker"; picker.dataset.backgroundPicker = ""; picker.setAttribute("role", "radiogroup"); picker.setAttribute("aria-label", "Default Altar background"); select.after(picker); select.classList.add("sr-only"); }
    const choices = [{ name: "", thumbnailPath: "", label: "No default" }, ...definitions.map((item) => ({ name: item.name, thumbnailPath: item.thumbnailPath || item.thumbnail || item.assetPath || item.background, label: item.name }))];
    if (selected && !choices.some((item) => item.name === selected)) choices.push({ name: selected, thumbnailPath: "", label: `${selected} (currently unavailable)` });
    picker.innerHTML = choices.map((item) => `<label class="sanctuary-background-option"><input type="radio" name="background_picker" value="${item.name.replaceAll('"', '&quot;')}" ${item.name === selected ? "checked" : ""}>${item.thumbnailPath ? `<img src="${item.thumbnailPath}" alt="">` : '<span class="sanctuary-background-placeholder" aria-hidden="true">✦</span>'}<span>${item.label}</span></label>`).join("");
    picker.querySelectorAll('input[name="background_picker"]').forEach((radio) => radio.addEventListener("change", () => { select.value = radio.value; select.dispatchEvent(new Event("input", { bubbles: true })); }));
  }
  function render(panel) {
    const form = panel?.querySelector("[data-my-settings-form]");
    if (!form || form.dataset.categorized) return;
    form.dataset.categorized = "true";
    const defaults = global.getDefaultMySettings();
    const saved = global.getLocalMySettings();
    const magical = form.querySelector('[name="magical_name"]')?.closest("label");
    magical?.insertAdjacentHTML("afterend", '<label>Greeting name<select name="sanctuary_greeting_name"><option value="preferred">Use preferred name</option><option value="magical">Use magical name</option><option value="none">Use no name</option></select></label>');
    const background = form.querySelector('[name="default_altar_background"]');
    populateBackgroundSelect(background, saved.default_altar_background);
    const nav = document.createElement("nav"); nav.className = "settings-category-nav"; nav.setAttribute("aria-label", "Settings categories");
    const labels = { identity: "Identity", appearance: "Appearance", book: "Book of Shadows", library: "Living Library", companion: "Companion", objects: "Living Objects", account: "Account & Data" };
    CATEGORIES.forEach((category, index) => nav.insertAdjacentHTML("beforeend", `<button class="button button--small button--pill" type="button" data-settings-category="${category}" aria-pressed="${index === 0}">${labels[category]}</button>`));
    form.prepend(nav);
    const buckets = Object.fromEntries(CATEGORIES.map((category) => { const fieldset = document.createElement("fieldset"); fieldset.className = "settings-category"; fieldset.dataset.settingsPanel = category; fieldset.hidden = category !== "identity"; fieldset.innerHTML = `<legend>${labels[category]}</legend>`; form.insertBefore(fieldset, form.querySelector('button[type="submit"]')); return [category, fieldset]; }));
    [...form.querySelectorAll(":scope > label, :scope > fieldset:not(.settings-category)")].forEach((node) => { const name = node.querySelector("[name]")?.name || ""; buckets[categoryForName(name)]?.append(node); });
    const user = global.getCurrentSaltUser?.() || null;
    buckets.account.innerHTML += `<p>${user ? `Signed in as <strong>${user.email || "your account"}</strong>.` : "Guest Sanctuary · settings are stored in this browser."}</p><div class="my-sanctuary-actions">${user ? '<button type="button" class="button button--ghost" data-my-sanctuary-signout>Sign Out</button>' : '<button type="button" class="button button--ghost" data-my-sanctuary-show-auth>Sign In</button>'}</div>`;
    global.SanctuaryBackupUI?.mount?.(buckets.account, user);
    form.querySelectorAll("[name]").forEach((input) => { const value = saved[input.name]; if (input.type === "checkbox") input.checked = Boolean(value); else if (value != null) input.value = value; });
    const save = form.querySelector('button[type="submit"]'); save.textContent = "Save Changes"; save.disabled = true;
    const status = document.createElement("p"); status.className = "settings-save-status"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.textContent = "All changes saved."; form.append(status);
    form.addEventListener("input", () => { form.dataset.dirty = "true"; save.disabled = false; status.textContent = "Unsaved changes."; });
    nav.addEventListener("click", (event) => { const button = event.target.closest("[data-settings-category]"); if (!button) return; nav.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button))); Object.entries(buckets).forEach(([key, node]) => { node.hidden = key !== button.dataset.settingsCategory; }); buckets[button.dataset.settingsCategory].querySelector("legend")?.focus?.(); });
    form.querySelector('[name="companion_copy_grimoire_settings"]')?.addEventListener("change", (event) => { form.querySelector("[data-settings-panel=companion]")?.classList.toggle("is-copying", event.target.checked); });
    window.addEventListener("altarBackgroundsReady", () => populateBackgroundSelect(background, background?.value || saved.default_altar_background));
    window.addEventListener("saltSettingsSaveState", (event) => { if (event.detail?.ok) { form.dataset.dirty = "false"; save.disabled = true; status.textContent = "Settings saved."; window.setTimeout(() => { if (form.dataset.dirty !== "true") status.textContent = "All changes saved."; }, 1800); } else { form.dataset.dirty = "true"; save.disabled = false; status.textContent = "Settings could not be saved."; } });
  }
  const api = { CATEGORIES, categoryForName, backgroundOptions, categoryDefaults, isStale, populateBackgroundSelect, render };
  global.LivingSettingsView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
