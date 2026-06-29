/* =========================================================
   GRIMOIRE CONFIG
   File: grimoire/js/config.js
   ========================================================= */

const ELEMENT_TYPES = [
  { type: "text", label: "Paragraph", group: "Writing" },
  { type: "heading", label: "Heading", group: "Writing" },
  { type: "callout", label: "Note / Quote", group: "Writing" },
  { type: "divider", label: "Divider", group: "Structure" },
  { type: "checklist", label: "Checklist", group: "Structure" },
  { type: "bulleted_list", label: "Bulleted List", group: "Structure" },
  { type: "numbered_list", label: "Numbered List", group: "Structure" },
  { type: "ingredient_list", label: "Ingredient List", group: "Magical" },
  { type: "correspondence", label: "Correspondence", group: "Magical" },
  { type: "image", label: "Image", group: "Media & Links" },
  { type: "page_link", label: "Page Link", group: "Media & Links" }
];

const PAGE_TEMPLATES = {
  blank: {
    label: "Blank Page",
    blocks: [{ type: "text", content: "" }]
  },

  herb: {
    label: "Herb Entry",
    blocks: [
      { type: "heading", content: "Correspondences" },
      { type: "correspondence", content: "Planet:\nElement:\nDeities:\nMagical uses:" },
      { type: "heading", content: "Traditional Uses" },
      { type: "text", content: "" },
      { type: "heading", content: "Warnings" },
      { type: "callout", content: "Add any safety notes, contraindications, or personal cautions here." },
      { type: "heading", content: "Personal Notes" },
      { type: "text", content: "" }
    ]
  },

  crystal: {
    label: "Crystal Entry",
    blocks: [
      { type: "heading", content: "Correspondences" },
      { type: "correspondence", content: "Element:\nChakra:\nPlanet:\nMagical uses:" },
      { type: "heading", content: "How I Work With It" },
      { type: "text", content: "" },
      { type: "heading", content: "Personal Notes" },
      { type: "text", content: "" }
    ]
  },

  deity: {
    label: "Deity Entry",
    blocks: [
      { type: "heading", content: "Titles and Epithets" },
      { type: "text", content: "" },
      { type: "heading", content: "Offerings" },
      { type: "ingredient_list", content: "" },
      { type: "heading", content: "Signs and Symbols" },
      { type: "bulleted_list", content: "" },
      { type: "heading", content: "Personal Relationship" },
      { type: "text", content: "" }
    ]
  },

  dream: {
    label: "Dream Journal",
    blocks: [
      { type: "heading", content: "Dream Notes" },
      { type: "text", content: "" },
      { type: "heading", content: "Symbols" },
      { type: "bulleted_list", content: "" },
      { type: "heading", content: "Interpretation" },
      { type: "text", content: "" }
    ]
  },

  ritual: {
    label: "Ritual",
    blocks: [
      { type: "heading", content: "Purpose" },
      { type: "text", content: "" },
      { type: "heading", content: "Materials" },
      { type: "ingredient_list", content: "" },
      { type: "heading", content: "Ritual Steps" },
      { type: "numbered_list", content: "" },
      { type: "heading", content: "Reflections" },
      { type: "text", content: "" }
    ]
  },

  tarot: {
    label: "Tarot Reading",
    blocks: [
      { type: "heading", content: "Question" },
      { type: "text", content: "" },
      { type: "heading", content: "Cards Pulled" },
      { type: "bulleted_list", content: "" },
      { type: "heading", content: "Interpretation" },
      { type: "text", content: "" }
    ]
  },

  moon: {
    label: "Moon Journal",
    blocks: [
      { type: "heading", content: "Moon Phase" },
      { type: "text", content: "" },
      { type: "heading", content: "Energy" },
      { type: "text", content: "" },
      { type: "heading", content: "Intentions or Release" },
      { type: "text", content: "" }
    ]
  }
};

const AUTOSAVE_DELAY = 700;
