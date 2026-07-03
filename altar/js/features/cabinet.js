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
        color
      }
    ]
  })),

  {
    category: "herbs",
    name: "Rosemary",
    icon: "🌿",
    keywords: ["protection", "cleansing", "memory"],
    forms: [
      { label: "Sprig", image: "../assets/altar/objects/herbs/rosemary/rosemary-sprig.png", type: "herb", herb: "rosemary", form: "sprig" },
      { label: "Loose", image: "../assets/altar/objects/herbs/rosemary/rosemary-loose.png", type: "herb", herb: "rosemary", form: "loose" },
      { label: "Oil", image: "../assets/altar/objects/herbs/rosemary/rosemary-oil.png", type: "oil", herb: "rosemary", form: "oil" }
    ]
  },
  {
    category: "herbs",
    name: "Lavender",
    icon: "🌿",
    keywords: ["peace", "sleep", "calming"],
    forms: [
      { label: "Sprig", image: "../assets/altar/objects/herbs/lavender/lavender-sprig.png", type: "herb", herb: "lavender", form: "sprig" },
      { label: "Loose", image: "../assets/altar/objects/herbs/lavender/lavender-loose.png", type: "herb", herb: "lavender", form: "loose" },
      { label: "Oil", image: "../assets/altar/objects/herbs/lavender/lavender-oil.png", type: "oil", herb: "lavender", form: "oil" }
    ]
  },
  {
    category: "herbs",
    name: "Mugwort",
    icon: "🌿",
    keywords: ["dreams", "intuition", "thresholds"],
    forms: [
      { label: "Sprig", image: "../assets/altar/objects/herbs/mugwort/mugwort-sprig.png", type: "herb", herb: "mugwort", form: "sprig" },
      { label: "Loose", image: "../assets/altar/objects/herbs/mugwort/mugwort-loose.png", type: "herb", herb: "mugwort", form: "loose" },
      { label: "Oil", image: "../assets/altar/objects/herbs/mugwort/mugwort-oil.png", type: "oil", herb: "mugwort", form: "oil" }
    ]
  },
  {
    category: "herbs",
    name: "Bay Leaf",
    icon: "🌿",
    keywords: ["wishes", "protection", "manifestation"],
    forms: [
      { label: "Sprig", image: "../assets/altar/objects/herbs/bay-leaf/bay-sprig.png", type: "herb", herb: "bay leaf", form: "sprig" },
      { label: "Loose", image: "../assets/altar/objects/herbs/bay-leaf/bay-loose.png", type: "herb", herb: "bay leaf", form: "loose" },
      { label: "Oil", image: "../assets/altar/objects/herbs/bay-leaf/bay-oil.png", type: "oil", herb: "bay leaf", form: "oil" }
    ]
  },

  {
    category: "crystals",
    name: "Amethyst",
    icon: "💎",
    keywords: ["intuition", "dreams", "calm"],
    forms: [
      { label: "Point", image: "../assets/altar/objects/crystals/amethyst/amethyst-point.png", type: "crystal", crystal: "amethyst", form: "point" },
      { label: "Chips", image: "../assets/altar/objects/crystals/amethyst/amethyst-chips.png", type: "crystal", crystal: "amethyst", form: "chips" },
      { label: "Cluster", image: "../assets/altar/objects/crystals/amethyst/amethyst-cluster.png", type: "crystal", crystal: "amethyst", form: "cluster" }
    ]
  },

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
    category: "deities",
    name: "Hekate Statue",
    icon: "🗝️",
    keywords: ["crossroads", "torches", "keys"],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/deities/hekate/hekate-statue.png", type: "deity", deity: "hekate", form: "statue" }]
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
}

const cabinetCategoryDescriptions = {
  backgrounds: "Choose the room your altar lives inside.",
  candles: "Color, flame, focus, and ritual timing.",
  herbs: "Sprigs, loose herbs, and oils for spellwork.",
  crystals: "Stones, chips, points, and clusters.",
  tools: "Keys, blades, salts, bones, and ritual tools.",
  deities: "Statues and devotional presences.",
  vessels: "Containers, cauldrons, bottles, bowls, and jars."
};

function getCabinetCategoryCount(categoryId) {
  return cabinetItems.filter((item) => item.category === categoryId).length;
}

function getCabinetFormCount(item) {
  if (item.background) return 1;
  return Array.isArray(item.forms) ? item.forms.length : 0;
}

