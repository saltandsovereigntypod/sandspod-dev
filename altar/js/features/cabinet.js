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
    category: "herbs",
    name: "Cinnamon",
    icon: "🌿",
    keywords: ["prosperity", "speed", "success"],
    forms: [
      { label: "Sprig", image: "../assets/altar/objects/herbs/cinnamon/cinnamon-sprig.png", type: "herb", herb: "cinnamon", form: "sprig" },
      { label: "Loose", image: "../assets/altar/objects/herbs/cinnamon/cinnamon-loose.png", type: "herb", herb: "cinnamon", form: "loose" },
      { label: "Oil", image: "../assets/altar/objects/herbs/cinnamon/cinnamon-oil.png", type: "oil", herb: "cinnamon", form: "oil" }
    ]
  },

   {
      category: "herbs",
      name: "Basil",
      icon: "🌿",
      keywords: ["courage", "cleansing", "prosperity"],
      forms: [
        { label: "Sprig", image: "../assets/altar/objects/herbs/basil/basil-sprig.png", type: "herb", herb: "basil", form: "sprig" },
        { label: "Loose", image: "../assets/altar/objects/herbs/basil/basil-loose.png", type: "herb", herb: "basil", form: "loose" },
        { label: "Oil", image: "../assets/altar/objects/herbs/basil/basil-oil.png", type: "oil", herb: "basil", form: "oil" }
      ]
    },

   {
      category: "herbs",
      name: "Cedar",
      icon: "🌿",
      keywords: ["purification", "blessing", "grounding"],
      forms: [
        { label: "Sprig", image: "../assets/altar/objects/herbs/cedar/cedar-sprig.png", type: "herb", herb: "cedar", form: "sprig" },
        { label: "Loose", image: "../assets/altar/objects/herbs/cedar/cedar-loose.png", type: "herb", herb: "cedar", form: "loose" },
        { label: "Oil", image: "../assets/altar/objects/herbs/cedar/cedar-oil.png", type: "oil", herb: "cedar", form: "oil" }
      ]
    },

   {
      category: "herbs",
      name: "Chamomile",
      icon: "🌿",
      keywords: ["purification", "blessing", "grounding"],
      forms: [
        { label: "Sprig", image: "../assets/altar/objects/herbs/chamomile/chamomile-sprig.png", type: "herb", herb: "chamomile", form: "sprig" },
        { label: "Loose", image: "../assets/altar/objects/herbs/chamomile/chamomile-loose.png", type: "herb", herb: "chamomile", form: "loose" },
        { label: "Oil", image: "../assets/altar/objects/herbs/chamomile/chamomile-oil.png", type: "oil", herb: "chamomile", form: "oil" }
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
    category: "crystals",
    name: "Clear Quartz",
    icon: "💎",
    keywords: ["amplification", "clarity", "intention"],
    forms: [
      { label: "Point", image: "../assets/altar/objects/crystals/clear-quartz/clear-quartz-point.png", type: "crystal", crystal: "clear-quartz", form: "point" },
      { label: "Chips", image: "../assets/altar/objects/crystals/clear-quartz/clear-quartz-chips.png", type: "crystal", crystal: "clear-quartz", form: "chips" },
      { label: "Cluster", image: "../assets/altar/objects/crystals/clear-quartz/clear-quartz-cluster.png", type: "crystal", crystal: "clear-quartz", form: "cluster" }
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
    keywords: [ ],
    forms: [{ label: "Place", image: "../assets/altar/objects/tools/deities/lilith/lilith-statue.png", type: "deity", deity: "hekate", form: "statue" }]
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

  if (items.length === 0) {
    cabinetContent.innerHTML = `<p class="cabinet-empty">No cabinet items found.</p>`;
    return;
  }

  cabinetContent.innerHTML = items
    .map((item) => {
      if (item.background) {
        return `
          <button
            type="button"
            class="cabinet-tile cabinet-background-tile"
            data-background="${item.background}"
            data-background-name="${item.name}">
            <span class="cabinet-tile-icon">${item.icon || "✦"}</span>
            <span class="cabinet-tile-name">${item.name}</span>
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
            <span class="cabinet-tile-image-wrap">
              <img src="${form.image || ""}" alt="" class="cabinet-tile-image" loading="lazy" />
            </span>
            <span class="cabinet-tile-name">${item.name}</span>
          </button>
        `;
      }

      return `
        <article class="cabinet-multi-tile">
          <div class="cabinet-multi-heading">
            <span>${item.icon || "✦"}</span>
            <strong>${item.name}</strong>
          </div>

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
    .join("");
}

function renderCabinet() {
  renderCabinetTabs();
  renderCabinetItems();
}
