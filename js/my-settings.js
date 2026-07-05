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
    
    grimoire_page_font: "classic-serif",

    sync_traditional_library_to_grimoire: false,

    library_layer_order: "myPractice,traditional,community",

    library_myPractice_enabled: true,
    library_myPractice_meanings: true,
    library_myPractice_uses: true,
    library_myPractice_correspondences: true,
    library_myPractice_ingredients: true,
    library_myPractice_intentions: true,
    library_myPractice_pairings: true,
    library_myPractice_substitutions: true,
    library_myPractice_warnings: true,
    library_myPractice_grimoire: true,
    library_myPractice_dressings: true,
    library_myPractice_groups: true,
    library_myPractice_notes: true,
    library_myPractice_sources: true,

    library_traditional_enabled: true,
    library_traditional_meanings: true,
    library_traditional_uses: true,
    library_traditional_correspondences: true,
    library_traditional_ingredients: true,
    library_traditional_intentions: true,
    library_traditional_pairings: true,
    library_traditional_substitutions: true,
    library_traditional_warnings: true,
    library_traditional_grimoire: false,
    library_traditional_dressings: false,
    library_traditional_groups: true,
    library_traditional_notes: true,
    library_traditional_sources: true,

    library_community_enabled: false,
    library_community_meanings: true,
    library_community_uses: true,
    library_community_correspondences: true,
    library_community_ingredients: true,
    library_community_intentions: true,
    library_community_pairings: true,
    library_community_substitutions: true,
    library_community_warnings: true,
    library_community_grimoire: false,
    library_community_dressings: false,
    library_community_groups: true,
    library_community_notes: true,
    library_community_sources: true,
    
    companion_copy_grimoire_settings: true,
    companion_layer_order: "myPractice,traditional,community",

    companion_my_enabled: true,
    companion_my_meanings: true,
    companion_my_uses: true,
    companion_my_correspondences: true,
    companion_my_ingredients: true,
    companion_my_intentions: true,
    companion_my_pairings: true,
    companion_my_substitutions: true,
    companion_my_warnings: true,
    companion_my_grimoire: true,
    companion_my_dressings: true,
    companion_my_groups: true,
    companion_my_notes: true,
    companion_my_sources: true,

    companion_traditional_enabled: false,
    companion_traditional_meanings: false,
    companion_traditional_uses: true,
    companion_traditional_correspondences: false,
    companion_traditional_ingredients: true,
    companion_traditional_intentions: true,
    companion_traditional_pairings: true,
    companion_traditional_substitutions: true,
    companion_traditional_warnings: false,
    companion_traditional_sources: false,

    companion_community_enabled: false,
    companion_community_meanings: true,
    companion_community_uses: true,
    companion_community_correspondences: true,
    companion_community_ingredients: true,
    companion_community_intentions: true,
    companion_community_pairings: true,
    companion_community_substitutions: true,
    companion_community_warnings: true,
    companion_community_notes: false,
    companion_community_sources: true,
    
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

    window.dispatchEvent(new CustomEvent("saltSettingsChanged"));

    showMySanctuaryNotice("Settings saved.");
  } catch (error) {
    console.error(error);
    showMySanctuaryNotice("Settings could not be saved.");
  }
});

async function applyDefaultAltarBackgroundSetting() {
  if (!document.body.classList.contains("altar-page")) return;

  const altarStage = document.querySelector("[data-altar-stage]");
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
  const grimoireFont = settings.grimoire_page_font || "classic-serif";

  document.body.classList.toggle("mundane-mode", useMundaneMode);
  document.documentElement.dataset.mundaneMode = String(useMundaneMode);

  document.body.classList.remove(
    "grimoire-font-classic-serif",
    "grimoire-font-dark-academia",
    "grimoire-font-soft-journal",
    "grimoire-font-handwritten"
  );

  document.body.classList.add(`grimoire-font-${grimoireFont}`);
}

window.addEventListener("load", () => {
  window.setTimeout(() => {
    applyDefaultAltarBackgroundSetting();
    applyMundaneModePreference();
  }, 500);
});