/* =========================================================
   MY SETTINGS
   Guest/local + signed-in/cloud settings
   ========================================================= */

const MY_SETTINGS_LOCAL_KEY = "saltAndSovereigntyUserSettings";

function getDefaultMySettings() {
  return {
    preferred_name: "",
    pronouns: "",
    magical_name: "",
    default_altar_background: "",
    default_mundane_mode: false,

    companion_my_enabled: true,
    companion_my_ingredients: true,
    companion_my_intention: true,
    companion_my_notes: true,
    companion_my_grimoire: true,
    companion_my_dressings: true,
    companion_my_groups: true,

    companion_traditional_enabled: false,
    companion_traditional_meanings: false,
    companion_traditional_correspondences: false,
    companion_traditional_warnings: false,
    companion_traditional_sources: false,

    companion_community_enabled: false,
    companion_community_notes: false,
    companion_community_correspondences: false,
    companion_community_warnings: false,
    companion_community_substitutions: false
  };
}

function normalizeMySettings(settings = {}) {
  return {
    ...getDefaultMySettings(),
    ...(settings.settings || {}),
    ...settings
  };
}

function getLocalMySettings() {
  try {
    return normalizeMySettings(JSON.parse(localStorage.getItem(MY_SETTINGS_LOCAL_KEY)) || {});
  } catch {
    return getDefaultMySettings();
  }
}

function saveLocalMySettings(settings) {
  localStorage.setItem(MY_SETTINGS_LOCAL_KEY, JSON.stringify(normalizeMySettings(settings)));
}

async function getMySettings() {
  if (!currentUser) {
    return getLocalMySettings();
  }

  const { data, error } = await db
    .from("user_settings")
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return getLocalMySettings();
  }

  return normalizeMySettings(data || {});
}

async function saveMySettings(settings) {
  const normalizedSettings = normalizeMySettings(settings);

  saveLocalMySettings(normalizedSettings);

  if (!currentUser) {
    return normalizedSettings;
  }

  const row = {
    user_id: currentUser.id,
    preferred_name: normalizedSettings.preferred_name || "",
    pronouns: normalizedSettings.pronouns || "",
    magical_name: normalizedSettings.magical_name || "",
    default_mundane_mode: Boolean(normalizedSettings.default_mundane_mode),
    default_altar_background: normalizedSettings.default_altar_background || "",
    settings: normalizedSettings,
    updated_at: new Date().toISOString()
  };

  const { error } = await db
    .from("user_settings")
    .upsert(row, { onConflict: "user_id" });

  if (error) throw error;

  return row;
}

async function populateMySettingsForm() {
  const form = document.querySelector("[data-my-settings-form]");
  if (!form) return;

  const settings = await getMySettings();

  Object.entries(settings).forEach(([key, value]) => {
    if (!form.elements[key]) return;

    if (form.elements[key].type === "checkbox") {
      form.elements[key].checked = Boolean(value);
      return;
    }

    form.elements[key].value = value || "";
  });
}

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-my-settings-form]");
  if (!form) return;

  event.preventDefault();

  const defaults = getDefaultMySettings();
  const settings = {};

  Object.keys(defaults).forEach((key) => {
    const input = form.elements[key];

    if (!input) {
      settings[key] = defaults[key];
      return;
    }

    settings[key] =
      input.type === "checkbox"
        ? input.checked
        : input.value.trim();
  });

  try {
    await saveMySettings(settings);
    await applyMundaneModePreference();
    showMySanctuaryNotice("Settings saved.");
  } catch (error) {
    console.error(error);
    showMySanctuaryNotice("Settings could not be saved.");
  }
});

async function applyDefaultAltarBackgroundSetting() {
  if (!document.body.classList.contains("altar-page")) return;
  if (!altarStage) return;

  const settings = await getMySettings();
  const savedBackground = settings.default_altar_background || "";

  if (!savedBackground) return;

  const matchingBackground = cabinetItems.find((item) => {
    return (
      item.category === "backgrounds" &&
      (
        item.name.toLowerCase() === savedBackground.toLowerCase() ||
        item.background === savedBackground
      )
    );
  });

  if (!matchingBackground) return;

  altarStage.style.backgroundImage = `url("${matchingBackground.background}")`;
  altarStage.dataset.background = matchingBackground.background;
  altarStage.dataset.backgroundName = matchingBackground.name;
}

async function applyMundaneModePreference() {
  const settings = await getMySettings();
  const useMundaneMode = Boolean(settings.default_mundane_mode);

  document.body.classList.toggle("mundane-mode", useMundaneMode);
  document.documentElement.dataset.mundaneMode = String(useMundaneMode);
}

window.addEventListener("load", () => {
  window.setTimeout(() => {
    applyDefaultAltarBackgroundSetting();
    applyMundaneModePreference();
  }, 500);
});