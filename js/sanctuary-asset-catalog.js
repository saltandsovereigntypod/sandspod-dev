(function initializeSanctuaryAssetCatalog(global) {
  const catalogue = Object.freeze({
    backgrounds: Object.freeze([
      { id: "forest-altar", name: "Forest Altar", assetPath: "/assets/altar/backgrounds/forest-scene.png", thumbnailPath: "/assets/altar/backgrounds/forest-scene.png" },
      { id: "deity-shelf-altar", name: "Deity Shelf Altar", assetPath: "/assets/altar/backgrounds/shelf-deity-altar.png", thumbnailPath: "/assets/altar/backgrounds/shelf-deity-altar.png" }
    ]),
    forms: Object.freeze({
      candle: Object.freeze([
        { id: "chime-spell", label: "Chime / Spell Candle", aliases: ["chime", "spell candle"], supportedAsset: false },
        { id: "taper", label: "Taper Candle", aliases: ["taper"], supportedAsset: false },
        { id: "tea-light", label: "Tea Light", aliases: ["tealight", "tea light"], supportedAsset: false },
        { id: "pillar", label: "Pillar Candle", aliases: ["pillar"], supportedAsset: false },
        { id: "vigil", label: "Vigil Candle", aliases: ["seven day", "vigil"], supportedAsset: true }
      ]),
      herb: Object.freeze([
        { id: "loose", label: "Loose", aliases: ["loose herb"] },
        { id: "fresh-sprig", label: "Fresh Sprig", aliases: ["sprig", "fresh"] },
        { id: "bundle", label: "Bundle", aliases: ["herb bundle"], supportedAsset: false },
        { id: "powder", label: "Powder", aliases: ["powdered herb"], supportedAsset: false }
      ]),
      crystal: Object.freeze([
        { id: "tumbled", label: "Tumbled Stone", aliases: ["tumbled"], supportedAsset: false },
        { id: "point", label: "Point", aliases: ["crystal point"] },
        { id: "cluster", label: "Cluster", aliases: ["crystal cluster"] },
        { id: "chips", label: "Chips", aliases: ["crystal chips"] }
      ])
    })
  });
  const unique = (records) => [...new Map(records.map((record) => [record.id, record])).values()];
  const api = {
    getBackgrounds: () => unique(catalogue.backgrounds).map((item) => ({ ...item })),
    getForms: (category) => unique(catalogue.forms[category] || []).map((item) => ({ ...item, aliases: [...(item.aliases || [])] }))
  };
  global.SanctuaryAssetCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
