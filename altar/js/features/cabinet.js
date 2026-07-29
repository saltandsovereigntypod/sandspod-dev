/* =========================================================
   ALTAR CABINET
   Categories, cabinet items, background selection, rendering
   ========================================================= */

const cabinetCategories = [
  { id: "backgrounds", label: "Backgrounds", icon: "🌲" },
  { id: "candles", label: "Candles", icon: "🕯️" },
  { id: "herbs", label: "Herbs", icon: "🌿" },
  { id: "crystals", label: "Crystals", icon: "💎" },
  { id: "tools", label: "Tools", icon: "🗝️" },
  { id: "deities", label: "Deities", icon: "👑" },
  { id: "vessels", label: "Vessels", icon: "🏺" }
];

const cabinetItems = [
  ...(window.SanctuaryAssetCatalog?.getBackgrounds?.() || []).map((background) => ({ category: "backgrounds", name: background.name, icon: "🌲", keywords: [], background: background.assetPath })),

  ...["white", "black", "green", "purple", "red", "orange", "yellow", "blue", "brown", "pink", "gold", "silver"].map((color) => ({
    category: "candles",
    name: `${color.charAt(0).toUpperCase() + color.slice(1)} Candle`,
    icon: "🕯️",
    keywords: [color, "candle", "fire"],
    forms: (window.SanctuaryAssetCatalog?.getForms?.("candle") || []).map((form) => ({
      label: form.label,
      image: form.id === "vigil" ? `../assets/altar/objects/candles/${color}-candle.${color === "white" || color === "black" ? "PNG" : "png"}` : "",
      type: "candle", color, form: form.id, aliases: form.aliases || []
    }))
  })),

  ...[
    ["basil", "Basil", ["protection", "prosperity", "love", "courage", "cleansing"]],
    ["bay", "Bay", ["wishes", "protection", "victory", "divination", "success"], "bay-leaf", "bay"],
    ["cedar", "Cedar", ["protection", "purification", "blessing", "grounding", "ancestors"]],
    ["chamomile", "Chamomile", ["calm", "sleep", "luck", "money", "healing"]],
    ["cinnamon", "Cinnamon", ["prosperity", "passion", "speed", "success", "protection"]],
    ["lavender", "Lavender", ["peace", "sleep", "love", "healing", "purification"]],
    ["mugwort", "Mugwort", ["dreams", "divination", "intuition", "thresholds"]],
    ["rosemary", "Rosemary", ["protection", "purification", "remembrance", "healing"]],
    ["sage", "Sage", ["cleansing", "wisdom", "protection", "purification"]],
  ].map(([id, name, keywords, folder = id.replaceAll("_", "-"), fileBase = folder]) => {
    const hasBuiltInImages = new Set(["basil", "bay", "cedar", "chamomile", "cinnamon", "lavender", "mugwort", "rosemary"]).has(id);
    const herbImage = (form) => hasBuiltInImages ? `../assets/altar/objects/herbs/${folder}/${fileBase}-${form}.png` : "";
    return {
    category: "herbs",
    name,
    icon: "🌿",
    keywords,
    forms: [
      { label: "Sprig", image: herbImage("sprig"), type: "herb", herb: id, form: "sprig" },
      { label: "Loose", image: herbImage("loose"), type: "herb", herb: id, form: "loose" },
      { label: "Oil", image: herbImage("oil"), type: "oil", herb: id, form: "oil" },
      { label: "Incense", image: "../assets/altar/objects/herbs/incense/incense.png", type: "herb", herb: id, form: "incense" }
    ]
  }; }),

  ...[
    ["amethyst", "Amethyst", ["intuition", "dreams", "meditation", "protection"]],
    ["clear_quartz", "Clear Quartz", ["amplification", "clarity", "healing", "cleansing"], "clear-quartz"],
  ].map(([id, name, keywords, folder = id.replaceAll("_", "-")]) => ({
    category: "crystals",
    name,
    icon: "💎",
    keywords,
    forms: [
      { label: "Point", image: `../assets/altar/objects/crystals/${folder}/${folder}-point.png`, type: "crystal", crystal: id, form: "point" },
      { label: "Chips", image: `../assets/altar/objects/crystals/${folder}/${folder}-chips.png`, type: "crystal", crystal: id, form: "chips" },
      { label: "Cluster", image: `../assets/altar/objects/crystals/${folder}/${folder}-cluster.png`, type: "crystal", crystal: id, form: "cluster" }
    ]
  })),

  {
    category: "tools",
    name: "Key",
    icon: "🗝️",
    keywords: ["thresholds", "unlocking", "Hekate"],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/key/key.png", type: "tool", tool: "key", form: "standard" }]
  },
  {
    category: "tools",
    name: "Athame",
    icon: "🗡️",
    keywords: ["cutting", "will", "boundary"],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/athame/athame.png", type: "tool", tool: "athame", form: "standard" }]
  },
  {
    category: "tools",
    name: "Raven Skull",
    icon: "☠️",
    keywords: ["death", "messages", "mystery"],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/raven-skull/raven-skull.png", type: "tool", tool: "raven-skull", form: "standard" }]
  },
  {
    category: "tools",
    name: "Black Salt",
    icon: "⚫",
    keywords: ["protection", "banishing", "warding"],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/black-salt/black-salt.png", type: "tool", tool: "black-salt", form: "pile" }]
  },
  {
    category: "tools",
    name: "Salt Circle",
    icon: "⭕️",
    keywords: ["protection", "banishing", "warding"],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/salt-circle/2E77AAEA-4775-4EB3-9EEF-659AB1218A61.png", type: "tool", tool: "salt-circle", form: "pile" }]
  },
  {
    category: "deities",
    name: "Hekate Statue",
    icon: "🗝️",
    keywords: ["crossroads", "torches", "keys"],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/deities/hekate/hekate-statue.png", type: "deity", deity: "hekate", form: "statue" }]
  },
  {
    category: "deities",
    name: "Lilith Statue",
    icon: "🗝️",
    keywords: [],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/deities/lilith/lilith-statue.png", type: "deity", deity: "lilith", form: "statue" }]
  },
  {
    category: "vessels",
    name: "Cauldron",
    icon: "⚗️",
    keywords: ["transformation", "fire", "spellwork"],
    forms: [{ label: "Place", image: "../assets/altar/objects/vessels/cauldron/cauldron.png", type: "vessel", vessel: "cauldron", form: "standard" }]
  },
  {
    category: "vessels",
    name: "Spell Jar",
    icon: "🫙",
    keywords: ["container", "spell", "intention"],
    forms: [{ label: "Place", image: "../assets/altar/objects/vessels/spell-jar/spell-jar.png", type: "vessel", vessel: "spell-jar", form: "standard" }]
  }
];

