/* =========================================================
   GRIMOIRE STATE
   File: grimoire/js/state.js
   ========================================================= */

/* DOM ELEMENTS */
const grimoireAuthNotice = document.querySelector("[data-grimoire-auth-notice]");
const entryStatus = document.querySelector("[data-entry-status]");
const entryList = document.querySelector("[data-entry-list]");
const grimoireEmpty = document.querySelector("[data-grimoire-empty]");
const grimoireHeading = document.querySelector("[data-grimoire-heading]");
const entrySearch = document.querySelector("[data-entry-search]");
const grimoireShelf = document.querySelector("[data-grimoire-toc]");
const editToggleButton = document.querySelector("[data-toggle-edit]");
const mundaneToggle = document.querySelector("[data-mundane-toggle]");

/* APP STATE */
let currentBook = null;
let sections = [];
let pages = [];
let currentPage = null;
let currentBlocks = [];
let pageLinks = [];

let activeSectionId = null;
let pageMode = "read";
let searchTerm = "";
let autosaveTimers = {};
let activeRichEditor = null;
let mundaneMode = localStorage.getItem("saltMundaneMode") === "true";
