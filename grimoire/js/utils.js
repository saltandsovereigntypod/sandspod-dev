/* =========================================================
   GRIMOIRE UTILITIES
   File: grimoire/js/utils.js
   ========================================================= */

function setStatus(message) {
  if (entryStatus) entryStatus.textContent = message || "";
}

function flashStatus(message) {
  setStatus(message);

  window.clearTimeout(flashStatus.timeout);
  flashStatus.timeout = window.setTimeout(() => {
    setStatus("");
  }, 2200);
}

function getUser() {
  return typeof currentUser !== "undefined" ? currentUser : null;
}

function requireUser() {
  const user = getUser();

  if (!user) {
    setStatus("Sign in to open your grimoire.");
    return null;
  }

  return user;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeHtml(value) {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");

  const allowedTags = ["B", "STRONG", "I", "EM", "U", "BR", "A", "SPAN"];
  const allowedAttrs = ["href", "target", "rel", "class"];

  template.content.querySelectorAll("*").forEach((node) => {
    if (!allowedTags.includes(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent || ""));
      return;
    }

    [...node.attributes].forEach((attr) => {
      if (!allowedAttrs.includes(attr.name)) {
        node.removeAttribute(attr.name);
      }
    });

    if (node.tagName === "A") {
      const href = node.getAttribute("href") || "";

      if (!href.startsWith("#") && !href.startsWith("http")) {
        node.removeAttribute("href");
      }

      node.setAttribute("rel", "noopener");
    }
  });

  return template.innerHTML;
}

function richText(value) {
  const clean = sanitizeHtml(value);
  return clean.trim() ? clean : "";
}

function plainToHtml(value) {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function debounceSave(key, callback) {
  window.clearTimeout(autosaveTimers[key]);

  autosaveTimers[key] = window.setTimeout(callback, AUTOSAVE_DELAY || 700);
}

function hideEmptyState() {
  if (!grimoireEmpty) return;

  grimoireEmpty.hidden = true;
  grimoireEmpty.style.display = "none";
}

function showEmptyState() {
  if (!grimoireEmpty) return;

  grimoireEmpty.hidden = false;
  grimoireEmpty.style.display = "";
}

function updateEditButton() {
  if (!editToggleButton) return;

  if (!currentPage) {
    editToggleButton.hidden = true;
    return;
  }

  editToggleButton.hidden = false;
  editToggleButton.textContent = pageMode === "edit" ? "Done" : "✎ Edit";
}

function getBlockMetadata(block) {
  if (!block || !block.metadata) return {};

  if (typeof block.metadata === "string") {
    try {
      return JSON.parse(block.metadata);
    } catch {
      return {};
    }
  }

  return block.metadata || {};
}

function blockContent(block) {
  if (!block) return "";
  return block.rich_content?.html || block.content || "";
}