// Narrow public catalogue for shared Settings. Keep cabinet internals private.
window.AltarBackgrounds = {
  getAll() {
    return (window.SanctuaryAssetCatalog?.getBackgrounds?.() || []).map((item) => ({ id: item.id, name: item.name, background: item.assetPath, thumbnail: item.thumbnailPath }));
  }
};
window.dispatchEvent(new CustomEvent("altarBackgroundsReady"));

function cabinetSearchAliases(item) {
  const formWords = (item.forms || []).flatMap((form) => [form.label, form.type, form.form]);
  const variants = item.category === "candles" ? ["candle", "candles"]
    : item.category === "herbs" ? ["herb", "herbs"]
      : item.category === "crystals" ? ["crystal", "crystals"]
        : item.name === "Spell Jar" ? ["jar", "spell jar", "spell jars"] : [];
  return [...new Set([...(item.keywords || []), ...formWords, ...variants].filter(Boolean))];
}

function cabinetItemId(item) {
  return `${item.category}:${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function placeCabinetDefinition({ itemId, formId } = {}) {
  const item = cabinetItems.find((candidate) => cabinetItemId(candidate) === itemId);
  if (!item) { showAltarToast("Cabinet item not found"); return false; }
  const availableForms = partitionCabinetForms(item).availableForms;
  const form = formId ? availableForms.find((candidate) => (candidate.form || candidate.label) === formId) : availableForms.length === 1 ? availableForms[0] : null;
  if (!form) {
    activeCabinetCategory = item.category;
    cabinetSearchTerm = item.name;
    if (cabinetSearch) cabinetSearch.value = item.name;
    renderCabinet();
    openAltarCabinetOverlay();
    showAltarToast(availableForms.length ? "Choose a form to place" : "Add a form image before placing this item");
    return true;
  }
  placeObject({ imagePath: getCabinetDisplayImage(item, form), label: item.forms.length > 1 ? `${item.name} ${form.label}` : item.name, type: form.type || "", herb: form.herb || "", form: form.form || "", color: form.color || "", crystal: form.crystal || "", tool: form.tool || "", vessel: form.vessel || "", deity: form.deity || "", entityId: form.entityId || item.entityId || "" });
  return true;
}

window.AltarCabinet = {
  placeItem: placeCabinetDefinition,
  partitionForms: partitionCabinetForms,
  getFormPresentation(itemId) {
    const item = cabinetItems.find((candidate) => cabinetItemId(candidate) === itemId);
    if (!item) return null;
    const partition = partitionCabinetForms(item);
    return { availableForms: partition.availableForms.map((form) => form.form || form.label), missingForms: partition.missingForms.map((form) => form.form || form.label) };
  },
  getSearchRecords() {
    return cabinetItems.filter((item) => item.category !== "backgrounds").flatMap((item, index) => {
      const stableId = cabinetItemId(item);
      const base = `/altar/?placeCabinetItem=${encodeURIComponent(stableId)}`;
      const itemRecord = { id: `cabinet:${stableId}:${index}`, group: "cabinet", source: "altar-cabinet", type: item.forms?.[0]?.type || item.category, title: item.name, subtitle: "Altar Cabinet", aliases: cabinetSearchAliases(item), fields: [item.category, "cabinet asset"], href: base, destination: { kind: "place-cabinet-item", category: item.category, itemId: stableId, entityId: item.entityId || "", href: base } };
      const formRecords = (item.forms || []).map((form) => { const formId = form.form || form.label; const href = `${base}&form=${encodeURIComponent(formId)}`; return { id: `${itemRecord.id}:form:${formId}`, group: "cabinet", source: "altar-cabinet-form", type: form.type || item.category, title: form.label, subtitle: `${form.type === "candle" ? "Candle" : "Object"} Form · ${item.name}`, aliases: [item.name, `${item.name} ${form.label}`, ...(form.aliases || [])], fields: [item.category, item.name, form.form], href, destination: { kind: "place-cabinet-item", category: item.category, itemId: stableId, entityId: form.entityId || item.entityId || "", formId, href } }; });
      return [itemRecord, ...formRecords];
    });
  }
};
window.dispatchEvent(new CustomEvent("altarCabinetReady"));

const cabinetSearchParams = new URLSearchParams(window.location.search);
const requestedCabinetCategory = cabinetSearchParams.get("cabinet");
if (cabinetCategories.some((category) => category.id === requestedCabinetCategory)) activeCabinetCategory = requestedCabinetCategory;

function changeAltarBackground(button) {
  if (!altarStage || !button) return;

  const backgroundPath = button.dataset.background || "";
  const backgroundName = button.dataset.backgroundName || "Altar background";

  if (!backgroundPath) return;

  altarStage.style.backgroundImage = `url("${backgroundPath}")`;
  altarStage.dataset.background = backgroundPath;
  altarStage.dataset.backgroundName = backgroundName;

  showAltarToast(`${backgroundName} selected`);
  saveWorkingAltarDraft();
}

function renderCabinetTabs() {
  if (!cabinetTabs) return;

  cabinetTabs.innerHTML = cabinetCategories
    .map((category) => `
      <button
        type="button"
        class="cabinet-tab ${category.id === activeCabinetCategory ? "is-active" : ""}"
        data-cabinet-category="${category.id}">
        <span>${category.icon}</span>
        ${category.label}
      </button>
    `)
    .join("");
}

function getCabinetDisplayImage(item, form) {
  const label = form.label === "Place" ? item.name : `${item.name} ${form.label}`;

  const overrideImage =
    typeof getCustomCabinetImage === "function"
      ? getCustomCabinetImage({
          label,
          type: form.type || "",
          herb: form.herb || "",
          form: form.form || "",
          color: form.color || "",
          crystal: form.crystal || "",
          tool: form.tool || "",
          vessel: form.vessel || "",
          deity: form.deity || ""
        })
      : "";

  return overrideImage || form.image || "";
}

function renderCabinetTile(item, form, isMultiForm = false) {
  const label = isMultiForm ? `${item.name} ${form.label}` : item.name;
  const displayImage = getCabinetDisplayImage(item, form);

  const hasOverride =
    typeof getCustomCabinetImage === "function" &&
    Boolean(
      getCustomCabinetImage({
        label,
        type: form.type || "",
        herb: form.herb || "",
        form: form.form || "",
        color: form.color || "",
        crystal: form.crystal || "",
        tool: form.tool || "",
        vessel: form.vessel || "",
        deity: form.deity || ""
      })
    );

  return `
    <button
      type="button"
      class="cabinet-tile ${isMultiForm ? "cabinet-form-tile" : ""}"
      data-image="${displayImage}"
      data-label="${label}"
      data-form-label="${form.label || item.name}"
      data-entity-id="${form.entityId || item.entityId || ""}"
      data-type="${form.type || ""}"
      data-herb="${form.herb || ""}"
      data-form="${form.form || ""}"
      data-color="${form.color || ""}"
      data-crystal="${form.crystal || ""}"
      data-tool="${form.tool || ""}"
      data-vessel="${form.vessel || ""}"
      data-deity="${form.deity || ""}">
      <span class="cabinet-tile-image-wrap">
        ${displayImage ? `<img src="${displayImage}" alt="${form.label || item.name} preview" class="cabinet-tile-image" loading="lazy" />` : '<span class="cabinet-form-unavailable">Image unavailable</span>'}
      </span>

      <span class="cabinet-tile-name">${isMultiForm ? form.label : item.name}</span>

      <span class="cabinet-custom-actions">
        <span data-upload-cabinet-image>${hasOverride ? "Replace Form Image" : "Add Form Image"}</span>
        ${hasOverride ? `<span data-restore-cabinet-image>Remove Override</span>` : ""}
      </span>
    </button>
  `;
}

function partitionCabinetForms(item, forms = item.forms || []) {
  const availableForms = [];
  const missingForms = [];
  forms.forEach((form) => (getCabinetDisplayImage(item, form) ? availableForms : missingForms).push(form));
  return { availableForms, missingForms };
}

function renderMissingFormAction(item, form) {
  return `<button type="button" class="cabinet-missing-form-action" data-upload-cabinet-image data-image="" data-label="${item.name} ${form.label}" data-form-label="${form.label}" data-type="${form.type || ""}" data-form="${form.form || ""}" data-color="${form.color || ""}" data-herb="${form.herb || ""}" data-crystal="${form.crystal || ""}" data-entity-id="${form.entityId || item.entityId || ""}">Add ${form.label} Image</button>`;
}

function renderCabinetBackgroundTile(item) {
  return `
    <div class="cabinet-custom-wrap">
      <button
        type="button"
        class="cabinet-tile cabinet-background-tile"
        data-background="${item.background}"
        data-background-name="${item.name}">
        <span class="cabinet-tile-icon">${item.icon || "✦"}</span>
        <span class="cabinet-tile-name">${item.name}</span>
      </button>

      ${
        item.customBackgroundId
          ? `
            <button
              type="button"
              class="cabinet-mini-action"
              data-delete-custom-background="${item.customBackgroundId}">
              Delete
            </button>
          `
          : ""
      }
    </div>
  `;
}

function renderCabinetItems() {
  if (!cabinetContent) return;

  const search = cabinetSearchTerm.toLowerCase();

  const customBackgrounds =
    activeCabinetCategory === "backgrounds" && typeof customAltarBackgroundsCache !== "undefined"
      ? customAltarBackgroundsCache
      : [];

  const customCabinetItems =
    typeof customCabinetItemsCache !== "undefined"
      ? customCabinetItemsCache
      : [];

  const items = [...customBackgrounds, ...customCabinetItems, ...cabinetItems].filter((item) => {
    const matchesCategory = item.category === activeCabinetCategory;
    const searchable = [
      item.name,
      item.category,
      ...(item.keywords || []),
      ...(item.grimoireKeywords || [])
    ].join(" ").toLowerCase();

    return matchesCategory && searchable.includes(search);
  });

  if (items.length === 0 && activeCabinetCategory !== "backgrounds") {
    cabinetContent.innerHTML = `<p class="cabinet-empty">No cabinet items found.</p>`;
    return;
  }

  const addCustomItemTile =
    activeCabinetCategory !== "backgrounds"
      ? `
        <button type="button" class="cabinet-tile cabinet-background-tile" data-add-custom-cabinet-item>
          <span class="cabinet-tile-icon">＋</span>
          <span class="cabinet-tile-name">Create Custom Item</span>
        </button>
      `
      : "";

  const addBackgroundTile =
    activeCabinetCategory === "backgrounds"
      ? `
        <button type="button" class="cabinet-tile cabinet-background-tile" data-add-custom-background>
          <span class="cabinet-tile-icon">＋</span>
          <span class="cabinet-tile-name">Upload Background</span>
        </button>
      `
      : "";

  cabinetContent.innerHTML =
    addBackgroundTile +
    addCustomItemTile +
    items
      .map((item) => {
        if (item.background) {
          return renderCabinetBackgroundTile(item);
        }

        const forms = item.forms || [];

        if (forms.length === 1) {
          const missingForms =
            item.customCabinetItemId && typeof CUSTOM_FORM_PRESETS !== "undefined"
              ? (CUSTOM_FORM_PRESETS[item.category] || [])
                  .filter((formLabel) => !forms.some((form) => form.label === formLabel))
              : [];

          return `
            <div class="cabinet-custom-wrap">
              ${renderCabinetTile(item, forms[0], false)}

              ${
                missingForms.length
                  ? `
                    <div class="cabinet-missing-forms">
                      ${missingForms
                        .map((formLabel) => `
                          <button
                            type="button"
                            class="cabinet-missing-form"
                            data-edit-custom-cabinet-item="${item.customCabinetItemId}"
                            data-focus-custom-form="${formLabel}">
                            + ${formLabel}
                          </button>
                        `)
                        .join("")}
                    </div>
                  `
                  : ""
              }

              ${
                item.customCabinetItemId
                  ? `
                    <button
                      type="button"
                      class="cabinet-mini-action"
                      data-edit-custom-cabinet-item="${item.customCabinetItemId}">
                      Edit
                    </button>

                    <button
                      type="button"
                      class="cabinet-mini-action"
                      data-delete-custom-cabinet-item="${item.customCabinetItemId}">
                      Delete
                    </button>
                  `
                  : ""
              }
            </div>
          `;
        }

        const partition = !item.customCabinetItemId ? partitionCabinetForms(item, forms) : { availableForms: forms, missingForms: [] };
        const missingForms =
        item.customCabinetItemId && typeof CUSTOM_FORM_PRESETS !== "undefined"
          ? (CUSTOM_FORM_PRESETS[item.category] || [])
              .filter((formLabel) => !forms.some((form) => form.label === formLabel))
          : [];

      return `
        <article class="cabinet-multi-tile">
          <div class="cabinet-multi-heading">
            <span>${item.icon || "✦"}</span>
            <strong>${item.name}</strong>
          </div>

          <div class="cabinet-form-grid">
            ${partition.availableForms.map((form) => renderCabinetTile(item, form, true)).join("")}

            ${
              missingForms.length
                ? missingForms
                    .map((formLabel) => `
                      <button
                        type="button"
                        class="cabinet-tile cabinet-form-tile cabinet-missing-form"
                        data-edit-custom-cabinet-item="${item.customCabinetItemId}"
                        data-focus-custom-form="${formLabel}">
                        <span class="cabinet-tile-icon">＋</span>
                        <span class="cabinet-tile-name">Add ${formLabel}</span>
                      </button>
                    `)
                    .join("")
                : ""
            }
          </div>
          ${partition.missingForms.length ? `<div class="cabinet-missing-form-actions">${partition.missingForms.map((form) => renderMissingFormAction(item, form)).join("")}</div>` : ""}

          ${
            item.customCabinetItemId
              ? `
                <div class="cabinet-custom-actions-row">
                  <button
                    type="button"
                    class="cabinet-mini-action"
                    data-edit-custom-cabinet-item="${item.customCabinetItemId}">
                    Edit
                  </button>

                  <button
                    type="button"
                    class="cabinet-mini-action"
                    data-delete-custom-cabinet-item="${item.customCabinetItemId}">
                    Delete
                  </button>
                </div>
              `
              : ""
          }
        </article>
      `;
      })
      .join("");

  const requestedItem = cabinetSearchParams.get("item");
  const requestedForm = cabinetSearchParams.get("form");
  if (requestedItem) {
    const targetLabel = requestedForm ? `${requestedItem} ${requestedForm}`.toLowerCase().replaceAll("-", " ") : requestedItem.toLowerCase();
    const tile = [...cabinetItemsGrid.querySelectorAll("[data-label]")].find((item) => String(item.dataset.label || "").toLowerCase().replaceAll("-", " ").includes(targetLabel));
    if (tile) { tile.classList.add("is-search-target"); tile.scrollIntoView({ block: "nearest" }); }
  }
}

function renderCabinet() {
  renderCabinetTabs();
  renderCabinetItems();
}

if (typeof cabinetContent !== "undefined" && cabinetContent && !cabinetContent.dataset.formImageFallbackInstalled) {
  cabinetContent.dataset.formImageFallbackInstalled = "true";
  cabinetContent.addEventListener("error", (event) => {
    const image = event.target.closest?.(".cabinet-tile-image");
    const tile = image?.closest?.(".cabinet-form-tile[data-image]");
    if (!tile) return;
    tile.dataset.image = "";
    tile.className = "cabinet-missing-form-action";
    tile.setAttribute("data-upload-cabinet-image", "");
    tile.textContent = `Add ${tile.dataset.formLabel || "Form"} Image`;
  }, true);
}
