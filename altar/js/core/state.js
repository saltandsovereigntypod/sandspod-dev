/* =========================================================
   ALTAR STATE
   Shared elements, constants, and live state
   ========================================================= */

const altarStage = document.querySelector("[data-altar-stage]");
const emptyMessage = document.querySelector("[data-empty-message]");
const altarCabinet = document.querySelector(".altar-cabinet");
const cabinetTabs = document.querySelector("[data-cabinet-tabs]");
const cabinetContent = document.querySelector("[data-cabinet-content]");
const cabinetSearch = document.querySelector("[data-cabinet-search]");

let activeObject = null;
let selectedObject = null;
let offsetX = 0;
let offsetY = 0;
let highestLayer = 10;
let pendingCandleDressing = null;
let shouldSaveAfterAuth = false;
let altarSelectionMode = false;
let selectedRitualItems = [];
let altarGroups = [];
let activeGroupId = null;

let activeCabinetCategory = "candles";
let cabinetSearchTerm = "";

const ALTAR_GRIMOIRE_HANDOFF_KEY = "saltAndSovereigntyAltarToGrimoire";
const ALTAR_STORAGE_KEY = "saltAndSovereigntySavedAltars";
const ALTAR_CLOUD_TABLE = "saved_altars";
const ALTAR_MIGRATION_KEY = "saltAndSovereigntyAltarsMigratedToCloud";

const CANDLE_HERB_OVERLAY_SRC =
  "../assets/altar/overlays/candle-herb-overlay.png";

const CANDLE_OIL_OVERLAY_SRC =
  "../assets/altar/overlays/candle-oil-overlay.png";
