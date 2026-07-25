/* =========================================================
   COMPANION LIVING STATE
   First-class lifecycle metadata and actions for the Companion.
   ========================================================= */

(function initializeCompanionLivingState() {
  const companionPanel =
    typeof altarCompanionPanel !== "undefined"
      ? altarCompanionPanel
      : document.querySelector(".altar-companion-panel");

  if (!companionPanel || typeof window.showAltarCompanionPanel !== "function") return;

  const baseShowCompanion = window.showAltarCompanionPanel;
  let renderRequest = 0;

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function formatRelativeDue(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(date);
    due.setHours(0, 0, 0, 0);

    const days = Math.round((due.getTime() - today.getTime()) / 86400000);

    if (days < 0) {
      const overdue = Math.abs(days);
      return `${overdue} day${overdue === 1 ? "" : "s"} overdue`;
    }

    if (days === 0) return "due today";
    if (days === 1) return "due tomorrow";
    return `in ${days} days`;
  }

  async function getInstance(instanceId) {
    if (!instanceId || typeof window.getObjectInstance !== "function") return null;
    return window.getObjectInstance(instanceId);
  }

  async function findInstanceForObject(object) {
    if (!object) return null;

    const direct = await getInstance(object.dataset.instanceId || "");
    if (direct) return direct;

    const apothecaryItemId = object.dataset.apothecaryItemId || "";
    const item =
      apothecaryItemId && typeof window.getApothecaryItemById === "function"
        ? window.getApothecaryItemById(apothecaryItemId)
        : null;

    const itemInstance = await getInstance(item?.instanceId || "");
    if (itemInstance) {
      object.dataset.instanceId = itemInstance.id;
      object.dataset.entityId =
        object.dataset.entityId || item?.entityId || itemInstance.entity_id || "";
      window.saveWorkingAltarDraft?.();
      return itemInstance;
    }

    const entityId = object.dataset.entityId || item?.entityId || "";

    if (entityId && typeof window.getObjectInstancesByEntity === "function") {
      const instances = await window.getObjectInstancesByEntity(entityId);

      if (Array.isArray(instances) && instances.length) {
        const matched =
          (apothecaryItemId
            ? instances.find(
                (instance) => instance.apothecary_item_id === apothecaryItemId
              )
            : null) ||
          instances.find((instance) => instance.status === "active") ||
          instances[0];

        if (matched?.id) {
          object.dataset.instanceId = matched.id;
          object.dataset.entityId = object.dataset.entityId || matched.entity_id || "";
          window.saveWorkingAltarDraft?.();
          return matched;
        }
      }
    }

    return null;
  }

  function getHeaderHost() {
    const header = companionPanel.querySelector(".altar-companion-header");
    return header?.querySelector("div") || header;
  }

  function clearLivingStateUI() {
    companionPanel.querySelector("[data-companion-lifecycle]")?.remove();
    companionPanel.querySelector("[data-living-state-practice]")?.remove();
  }

  function renderLifecycleHeader(instance) {
    const host = getHeaderHost();
    if (!host || !instance) return;

    host.querySelector("[data-companion-lifecycle]")?.remove();

    const lifecycle = document.createElement("div");
    lifecycle.className = "companion-v3-lifecycle";
    lifecycle.setAttribute("data-companion-lifecycle", "");

    const status = String(instance.status || "active").toLowerCase();
    const created = formatDate(instance.started_at);
    const nextTending =
      instance.tending_enabled && instance.tending_due_at
        ? formatDate(instance.tending_due_at)
        : "";
    const tendingRelative = nextTending
      ? formatRelativeDue(instance.tending_due_at)
      : "";
    const expiration =
      instance.expiration_enabled && instance.expires_at
        ? formatDate(instance.expires_at)
        : "";
    const expirationRelative = expiration
      ? formatRelativeDue(instance.expires_at)
      : "";

    lifecycle.innerHTML = `
      <div class="companion-v3-lifecycle-primary">
        <span class="companion-v3-status-chip is-${status}">${status}</span>
        ${created ? `<span>Created ${created}</span>` : ""}
      </div>

      ${
        nextTending
          ? `<p><strong>Next tending</strong><span>${nextTending}${tendingRelative ? ` · ${tendingRelative}` : ""}</span></p>`
          : ""
      }

      ${
        expiration
          ? `<p><strong>Review or replace</strong><span>${expiration}${expirationRelative ? ` · ${expirationRelative}` : ""}</span></p>`
          : ""
      }
    `;

    host.appendChild(lifecycle);
  }

  function renderPracticeAction(instance) {
    if (!instance || ["retired", "archived"].includes(instance.status)) return;

    const page = companionPanel.querySelector(".companion-v3-page");
    if (!page) return;

    let footer = page.querySelector(".companion-v3-actions");

    if (!footer) {
      footer = document.createElement("footer");
      footer.className = "companion-v3-actions";
      page.appendChild(footer);
    }

    footer.querySelector("[data-living-state-practice]")?.remove();

    const button = document.createElement("button");
    button.type = "button";
    button.className = "living-state-practice-button companion-v3-primary-action";
    button.setAttribute("data-living-state-practice", "");
    button.innerHTML = `<span aria-hidden="true">✦</span> Begin Today’s Practice`;

    footer.prepend(button);
  }

  function polishHistoryLabel(instance) {
    if (!instance) return;

    const history = companionPanel.querySelector(".companion-v3-history");
    const summary = history?.querySelector(":scope > summary");

    if (summary) {
      summary.textContent = "History & Activity";
    }
  }

  async function renderLivingState(object) {
    const request = ++renderRequest;
    const instance = await findInstanceForObject(object);

    if (request !== renderRequest) return;
    if (typeof selectedObject !== "undefined" && selectedObject !== object) return;

    clearLivingStateUI();

    if (!instance) return;

    renderLifecycleHeader(instance);
    renderPracticeAction(instance);
    polishHistoryLabel(instance);
  }

  window.showAltarCompanionPanel = function showCompanionWithLivingState(object) {
    baseShowCompanion(object);
    renderLivingState(object);
  };

  document.addEventListener("click", (event) => {
    const object = event.target.closest(".altar-object");
    if (!object) return;

    window.setTimeout(() => {
      if (typeof selectedObject === "undefined" || selectedObject === object) {
        window.showAltarCompanionPanel(object);
      }
    }, 0);
  });

  window.addEventListener("saltSettingsChanged", () => {
    if (typeof selectedObject !== "undefined" && selectedObject) {
      renderLivingState(selectedObject);
    }
  });
})();
