/* =========================================================
   GRIMOIRE CONFIG
   File: grimoire/js/config.js
   ========================================================= */

/* ---------------------------------------------------------
   Block Types
--------------------------------------------------------- */

const BLOCK_TYPES = {
  paragraph: {
    label: "Paragraph",
    icon: "¶"
  },

  heading: {
    label: "Heading",
    icon: "H"
  },

  quote: {
    label: "Callout",
    icon: "❝"
  },

  divider: {
    label: "Divider",
    icon: "✦"
  },

  list: {
    label: "List",
    icon: "•"
  },

  checklist: {
    label: "Checklist",
    icon: "☐"
  },

  image: {
    label: "Image",
    icon: "🖼"
  },

  embed: {
    label: "Embed",
    icon: "🔗"
  }
};


/* ---------------------------------------------------------
   Rich Text Buttons
--------------------------------------------------------- */

const RICH_TEXT_ACTIONS = [
  {
    command: "bold",
    icon: "<b>B</b>",
    title: "Bold"
  },
  {
    command: "italic",
    icon: "<i>I</i>",
    title: "Italic"
  },
  {
    command: "underline",
    icon: "<u>U</u>",
    title: "Underline"
  },
  {
    command: "insertUnorderedList",
    icon: "•",
    title: "Bullet List"
  },
  {
    command: "insertOrderedList",
    icon: "1.",
    title: "Numbered List"
  }
];


/* ---------------------------------------------------------
   Default Page
--------------------------------------------------------- */

const DEFAULT_PAGE = {
  title: "Untitled Page",

  blocks: [
    {
      type: "paragraph",
      content: ""
    }
  ]
};


/* ---------------------------------------------------------
   Search
--------------------------------------------------------- */

const SEARCH_MIN_LENGTH = 2;


/* ---------------------------------------------------------
   Autosave
--------------------------------------------------------- */

const AUTOSAVE_DELAY = 700;


/* ---------------------------------------------------------
   Local Storage Keys
--------------------------------------------------------- */

const STORAGE_KEYS = {
  mundane: "saltMundaneMode",
  lastPage: "saltLastPage",
  lastSection: "saltLastSection"
};
