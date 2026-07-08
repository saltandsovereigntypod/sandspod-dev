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

async function compressImageFile(file, options = {}) {
  const {
    maxWidth = 1800,
    maxHeight = 1800,
    quality = 0.86
  } = options;

  if (!file || !file.type.startsWith("image/")) return file;

  if (file.type === "image/png" && file.size < 900000) {
    return file;
  }

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageUrl;
  });

  const scale = Math.min(
    1,
    maxWidth / image.width,
    maxHeight / image.height
  );

  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  URL.revokeObjectURL(imageUrl);

  const outputType = file.type === "image/png" ? "image/png" : "image/webp";

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, outputType, quality);
  });

  if (!blob || blob.size >= file.size) return file;

  const extension = outputType === "image/webp" ? "webp" : "png";
  const baseName = file.name.replace(/\.[^/.]+$/, "");

  return new File([blob], `${baseName}.${extension}`, {
    type: outputType
  });
}

function getStoragePathFromPublicUrl(publicUrl = "") {
  const marker = "/storage/v1/object/public/user-assets/";
  const index = publicUrl.indexOf(marker);

  if (index === -1) return "";

  return decodeURIComponent(publicUrl.slice(index + marker.length));
}

async function deleteUserAssetByPath(storagePath = "") {
  if (!storagePath) return;

  const { error } = await db.storage
    .from("user-assets")
    .remove([storagePath]);

  if (error) {
    console.warn("Could not delete old user asset:", error);
  }
}

async function uploadUserAsset(file, folder = "uploads", options = {}) {
  if (!file) return null;

  const user = await getCurrentAssetUser();

  if (!user) {
    showAltarToast("Please sign in to upload images");
    return null;
  }

  const optimizedFile = await compressImageFile(file, options);
  const extension = optimizedFile.name.split(".").pop() || "png";
  const fileName = `${crypto.randomUUID ? crypto.randomUUID() : Date.now()}.${extension}`;
  const filePath = `${user.id}/${folder}/${fileName}`;

  const { error } = await db.storage
    .from("user-assets")
    .upload(filePath, optimizedFile, {
      cacheControl: "31536000",
      upsert: false
    });

  if (error) {
    console.error(error);
    showAltarToast("Image upload failed");
    return null;
  }

  const { data } = db.storage.from("user-assets").getPublicUrl(filePath);

  return {
    url: data.publicUrl || "",
    path: filePath,
    size: optimizedFile.size,
    originalSize: file.size,
    type: optimizedFile.type
  };
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

  customCabinetImageOverridesCache = (data || []).reduce((output, row) => {
    output[row.override_key] = {
      url: row.image_url,
      storagePath: row.storage_path || getStoragePathFromPublicUrl(row.image_url)
    };
    return output;
  }, {});

  return customCabinetImageOverridesCache;
}

function getCustomCabinetImages() {
  return customCabinetImageOverridesCache;
}

function getCustomCabinetImage(data = {}) {
  return customCabinetImageOverridesCache[getCabinetImageOverrideKey(data)]?.url || "";
}
async function setCustomCabinetImage(data = {}, imageUrl = "", storagePath = "") {
  const user = await getCurrentAssetUser();

  if (!user || !imageUrl) {
    showAltarToast("Please sign in to save custom images");
    return;
  }

  const overrideKey = getCabinetImageOverrideKey(data);
  const existingOverride = customCabinetImageOverridesCache[overrideKey];
  const oldStoragePath = existingOverride?.storagePath || "";

  const { error } = await db
    .from("custom_cabinet_image_overrides")
    .upsert(
      {
        user_id: user.id,
        override_key: overrideKey,
        image_url: imageUrl,
        storage_path: storagePath,
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

  if (oldStoragePath && oldStoragePath !== storagePath) {
    await deleteUserAssetByPath(oldStoragePath);
  }

  customCabinetImageOverridesCache[overrideKey] = {
    url: imageUrl,
    storagePath
  };
}

async function removeCustomCabinetImage(data = {}) {
  const user = await getCurrentAssetUser();
  if (!user) return;

  const overrideKey = getCabinetImageOverrideKey(data);
  const existingOverride = customCabinetImageOverridesCache[overrideKey];

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

  if (existingOverride?.storagePath) {
    await deleteUserAssetByPath(existingOverride.storagePath);
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
    customBackgroundId: row.id,
    storagePath: row.storage_path || getStoragePathFromPublicUrl(row.image_url)
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

    const uploaded = await uploadUserAsset(file, "cabinet", {
      maxWidth: 1200,
      maxHeight: 1200
    });

    if (!uploaded?.url) return;

    await setCustomCabinetImage(button.dataset, uploaded.url, uploaded.path);

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

    const uploaded = await uploadUserAsset(file, "backgrounds", {
      maxWidth: 2400,
      maxHeight: 1600
    });

    if (!uploaded?.url) return;

    const { error } = await db.from("custom_altar_backgrounds").insert({
      user_id: user.id,
      name: name.trim(),
      icon: "🖼️",
      keywords: ["custom", "uploaded", "background"],
      image_url: uploaded.url,
      storage_path: uploaded.path
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

  const existingBackground = customAltarBackgroundsCache.find((background) => {
    return background.id === backgroundId;
  });

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

  if (existingBackground?.storagePath) {
    await deleteUserAssetByPath(existingBackground.storagePath);
  }

  await loadCustomAltarBackgrounds();
  renderCabinetItems();
  showAltarToast("Custom background deleted");
}

async function loadCustomUserAssets() {
  await loadCustomCabinetImages();
  await loadCustomAltarBackgrounds();
}