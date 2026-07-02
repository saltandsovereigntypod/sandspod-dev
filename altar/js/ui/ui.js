/* =========================================================
   ALTAR UI
   Empty state, toast, modals, mobile cabinet, toolbar shell
   ========================================================= */

const toolbar = document.createElement("div");
toolbar.className = "altar-toolbar";
toolbar.hidden = true;
toolbar.innerHTML = `
  <button type="button" data-action="smaller" title="Make smaller">−</button>
  <button type="button" data-action="larger" title="Make larger">+</button>
  <button type="button" data-action="rotate" title="Rotate">↻</button>
  <button type="button" data-action="delete" title="Delete">🗑</button>
  <button type="button" data-action="forward" title="Bring forward">⬆</button>
  <button type="button" data-action="backward" title="Send backward">⬇</button>
  <button type="button" data-action="flip" title="Flip horizontally">⇋</button>
  <button type="button" data-action="lock" title="Lock position">🔒</button>
  <button type="button" data-action="duplicate" title="Duplicate">⧉</button>
  <button type="button" data-action="glow" title="Glow on/off">✦</button>
  <button type="button" data-action="light" title="Light candle">🔥</button>
  <button type="button" data-action="dress-candle" title="Dress candle">🕯️+</button>
`;

const altarActionBar = document.createElement("div");
altarActionBar.className = "altar-action-bar";
altarActionBar.innerHTML = `
  <div class="altar-action-group">
    <button type="button" data-global-action="save-altar">💾 Save</button>
    <button type="button" data-global-action="load-altar">📂 Load</button>
  </div>

  <div class="altar-action-divider"></div>

  <div class="altar-action-group">
    <button type="button" data-global-action="select-ritual-items">☑ Select</button>
    <button type="button" data-global-action="group-ritual-items">🗂 Group</button>
    <button type="button" data-global-action="send-group-to-grimoire">📖 Record</button>
  </div>

  <div class="altar-action-divider"></div>

  <div class="altar-action-group">
    <button type="button" data-global-action="light-all">🔥 Light</button>
    <button type="button" data-global-action="extinguish-all">💨 Out</button>
    <button type="button" data-global-action="clear-altar">🧹 Clear</button>
  </div>
`;

const altarMobileBackdrop = document.createElement("button");
altarMobileBackdrop.type = "button";
altarMobileBackdrop.className = "altar-mobile-backdrop";
altarMobileBackdrop.setAttribute("aria-label", "Close altar cabinet");

const altarToast = document.createElement("div");
altarToast.className = "altar-toast";
altarToast.hidden = true;

const altarGroupIndicator = document.createElement("div");
altarGroupIndicator.className = "altar-group-indicator";
altarGroupIndicator.hidden = true;

const altarInfoCard = document.createElement("aside");
altarInfoCard.className = "altar-info-card";
altarInfoCard.hidden = true;
altarInfoCard.setAttribute("aria-live", "polite");

const mobileCabinetToggle = document.createElement("button");
mobileCabinetToggle.type = "button";
mobileCabinetToggle.className = "altar-mobile-cabinet-toggle";
mobileCabinetToggle.textContent = "✦ Add Items";
mobileCabinetToggle.setAttribute("aria-expanded", "false");

if (altarStage) {
  altarStage.after(altarActionBar);
  altarStage.appendChild(toolbar);
  altarStage.appendChild(altarGroupIndicator);
  altarStage.appendChild(altarInfoCard);
}

if (altarCabinet) {
  document.body.appendChild(altarMobileBackdrop);
  document.body.appendChild(mobileCabinetToggle);
  document.body.appendChild(altarToast);
}

function updateEmptyMessage() {
  if (!altarStage || !emptyMessage) return;
  emptyMessage.hidden = altarStage.querySelectorAll(".altar-object").length > 0;
}

function showAltarToast(message) {
  if (!altarToast) return;

  altarToast.textContent = message;
  altarToast.hidden = false;
  altarToast.classList.add("is-visible");

  window.clearTimeout(showAltarToast.timeout);

  showAltarToast.timeout = window.setTimeout(() => {
    altarToast.classList.remove("is-visible");

    window.setTimeout(() => {
      altarToast.hidden = true;
    }, 250);
  }, 1600);
}

function closeMobileCabinet() {
  if (!altarCabinet) return;

  altarCabinet.classList.remove("is-mobile-open");
  document.body.classList.remove("altar-cabinet-open");
  mobileCabinetToggle.setAttribute("aria-expanded", "false");
}

function openSaveModal() {
  if (!saveModal) return;

  saveModal.hidden = false;
  document.body.classList.add("altar-modal-open");
}

function closeSaveModal() {
  if (!saveModal) return;

  saveModal.hidden = true;
  document.body.classList.remove("altar-modal-open");
}

mobileCabinetToggle.addEventListener("click", () => {
  if (!altarCabinet) return;

  const isOpen = altarCabinet.classList.toggle("is-mobile-open");
  mobileCabinetToggle.setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("altar-cabinet-open", isOpen);
});

altarMobileBackdrop.addEventListener("click", closeMobileCabinet);
