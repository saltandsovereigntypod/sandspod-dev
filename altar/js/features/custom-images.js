/* =========================================================
   CUSTOM CABINET IMAGES + BACKGROUNDS
   Local-first user image overrides
   ========================================================= */

const CUSTOM_CABINET_IMAGES_KEY = "saltAndSovereigntyCustomCabinetImages";
const CUSTOM_ALTAR_BACKGROUNDS_KEY = "saltAndSovereigntyCustomAltarBackgrounds";

function getCustomCabinetImages() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_CABINET_IMAGES_KEY)) || {};
  } catch {
    return {};
  }
}

function saveCustomCabinetImages(images) {
  localStorage.setItem(CUSTOM_CABINET_IMAGES_KEY, JSON.stringify(images));
}

function getCustomAltarBackgrounds() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_ALTAR_BACKGROUNDS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCustomAltarBackgrounds(backgrounds) {
  localStorage.setItem(CUSTOM_ALTAR_BACKGROUNDS_KEY, JSON.stringify(backgrounds));
}

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

function getCustomCabinetImage(data = {}) {
  const images = getCustomCabinetImages();
  return images[getCabinetImageOverrideKey(data)] || "";
}

function setCustomCabinetImage(data = {}, imageDataUrl = "") {
  const images = getCustomCabinetImages();
  images[getCabinetImageOverrideKey(data)] = imageDataUrl;
  saveCustomCabinetImages(images);
}

function removeCustomCabinetImage(data = {}) {
  const images = getCustomCabinetImages();
  delete images[getCabinetImageOverrideKey(data)];
  saveCustomCabinetImages(images);
}

function readCustomImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function promptCustomCabinetImage(button) {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/webp,image/jpeg";

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const imageDataUrl = await readCustomImageFile(file);

    setCustomCabinetImage(button.dataset, imageDataUrl);

    renderCabinetItems();
    showAltarToast("Custom cabinet image saved");
  });

  fileInput.click();
}

function restoreDefaultCabinetImage(button) {
  removeCustomCabinetImage(button.dataset);
  renderCabinetItems();
  showAltarToast("Default image restored");
}

async function promptCustomAltarBackground() {
  const name = window.prompt("Name this altar background:", "My Custom Altar");
  if (!name || !name.trim()) return;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/webp,image/jpeg";

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const imageDataUrl = await readCustomImageFile(file);
    const backgrounds = getCustomAltarBackgrounds();

    backgrounds.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name: name.trim(),
      icon: "🖼️",
      keywords: ["custom", "uploaded", "background"],
      background: imageDataUrl,
      createdAt: new Date().toISOString()
    });

    saveCustomAltarBackgrounds(backgrounds);

    activeCabinetCategory = "backgrounds";
    renderCabinet();
    showAltarToast("Custom altar background saved");
  });

  fileInput.click();
}

function deleteCustomAltarBackground(backgroundId) {
  const backgrounds = getCustomAltarBackgrounds().filter((background) => {
    return background.id !== backgroundId;
  });

  saveCustomAltarBackgrounds(backgrounds);
  renderCabinetItems();
  showAltarToast("Custom background deleted");
}