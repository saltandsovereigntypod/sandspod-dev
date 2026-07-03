/* =========================================================
   MY SETTINGS
   Guest/local + signed-in/cloud settings
   ========================================================= */

const MY_SETTINGS_LOCAL_KEY = "saltAndSovereigntyUserSettings";

function getLocalMySettings() {
  try {
    return JSON.parse(localStorage.getItem(MY_SETTINGS_LOCAL_KEY)) || {};
  } catch {
    return {};
  }
}

function saveLocalMySettings(settings) {
  localStorage.setItem(MY_SETTINGS_LOCAL_KEY, JSON.stringify(settings));
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

  return data || {};
}

async function saveMySettings(settings) {
  if (!currentUser) {
    saveLocalMySettings(settings);
    return settings;
  }

  const row = {
    user_id: currentUser.id,
    preferred_name: settings.preferred_name || "",
    pronouns: settings.pronouns || "",
    magical_name: settings.magical_name || "",
    default_mundane_mode: Boolean(settings.default_mundane_mode),
    default_altar_background: settings.default_altar_background || "",
    settings,
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

  form.preferred_name.value = settings.preferred_name || "";
  form.pronouns.value = settings.pronouns || "";
  form.magical_name.value = settings.magical_name || "";
  form.default_altar_background.value = settings.default_altar_background || "";
  form.default_mundane_mode.checked = Boolean(settings.default_mundane_mode);
}

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-my-settings-form]");
  if (!form) return;

  event.preventDefault();

  const settings = {
    preferred_name: form.preferred_name.value.trim(),
    pronouns: form.pronouns.value.trim(),
    magical_name: form.magical_name.value.trim(),
    default_altar_background: form.default_altar_background.value.trim(),
    default_mundane_mode: form.default_mundane_mode.checked
  };

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
