/* =========================================================
   ALTAR GROUPS
   Selection mode, ritual groups, and grimoire handoff
   ========================================================= */

function ensureObjectId(object) {
  if (!object.dataset.altarObjectId) {
    object.dataset.altarObjectId =
      crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
  }

  return object.dataset.altarObjectId;
}

function getGroupById(groupId) {
  return altarGroups.find((group) => group.id === groupId) || null;
}

function getActiveGroup() {
  return getGroupById(activeGroupId);
}

function getGroupObjects(groupId) {
  const group = getGroupById(groupId);

  if (!group || !Array.isArray(group.objectIds)) return [];

  return group.objectIds
    .map((objectId) =>
      altarStage.querySelector(`.altar-object[data-altar-object-id="${objectId}"]`)
    )
    .filter(Boolean);
}

function syncGroupObjectClasses() {
  altarStage.querySelectorAll(".altar-object").forEach((object) => {
    object.classList.remove("is-ritual-grouped", "is-group-active");
  });
}

function updateSelectedGroupVisuals(object) {
  altarStage.querySelectorAll(".altar-object").forEach((item) => {
    item.classList.remove("is-group-active");
  });

  if (!object || !object.dataset.groupId) return;

  getGroupObjects(object.dataset.groupId).forEach((groupObject) => {
    if (groupObject !== object) {
      groupObject.classList.add("is-group-active");
    }
  });
}

function updateGroupIndicator() {
  if (!altarGroupIndicator) return;

  const activeGroup = getActiveGroup();

  if (!activeGroup) {
    altarGroupIndicator.hidden = true;
    altarGroupIndicator.textContent = "";
    return;
  }

  const itemCount = getGroupObjects(activeGroup.id).length;

  altarGroupIndicator.hidden = false;
  altarGroupIndicator.textContent =
    `Active group: ${activeGroup.name} · ${itemCount} item${itemCount === 1 ? "" : "s"}`;
}

function toggleRitualSelectionMode() {
  altarSelectionMode = !altarSelectionMode;
  altarStage.classList.toggle("is-selecting-ritual-items", altarSelectionMode);

  if (!altarSelectionMode) {
    clearRitualSelection();
    showAltarToast("Selection cancelled");
    return;
  }

  deselectObject();
  clearCandleDressingMode();
  showAltarToast("Select items");
}

function toggleRitualItem(object) {
  if (!object) return;

  const alreadySelected = selectedRitualItems.includes(object);

  if (alreadySelected) {
    selectedRitualItems = selectedRitualItems.filter((item) => item !== object);
    object.classList.remove("is-ritual-selected");
    return;
  }

  selectedRitualItems.push(object);
  object.classList.add("is-ritual-selected");
}

function clearRitualSelection() {
  selectedRitualItems.forEach((object) => {
    object.classList.remove("is-ritual-selected");
  });

  selectedRitualItems = [];
  altarSelectionMode = false;
  altarStage.classList.remove("is-selecting-ritual-items");
}

function chooseActiveGroup() {
  if (altarGroups.length === 0) {
    showAltarToast("Create a group first");
    return null;
  }

  if (altarGroups.length === 1) {
    activeGroupId = altarGroups[0].id;
    updateGroupIndicator();
    return altarGroups[0];
  }

  const groupList = altarGroups
    .map((group, index) => {
      const itemCount = getGroupObjects(group.id).length;
      return `${index + 1}. ${group.name} (${itemCount} item${itemCount === 1 ? "" : "s"})`;
    })
    .join("\n");

  const choice = window.prompt(`Choose a group:\n\n${groupList}`, "1");
  const selectedIndex = Number(choice) - 1;
  const selectedGroup = altarGroups[selectedIndex];

  if (!selectedGroup) {
    showAltarToast("No group selected");
    return null;
  }

  activeGroupId = selectedGroup.id;
  updateGroupIndicator();

  return selectedGroup;
}

function groupSelectedRitualItems() {
  if (selectedRitualItems.length === 0) {
    showAltarToast("Select items first");
    return;
  }

  const groupName =
    window.prompt("Name this group:", "Ritual Working") || "Ritual Working";

  const groupId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

  const objectIds = selectedRitualItems.map((object) => {
    const objectId = ensureObjectId(object);

    object.dataset.groupId = groupId;
    object.classList.remove("is-ritual-selected");

    return objectId;
  });

  const newGroup = {
    id: groupId,
    name: groupName.trim() || "Ritual Working",
    createdAt: new Date().toISOString(),
    objectIds
  };

  altarGroups.push(newGroup);
  activeGroupId = groupId;

  selectedRitualItems = [];
  altarSelectionMode = false;
  altarStage.classList.remove("is-selecting-ritual-items");

  syncGroupObjectClasses();
  updateGroupIndicator();
  showAltarToast("Group created");
}

function ungroupCurrentItems() {
  const activeGroup = chooseActiveGroup();
  if (!activeGroup) return;

  getGroupObjects(activeGroup.id).forEach((object) => {
    delete object.dataset.groupId;
  });

  altarGroups = altarGroups.filter((group) => group.id !== activeGroup.id);
  activeGroupId = altarGroups.length > 0 ? altarGroups[0].id : null;

  syncGroupObjectClasses();
  updateGroupIndicator();
  showAltarToast("Group removed");
}

function altarObjectToRitualItem(object) {
  return {
    id: object.dataset.altarObjectId || "",
    label: object.dataset.label || "Altar Item",
    type: object.dataset.type || "item",
    herb: object.dataset.herb || "",
    form: object.dataset.form || "",
    color: object.dataset.color || "",
    dressings: object.dataset.dressings || "[]"
  };
}

function sendCurrentGroupToGrimoire() {
  const activeGroup = chooseActiveGroup();
  if (!activeGroup) return;

  const groupObjects = getGroupObjects(activeGroup.id);

  if (groupObjects.length === 0) {
    showAltarToast("That group is empty");
    return;
  }

  const handoffGroup = {
    id: activeGroup.id,
    name: activeGroup.name,
    createdAt: activeGroup.createdAt,
    items: groupObjects.map(altarObjectToRitualItem)
  };

  localStorage.setItem(
    ALTAR_GRIMOIRE_HANDOFF_KEY,
    JSON.stringify(handoffGroup)
  );

  window.location.href = "../grimoire/index.html?import=altar";
}