function renderCabinetTabs() {
  if (!cabinetTabs) return;

  cabinetTabs.innerHTML = cabinetCategories
    .map((category) => {
      const count = getCabinetCategoryCount(category.id);

      return `
        <button
          type="button"
          class="cabinet-tab ${category.id === activeCabinetCategory ? "is-active" : ""}"
          data-cabinet-category="${category.id}">
          <span class="cabinet-tab-icon">${category.icon}</span>
          <span class="cabinet-tab-label">${category.label}</span>
          <span class="cabinet-tab-count">${count}</span>
        </button>
      `;
    })
    .join("");
}

function renderCabinetItems() {
  if (!cabinetContent) return;

  const search = cabinetSearchTerm.toLowerCase();

  const items = cabinetItems.filter((item) => {
    const matchesCategory = item.category === activeCabinetCategory;
    const searchable = [
      item.name,
      item.category,
      ...(item.keywords || []),
      ...(item.grimoireKeywords || [])
    ].join(" ").toLowerCase();

    return matchesCategory && searchable.includes(search);
  });

  const activeCategory = cabinetCategories.find((category) => {
    return category.id === activeCabinetCategory;
  });

  const categoryIntro = `
    <div class="cabinet-category-intro">
      <p class="eyebrow">${activeCategory?.icon || "✦"} ${activeCategory?.label || "Cabinet"}</p>
      <h3>${activeCategory?.label || "Cabinet"}</h3>
      <p>${cabinetCategoryDescriptions[activeCabinetCategory] || "Choose what belongs on your altar."}</p>
    </div>
  `;

  if (items.length === 0) {
    cabinetContent.innerHTML = `
      ${categoryIntro}
      <p class="cabinet-empty">No cabinet items found. Try another search term.</p>
    `;
    return;
  }

  cabinetContent.innerHTML = `
    ${categoryIntro}

    ${items
      .map((item) => {
        const formCount = getCabinetFormCount(item);
        const keywordText = (item.keywords || []).slice(0, 3).join(" · ");

        if (item.background) {
          return `
            <button
              type="button"
              class="cabinet-tile cabinet-background-tile"
              data-background="${item.background}"
              data-background-name="${item.name}">
              <span class="cabinet-tile-icon">${item.icon || "✦"}</span>
              <span class="cabinet-tile-name">${item.name}</span>
              <span class="cabinet-tile-meta">${keywordText || "Altar room"}</span>
            </button>
          `;
        }

        const forms = item.forms || [];

        if (forms.length === 1) {
          const form = forms[0];

          return `
            <button
              type="button"
              class="cabinet-tile"
              data-image="${form.image || ""}"
              data-label="${item.name}"
              data-type="${form.type || ""}"
              data-herb="${form.herb || ""}"
              data-form="${form.form || ""}"
              data-color="${form.color || ""}"
              data-crystal="${form.crystal || ""}"
              data-tool="${form.tool || ""}"
              data-vessel="${form.vessel || ""}"
              data-deity="${form.deity || ""}">
              <span class="cabinet-tile-badge">${formCount} form</span>
              <span class="cabinet-tile-image-wrap">
                <img src="${form.image || ""}" alt="" class="cabinet-tile-image" loading="lazy" />
              </span>
              <span class="cabinet-tile-name">${item.name}</span>
              <span class="cabinet-tile-meta">${keywordText}</span>
            </button>
          `;
        }

        return `
          <article class="cabinet-multi-tile">
            <div class="cabinet-multi-heading">
              <span>${item.icon || "✦"}</span>
              <strong>${item.name}</strong>
              <em>${forms.length} forms</em>
            </div>

            <p class="cabinet-multi-meta">${keywordText}</p>

            <div class="cabinet-form-grid">
              ${forms
                .map((form) => `
                  <button
                    type="button"
                    class="cabinet-tile cabinet-form-tile"
                    data-image="${form.image || ""}"
                    data-label="${item.name} ${form.label}"
                    data-type="${form.type || ""}"
                    data-herb="${form.herb || ""}"
                    data-form="${form.form || ""}"
                    data-color="${form.color || ""}"
                    data-crystal="${form.crystal || ""}"
                    data-tool="${form.tool || ""}"
                    data-vessel="${form.vessel || ""}"
                    data-deity="${form.deity || ""}">
                    <span class="cabinet-tile-image-wrap">
                      <img src="${form.image || ""}" alt="" class="cabinet-tile-image" loading="lazy" />
                    </span>
                    <span class="cabinet-tile-name">${form.label}</span>
                  </button>
                `)
                .join("")}
            </div>
          </article>
        `;
      })
      .join("")}
  `;
}

function renderCabinet() {
  renderCabinetTabs();
  renderCabinetItems();
}
