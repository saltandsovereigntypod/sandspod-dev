/* =========================================================
   CUSTOM CABINET IMAGES + BACKGROUNDS
   Supabase-backed user asset records
   ========================================================= */

let customCabinetImageOverridesCache = {};
let customAltarBackgroundsCache = [];

function getCabinetImageOverrideKey(data = {}) {
  return [
    data.type || "",
    data.herb || "",
    data.form || "",
    data.color || "",
    data.crystal || "",
    data.tool || "",
    data.vessel || "",
    data.deity || "",
    data.label || ""
  ].join("|");
}

function waitForSaltAuthReady() {
  return new Promise((resolve) => {
    if (typeof currentUser !== "undefined" && currentUser) {
      resolve(currentUser);
      return;
    }

    document.addEventListener(
      "saltAuthReady",
      (event) => {
        resolve(event.detail?.user || null);
      },
      { once: true }
    );
  });
}

async function getCurrentAssetUser() {
  if (typeof currentUser !== "undefined" && currentUser) {
    return currentUser;
  }

  const readyUser = await waitForSaltAuthReady();

  if (readyUser) {
    return readyUser;
  }

  const {
    data: { user }
  } = await db.auth.getUser();

  return user || null;
}

async function uploadUserAsset(file, folder = "uploads") {
  if (!file) return "";

  const user = await getCurrentAssetUser();

  if (!user) {
    showAltarToast("Please sign in to upload images");
    return "";
  }

  const extension = file.name.split(".").pop() || "png";
  const fileName = `${crypto.randomUUID ? crypto.randomUUID() : Date.now()}.${extension}`;
  const filePath = `${user.id}/${folder}/${fileName}`;

  const { error } = await db.storage
    .from("user-assets")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) {
    console.error(error);
    showAltarToast("Image upload failed");
    return "";
  }

  const { data } = db.storage.from("user-assets").getPublicUrl(filePath);
  return data.publicUrl || "";
}

async function loadCustomCabinetImages() {
  const user = await getCurrentAssetUser();

  if (!user) {
    customCabinetImageOverridesCache = {};
    return {};
  }

  const { data, error } = await db
    .from("custom_cabinet_image_overrides")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    customCabinetImageOverridesCache = {};
    return {};
  }

  customCabinetImageOverridesCache = (data || {}).reduce((output, row) => {
    output[row.override_key] = row.image_url;
    return output;
  }, {});

  return customCabinetImageOverridesCache;
}

function getCustomCabinetImages() {
  return customCabinetImageOverridesCache;
}

function getCustomCabinetImage(data = {}) {
  return customCabinetImageOverridesCache[getCabinetImageOverrideKey(data)] || "";
}

async function setCustomCabinetImage(data = {}, imageUrl = "") {
  const user = await getCurrentAssetUser();

  if (!user || !imageUrl) {
    showAltarToast("Please sign in to save custom images");
    return;
  }

  const overrideKey = getCabinetImageOverrideKey(data);

  const { error } = await db
    .from("custom_cabinet_image_overrides")
    .upsert(
      {
        user_id: user.id,
        override_key: overrideKey,
        image_url: imageUrl,
        metadata: {
          label: data.label || "",
          type: data.type || "",
          form: data.form || ""
        },
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,override_key" }
    );

  if (error) {
    console.error(error);
    showAltarToast("Custom image could not be saved");
    return;
  }

  customCabinetImageOverridesCache[overrideKey] = imageUrl;
}

async function removeCustomCabinetImage(data = {}) {
  const user = await getCurrentAssetUser();
  if (!user) return;

  const overrideKey = getCabinetImageOverrideKey(data);

  const { error } = await db
    .from("custom_cabinet_image_overrides")
    .delete()
    .eq("user_id", user.id)
    .eq("override_key", overrideKey);

  if (error) {
    console.error(error);
    showAltarToast("Custom image could not be removed");
    return;
  }

  delete customCabinetImageOverridesCache[overrideKey];
}

async function getCustomAltarBackgrounds() {
  return customAltarBackgroundsCache;
}

async function loadCustomAltarBackgrounds() {
  const user = await getCurrentAssetUser();

  if (!user) {
    customAltarBackgroundsCache = [];
    return [];
  }

  const { data, error } = await db
    .from("custom_altar_backgrounds")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    customAltarBackgroundsCache = [];
    return [];
  }

  customAltarBackgroundsCache = (data || []).map((row) => ({
    id: row.id,
    category: "backgrounds",
    name: row.name,
    icon: row.icon || "🖼️",
    keywords: row.keywords || ["custom", "uploaded", "background"],
    background: row.image_url,
    customBackgroundId: row.id
  }));

  return customAltarBackgroundsCache;
}

async function promptCustomCabinetImage(button) {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/webp,image/jpeg";

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const imageUrl = await uploadUserAsset(file, "cabinet");
    if (!imageUrl) return;

    await setCustomCabinetImage(button.dataset, imageUrl);

    renderCabinetItems();
    showAltarToast("Custom cabinet image saved");
  });

  fileInput.click();
}

async function restoreDefaultCabinetImage(button) {
  await removeCustomCabinetImage(button.dataset);
  renderCabinetItems();
  showAltarToast("Default image restored");
}

async function promptCustomAltarBackground() {
  const name = window.prompt("Name this altar background:", "My Custom Altar");
  if (!name || !name.trim()) return;

  const user = await getCurrentAssetUser();

  if (!user) {
    showAltarToast("Please sign in to upload backgrounds");
    return;
  }

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/webp,image/jpeg";

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const imageUrl = await uploadUserAsset(file, "backgrounds");
    if (!imageUrl) return;

    const { error } = await db.from("custom_altar_backgrounds").insert({
      user_id: user.id,
      name: name.trim(),
      icon: "🖼️",
      keywords: ["custom", "uploaded", "background"],
      image_url: imageUrl
    });

    if (error) {
      console.error(error);
      showAltarToast("Custom background could not be saved");
      return;
    }

    await loadCustomAltarBackgrounds();

    activeCabinetCategory = "backgrounds";
    renderCabinet();
    showAltarToast("Custom altar background saved");
  });

  fileInput.click();
}

async function deleteCustomAltarBackground(backgroundId) {
  const user = await getCurrentAssetUser();
  if (!user || !backgroundId) return;

  const confirmed = window.confirm("Delete this custom background?");
  if (!confirmed) return;

  const { error } = await db
    .from("custom_altar_backgrounds")
    .delete()
    .eq("user_id", user.id)
    .eq("id", backgroundId);

  if (error) {
    console.error(error);
    showAltarToast("Custom background could not be deleted");
    return;
  }

  await loadCustomAltarBackgrounds();
  renderCabinetItems();
  showAltarToast("Custom background deleted");
}

async function loadCustomUserAssets() {
  await loadCustomCabinetImages();
  await loadCustomAltarBackgrounds();
}