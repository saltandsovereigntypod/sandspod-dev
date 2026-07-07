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
  {
    category: "backgrounds",
    name: "Forest Altar",
    icon: "🌲",
    keywords: ["forest", "green", "crossroads"],
    background: "../assets/altar/backgrounds/forest-scene.png"
  },
  {
    category: "backgrounds",
    name: "Deity Shelf Altar",
    icon: "🕯️",
    keywords: ["shelf", "deity", "statues"],
    background: "../assets/altar/backgrounds/shelf-deity-altar.png"
  },

  ...["white", "black", "green", "purple", "red", "orange", "yellow", "blue", "brown", "pink", "gold", "silver"].map((color) => ({
    category: "candles",
    name: `${color.charAt(0).toUpperCase() + color.slice(1)} Candle`,
    icon: "🕯️",
    keywords: [color, "candle", "fire"],
    forms: [
      {
        label: "Place",
        image: `../assets/altar/objects/candles/${color}-candle.${color === "white" || color === "black" ? "PNG" : "png"}`,
        type: "candle",
        color,
        form: "standard"
      }
    ]
  })),

  ...[
    ["basil", "Basil", ["protection", "prosperity", "love", "courage", "cleansing"]],
    ["bay", "Bay", ["wishes", "protection", "victory", "divination", "success"], "bay-leaf", "bay"],
    ["cedar", "Cedar", ["protection", "purification", "blessing", "grounding", "ancestors"]],
    ["chamomile", "Chamomile", ["calm", "sleep", "luck", "money", "healing"]],
    ["cinnamon", "Cinnamon", ["prosperity", "passion", "speed", "success", "protection"]],
    ["clove", "Clove", ["protection", "prosperity", "friendship", "banishing"]],
    ["frankincense", "Frankincense", ["purification", "consecration", "spirituality", "protection"]],
    ["jasmine", "Jasmine", ["love", "dreams", "intuition", "lunar", "sensuality"]],
    ["lavender", "Lavender", ["peace", "sleep", "love", "healing", "purification"]],
    ["lemon_balm", "Lemon Balm", ["calm", "healing", "love", "happiness"], "lemon-balm"],
    ["mint", "Mint", ["prosperity", "clarity", "healing", "communication"]],
    ["mugwort", "Mugwort", ["dreams", "divination", "intuition", "thresholds"]],
    ["myrrh", "Myrrh", ["protection", "purification", "healing", "spirit work"]],
    ["nettle", "Nettle", ["protection", "boundaries", "courage", "uncrossing"]],
    ["patchouli", "Patchouli", ["prosperity", "grounding", "attraction", "stability"]],
    ["rose", "Rose", ["love", "compassion", "beauty", "healing", "grief"]],
    ["rosemary", "Rosemary", ["protection", "purification", "remembrance", "healing"]],
    ["sage", "Sage", ["cleansing", "wisdom", "protection", "purification"]],
    ["thyme", "Thyme", ["courage", "healing", "purification", "sleep"]],
    ["yarrow", "Yarrow", ["protection", "love", "boundaries", "divination"]]
  ].map(([id, name, keywords, folder = id.replaceAll("_", "-"), fileBase = folder]) => ({
    category: "herbs",
    name,
    icon: "🌿",
    keywords,
    forms: [
      { label: "Sprig", image: `../assets/altar/objects/herbs/${folder}/${fileBase}-sprig.png`, type: "herb", herb: id, form: "sprig" },
      { label: "Loose", image: `../assets/altar/objects/herbs/${folder}/${fileBase}-loose.png`, type: "herb", herb: id, form: "loose" },
      { label: "Oil", image: `../assets/altar/objects/herbs/${folder}/${fileBase}-oil.png`, type: "oil", herb: id, form: "oil" },
      { label: "Incense", image: "../assets/altar/objects/herbs/incense/incense.png", type: "herb", herb: id, form: "incense" }
    ]
  })),

  ...[
    ["amethyst", "Amethyst", ["intuition", "dreams", "meditation", "protection"]],
    ["black_tourmaline", "Black Tourmaline", ["protection", "grounding", "shielding", "warding"]],
    ["carnelian", "Carnelian", ["creativity", "courage", "vitality", "confidence"]],
    ["citrine", "Citrine", ["prosperity", "abundance", "success", "joy"]],
    ["clear_quartz", "Clear Quartz", ["amplification", "clarity", "healing", "cleansing"], "clear-quartz"],
    ["fluorite", "Fluorite", ["focus", "clarity", "study", "organization"]],
    ["garnet", "Garnet", ["strength", "passion", "devotion", "grounding"]],
    ["green_aventurine", "Green Aventurine", ["luck", "prosperity", "growth", "opportunity"], "green-aventurine"],
    ["hematite", "Hematite", ["grounding", "stability", "protection", "focus"]],
    ["labradorite", "Labradorite", ["transformation", "intuition", "magic", "protection"]],
    ["lapis_lazuli", "Lapis Lazuli", ["truth", "wisdom", "communication", "insight"], "lapis-lazuli"],
    ["malachite", "Malachite", ["transformation", "protection", "healing", "growth"]],
    ["moonstone", "Moonstone", ["intuition", "dreams", "cycles", "lunar"]],
    ["moss_agate", "Moss Agate", ["nature", "abundance", "growth", "grounding"], "moss-agate"],
    ["obsidian", "Obsidian", ["protection", "banishing", "grounding", "shadow work"]],
    ["pyrite", "Pyrite", ["prosperity", "confidence", "abundance", "success"]],
    ["rose_quartz", "Rose Quartz", ["love", "compassion", "self-love", "healing"], "rose-quartz"],
    ["selenite", "Selenite", ["cleansing", "charging", "peace", "clarity"]],
    ["smoky_quartz", "Smoky Quartz", ["grounding", "stability", "protection", "transmutation"], "smoky-quartz"],
    ["tiger_eye", "Tiger Eye", ["confidence", "courage", "focus", "protection"], "tiger-eye"]
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
        <img src="${displayImage}" alt="" class="cabinet-tile-image" loading="lazy" />
      </span>

      <span class="cabinet-tile-name">${isMultiForm ? form.label : item.name}</span>

      <span class="cabinet-custom-actions">
        <span data-upload-cabinet-image>${hasOverride ? "Change" : "Upload"}</span>
        ${hasOverride ? `<span data-restore-cabinet-image>Restore</span>` : ""}
      </span>
    </button>
  `;
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
          return `
            <div class="cabinet-custom-wrap">
              ${renderCabinetTile(item, forms[0], false)}

              ${
                item.customCabinetItemId
                  ? `
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

        return `
          <article class="cabinet-multi-tile">
            <div class="cabinet-multi-heading">
              <span>${item.icon || "✦"}</span>
              <strong>${item.name}</strong>
            </div>

            <div class="cabinet-form-grid">
              ${forms.map((form) => renderCabinetTile(item, form, true)).join("")}
            </div>
          </article>
        `;
      })
      .join("");
}

function renderCabinet() {
  renderCabinetTabs();
  renderCabinetItems();
}