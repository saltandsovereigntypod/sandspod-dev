/* =========================================================
   8. SELECTION AND TOOLBAR NOTES
   ========================================================= */

function getObjectIcon(object) {
  const type = object.dataset.type;

  if (type === "candle") return "🕯️";
  if (type === "herb") return "🌿";
  if (type === "oil") return "🧴";
  if (type === "crystal") return "💎";
  if (type === "deity") return "🗝️";
  if (type === "vessel") return "🏺";
  if (type === "tool") return "✦";

  return "✦";
}

function getObjectTypeLabel(object) {
  const type = object.dataset.type || "altar object";
  const form = object.dataset.form || "";

  if (form && form !== "standard") {
    return `${type} · ${form}`;
  }

  return type;
}

function showAltarInfoCard(object) {
  if (!altarInfoCard || !object) return;

  const label = object.dataset.label || "Altar Object";
  const activeGroup = object.dataset.groupId
    ? altarGroups.find((group) => group.id === object.dataset.groupId)
    : null;

  const dressings = getDressings(object);
  const oils = dressings
    .filter((dressing) => dressing.type === "oil")
    .map((dressing) => dressing.herb)
    .filter(Boolean);

  const herbs = dressings
    .filter((dressing) => dressing.type === "herb")
    .map((dressing) => dressing.herb)
    .filter(Boolean);

  const dressingMarkup =
    oils.length || herbs.length
      ? `
        <div class="altar-info-card-section">
          <p>Dressing</p>
          ${oils.length ? `<p><strong>Oil:</strong> ${oils.join(", ")}</p>` : ""}
          ${herbs.length ? `<p><strong>Herb:</strong> ${herbs.join(", ")}</p>` : ""}
        </div>
      `
      : "";

   const groupItems = activeGroup
     ? getGroupObjects(activeGroup.id).map((item) => item.dataset.label || "Item")
     : [];
   
   const groupMarkup = activeGroup
     ? `
       <div class="altar-info-card-section">
         <p><strong>Group:</strong> ${activeGroup.name}</p>
         <p>${groupItems.join(", ")}</p>
       </div>
     `
     : "";

  altarInfoCard.innerHTML = `
    <div class="altar-info-card-inner">
      <h3>${label}</h3>
      ${object.dataset.grimoireKeywords ? `<p class="altar-info-card-type">${object.dataset.grimoireKeywords}</p>` : ""}
      ${groupMarkup}
      ${dressingMarkup}
    </div>
  `;

  altarInfoCard.hidden = false;
  altarInfoCard.classList.add("is-visible");
}
function hideAltarInfoCard() {
  if (!altarInfoCard) return;

  altarInfoCard.classList.remove("is-visible");

  window.setTimeout(() => {
    if (!altarInfoCard.classList.contains("is-visible")) {
      altarInfoCard.hidden = true;
    }
  }, 180);
}

function updateToolbarNotes(object) {
  let notes = toolbar.querySelector(".altar-toolbar-notes");

  if (!notes) {
    notes = document.createElement("div");
    notes.className = "altar-toolbar-notes";
    toolbar.appendChild(notes);
  }

  if (!object || object.dataset.type !== "candle") {
    notes.hidden = true;
    notes.textContent = "";
    return;
  }

  const dressings = getDressings(object);

  if (dressings.length === 0) {
    notes.hidden = true;
    notes.textContent = "";
    return;
  }

  notes.hidden = false;
  notes.textContent = `Dressed with: ${dressings
    .map(formatDressingName)
    .join(", ")}`;
}

function selectObject(object) {
  if (!object) return;

  if (selectedObject) {
    selectedObject.classList.remove("is-selected");
  }

  selectedObject = object;
  selectedObject.classList.add("is-selected");

  toolbar.hidden = false;

  updateToolbarNotes(selectedObject);
  showAltarInfoCard(selectedObject);
  updateSelectedGroupVisuals(selectedObject);
}

function deselectObject() {
  if (selectedObject) {
    selectedObject.classList.remove("is-selected");
  }

  selectedObject = null;
  toolbar.hidden = true;

  updateToolbarNotes(null);
  hideAltarInfoCard();
  updateSelectedGroupVisuals(null);
}
