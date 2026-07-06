/* =========================================================
   MY APOTHECARY
   User-created magical items from altar ingredients
   ========================================================= */

const APOTHECARY_STORAGE_KEY = "saltAndSovereigntyApothecaryItems";
const APOTHECARY_GRIMOIRE_HANDOFF_KEY = "saltAndSovereigntyApothecaryToGrimoire";

const apothecaryTypes = [
  {
    id: "spell-jar",
    label: "Spell Jar",
    presetImage: "../assets/altar/objects/vessels/spell-jar/spell-jar.png"
  },
  {
    id: "oil-tincture",
    label: "Oil / Tincture",
    presetImage: "../assets/altar/objects/herbs/rosemary/rosemary-oil.png"
  },
  {
    id: "herb-mix",
    label: "Herb Mix",
    presetImage: "../assets/altar/objects/herbs/rosemary/rosemary-loose.png"
  }
];

function getApothecaryItems() {
  try {
    return JSON.parse(localStorage.getItem(APOTHECARY_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveApothecaryItems(items) {
  localStorage.setItem(APOTHECARY_STORAGE_KEY, JSON.stringify(items));
}

/* =========================================================
   APOTHECARY + LIVING LIBRARY
   ========================================================= */

function getApothecaryIngredientLibraryType(ingredient = {}) {
  if (ingredient.herb) return "herb";
  if (ingredient.crystal) return "crystal";
  if (ingredient.color) return "candle";
  if (ingredient.tool) return "tool";
  if (ingredient.vessel) return "vessel";
  if (ingredient.deity) return "deity";

  return ingredient.type || "note";
}

function getApothecaryIngredientLibraryName(ingredient = {}) {
  if (ingredient.herb) return ingredient.herb.replaceAll("-", " ");
  if (ingredient.crystal) return ingredient.crystal.replaceAll("-", " ");
  if (ingredient.color) return `${ingredient.color} candle`;
  if (ingredient.tool) return ingredient.tool.replaceAll("-", " ");
  if (ingredient.vessel) return ingredient.vessel.replaceAll("-", " ");
  if (ingredient.deity) return ingredient.deity.replaceAll("-", " ");

  return ingredient.label || "Ingredient";
}

function enrichApothecaryIngredientsForLibrary(ingredients = []) {
  if (typeof Library === "undefined") return ingredients;

  return ingredients.map((ingredient) => {
    const libraryType = getApothecaryIngredientLibraryType(ingredient);
    const libraryName = getApothecaryIngredientLibraryName(ingredient);

    const entity = Library.getOrCreateEntity({
      name: libraryName,
      type: libraryType,
      image: ingredient.imagePath || ""
    });

    return {
      ...ingredient,
      entityId: entity.id,
      libraryType,
      libraryName,
      amount: ingredient.amount || ""
    };
  });
}

function connectApothecaryIngredientsToLibraryEntity(entityId, ingredients = []) {
  if (typeof Library === "undefined") return;
  if (!Library.LIBRARY_RELATIONS) return;

  ingredients.forEach((ingredient) => {
    if (!ingredient.entityId) return;

    Library.connect(entityId, Library.LIBRARY_RELATIONS.CONTAINS, ingredient.entityId);
    Library.connect(ingredient.entityId, Library.LIBRARY_RELATIONS.INGREDIENT_IN, entityId);
  });
}

async function createOrUpdateApothecaryLibraryEntity(item) {
  if (typeof Library === "undefined") return item;

  const entity = item.entityId
    ? Library.getEntity(item.entityId)
    : Library.getOrCreateEntity({
        name: item.name,
        type: "apothecary",
        image: item.imagePath || ""
      });

  if (!entity) return item;

  const ingredients = enrichApothecaryIngredientsForLibrary(item.ingredients || []);

  Library.updateEntity(entity.id, {
    name: item.name,
    type: "apothecary",
    image: item.imagePath || "",
    myPractice: {
      ...(entity.myPractice || {}),
      Subtype: item.typeLabel || item.type || "Apothecary Item",
      Intention: item.intention || "",
      Ingredients: ingredients,
      Notes: item.notes || "",
      GrimoireStatus: item.logToGrimoire ? "Linked to Living Library" : "",
      CreatedFrom: "Altar Apothecary"
    },
    metadata: {
      ...(entity.metadata || {}),
      apothecaryItemId: item.id,
      apothecaryType: item.type,
      isApothecaryRecipe: true,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    }
  });

  connectApothecaryIngredientsToLibraryEntity(entity.id, ingredients);

  if (typeof saveLivingLibraryEntityToSupabase === "function") {
    await saveLivingLibraryEntityToSupabase(entity.id);

    for (const ingredient of ingredients) {
      if (ingredient.entityId) {
        await saveLivingLibraryEntityToSupabase(ingredient.entityId);
      }
    }
  }

  return {
    ...item,
    entityId: entity.id,
    ingredients,
    grimoireStatus: item.logToGrimoire ? "linked to Living Library" : item.grimoireStatus || ""
  };
}

function getApothecaryItemById(itemId) {
  return getApothecaryItems().find((item) => item.id === itemId) || null;
}

function getSelectedApothecaryIngredients() {
  const ritualSelected = Array.from(
    altarStage.querySelectorAll(".altar-object.is-ritual-selected")
  );

  if (ritualSelected.length > 0) return ritualSelected;

  return selectedObject ? [selectedObject] : [];
}

function createIngredientSnapshot(object) {
  return {
    id: object.dataset.altarObjectId || "",
    label: object.dataset.label || "Object",
    type: object.dataset.type || "",
    herb: object.dataset.herb || "",
    form: object.dataset.form || "",
    color: object.dataset.color || "",
    crystal: object.dataset.crystal || "",
    tool: object.dataset.tool || "",
    vessel: object.dataset.vessel || "",
    deity: object.dataset.deity || "",
    imagePath: getObjectImagePath(object)
  };
}

function getApothecaryType(typeId) {
  return apothecaryTypes.find((type) => type.id === typeId) || apothecaryTypes[0];
}

function renderApothecaryItems() {
  const apothecary = document.querySelector("[data-altar-apothecary]");
  if (!apothecary) return;

  const items = getApothecaryItems();

  apothecary.innerHTML = `
    <button class="altar-cabinet-close" type="button" data-close-apothecary-overlay aria-label="Close apothecary">
      ×
    </button>

    <div class="altar-cabinet-header">
      <div>
        <p class="eyebrow">My Apothecary</p>
        <h2>Your Created Workings</h2>
        <p>
          Spell jars, oils, tinctures, and herb mixes you create from your altar ingredients.
        </p>
      </div>
    </div>

    ${
      items.length === 0
        ? `
          <div class="apothecary-placeholder">
            <p class="book-divider">✦ ☽ ✦ ☾ ✦</p>
            <h3>Your apothecary is waiting.</h3>
            <p>
              Select ingredients on the altar, press Group, then create a spell jar, oil, or herb mix.
            </p>
          </div>
        `
        : `
          <div class="altar-cabinet-content apothecary-items-grid">
            ${items
              .map((item) => `
                <article class="apothecary-item-card">
                  <button
                    type="button"
                    class="cabinet-tile"
                    data-apothecary-place
                    data-apothecary-item-id="${item.id}">
                    <span class="cabinet-tile-image-wrap">
                      <img src="${item.imagePath}" alt="" class="cabinet-tile-image" loading="lazy" />
                    </span>
                    <span class="cabinet-tile-name">${item.name}</span>
                    <span class="apothecary-tile-type">${item.typeLabel || "Apothecary Item"}</span>
                  </button>

                  <div class="apothecary-item-actions">
                    <button type="button" data-apothecary-edit="${item.id}">Edit</button>
                    <button type="button" data-apothecary-delete="${item.id}">Delete</button>
                  </div>
                </article>
              `)
              .join("")}
          </div>
        `
    }
  `;
}

function openCreateApothecaryModal(preselectedType = "", editItemId = "") {
  const existingItem = editItemId ? getApothecaryItemById(editItemId) : null;
  const ingredients = existingItem ? [] : getSelectedApothecaryIngredients();

  if (!existingItem && ingredients.length === 0) {
    showAltarToast("Select altar ingredients first");
    return;
  }

  const modal = document.createElement("div");
  modal.className = "apothecary-create-modal";
  modal.setAttribute("data-apothecary-create-modal", "");

  if (existingItem) {
    modal.dataset.editItemId = existingItem.id;
  }

  const ingredientSnapshots = existingItem
    ? existingItem.ingredients || []
    : ingredients.map(createIngredientSnapshot);

  const selectedType = existingItem?.type || preselectedType || "spell-jar";
  const selectedImage = existingItem?.imagePath || getApothecaryType(selectedType).presetImage;

  modal.innerHTML = `
    <div class="apothecary-create-card" role="dialog" aria-modal="true" aria-label="Create Apothecary Item">
      <button class="altar-cabinet-close" type="button" data-close-apothecary-create aria-label="Close">
        ×
      </button>

      <p class="eyebrow">My Apothecary</p>
      <h2>${existingItem ? "Edit Apothecary Item" : "Create Apothecary Item"}</h2>

      <p class="apothecary-create-intro">
        ${existingItem ? "Update this working without changing its place in your apothecary." : "These selected ingredients will become one saved working."}
      </p>

      <form data-apothecary-create-form>
        <label>
          What are you creating?
          <select name="type" required>
            ${apothecaryTypes
              .map((type) => `
                <option value="${type.id}" ${type.id === selectedType ? "selected" : ""}>
                  ${type.label}
                </option>
              `)
              .join("")}
          </select>
        </label>

        <label>
          Name
          <input
            type="text"
            name="name"
            value="${existingItem?.name || ""}"
            placeholder="Protection Jar, Dream Oil, Road Opening Blend..."
            required
          />
        </label>

        <label>
          Intention
          <input
            type="text"
            name="intention"
            value="${existingItem?.intention || ""}"
            placeholder="Protection, sleep, road opening, cleansing..."
          />
        </label>

        <label>
          Notes
          <textarea name="notes" rows="4" placeholder="What is this working for?">${existingItem?.notes || ""}</textarea>
        </label>

        <label class="my-sanctuary-check">
          <input type="checkbox" name="log_to_grimoire" ${existingItem?.logToGrimoire ? "checked" : ""} />
          Log this to my Book of Shadows
        </label>

        <div class="apothecary-image-choice">
          <p class="eyebrow">Image</p>

          <label class="my-sanctuary-check">
            <input type="radio" name="image_choice" value="preset" ${existingItem ? "" : "checked"} />
            Use preset image
          </label>

          <label class="my-sanctuary-check">
            <input type="radio" name="image_choice" value="upload" />
            Upload my own image
          </label>

          <input type="file" name="custom_image" accept="image/png,image/webp,image/jpeg" />

          <input type="hidden" name="existing_image" value="${selectedImage}" />
        </div>

        <div class="apothecary-ingredient-list">
          <p class="eyebrow">Ingredients</p>

          ${ingredientSnapshots
            .map((ingredient, index) => `
              <label class="apothecary-ingredient-amount-row">
                <span>${ingredient.label}</span>
                <input
                  type="text"
                  name="ingredient_amount_${index}"
                  value="${ingredient.amount || ""}"
                  placeholder="Amount, ex: 1 pinch, 3 drops, 2 tsp"
                />
              </label>
            `)
            .join("")}
        </div>

        <button class="button button--primary" type="submit">
          ${existingItem ? "Save Changes" : "Save to My Apothecary"}
        </button>
      </form>
    </div>
  `;

  modal.dataset.ingredients = JSON.stringify(ingredientSnapshots);
  document.body.appendChild(modal);
  document.body.classList.add("altar-modal-open");
}

function closeCreateApothecaryModal() {
  const modal = document.querySelector("[data-apothecary-create-modal]");
  if (!modal) return;

  modal.remove();
  document.body.classList.remove("altar-modal-open");
}

function readUploadedImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

function createGrimoireHandoffForApothecaryItem(item) {
  if (!item.logToGrimoire) return item;

  const handoff = {
    source: "apothecary",
    itemId: item.id,
    title: item.name,
    type: item.type,
    typeLabel: item.typeLabel,
    intention: item.intention || "",
    notes: item.notes || "",
    ingredients: item.ingredients || [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };

  localStorage.setItem(APOTHECARY_GRIMOIRE_HANDOFF_KEY, JSON.stringify(handoff));

  return {
    ...item,
    grimoireStatus: item.grimoireEntryId ? "linked" : "ready to log"
  };
}

function replaceSelectedIngredientsWithApothecaryObject(item) {
  const ingredients = getSelectedApothecaryIngredients();

  if (ingredients.length === 0) return;

  const centers = ingredients.map((object) => ({
    x: parseFloat(object.style.left) || altarStage.clientWidth / 2,
    y: parseFloat(object.style.top) || altarStage.clientHeight / 2
  }));

  const centerX = centers.reduce((sum, point) => sum + point.x, 0) / centers.length;
  const centerY = centers.reduce((sum, point) => sum + point.y, 0) / centers.length;

  ingredients.forEach((object) => {
    stopFlame(object);
    object.remove();
  });

  clearRitualSelection();

  placeObject({
    imagePath: item.imagePath,
    fallbackSymbol: "✦",
    label: item.name,
    type: "apothecary",
    form: item.type,
    entityId: item.entityId || "",
    instanceId: item.instanceId || "",
    apothecaryItemId: item.id,
    apothecaryType: item.type,
    apothecaryIngredients: JSON.stringify(item.ingredients || []),
    apothecaryIntention: item.intention || "",
    apothecaryNotes: item.notes || "",
    apothecaryLogToGrimoire: String(Boolean(item.logToGrimoire)),
    apothecaryGrimoireStatus: item.grimoireStatus || ""
  });

  if (selectedObject) {
    selectedObject.style.left = `${centerX}px`;
    selectedObject.style.top = `${centerY}px`;
    updateObjectPositionPercent(selectedObject);
  }

  updateEmptyMessage();
  renderLighting();
  saveWorkingAltarDraft();
}

async function saveCreatedApothecaryItem(form, modal) {
  const formData = new FormData(form);
  const editItemId = modal.dataset.editItemId || "";
  const typeId = formData.get("type");
  const type = getApothecaryType(typeId);
  const name = String(formData.get("name") || "").trim();
  const intention = String(formData.get("intention") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const logToGrimoire = formData.get("log_to_grimoire") === "on";
  const imageChoice = formData.get("image_choice");
  const file = formData.get("custom_image");
  const existingImage = String(formData.get("existing_image") || "");

  if (!type || !name) return;

  let imagePath = existingImage || type.presetImage;

  if (imageChoice === "preset") {
    imagePath = type.presetImage;
  }

  if (imageChoice === "upload" && file && file.size > 0) {
    imagePath = await readUploadedImage(file);
  }

  const ingredients = JSON.parse(modal.dataset.ingredients || "[]").map((ingredient, index) => ({
    ...ingredient,
    amount: String(formData.get(`ingredient_amount_${index}`) || "").trim()
  }));
  const items = getApothecaryItems();
  const existingItem = editItemId ? getApothecaryItemById(editItemId) : null;

  let item = {
    id: existingItem?.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    name,
    type: type.id,
    typeLabel: type.label,
    imagePath,
    intention,
    notes,
    logToGrimoire,
    grimoireStatus: existingItem?.grimoireStatus || "",
    grimoireEntryId: existingItem?.grimoireEntryId || "",
    entityId: existingItem?.entityId || "",
    instanceId: existingItem?.instanceId || "",
    ingredients,
    createdAt: existingItem?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  item = await createOrUpdateApothecaryLibraryEntity(item);

  if (typeof createObjectInstance === "function") {
    const instance = await createObjectInstance({
      entity_id: item.entityId || "",
      source: "apothecary",
      instance_type: "apothecary_item",
      name: item.name,
      object_type: "apothecary",
      subtype: item.typeLabel || item.type || "",
      apothecary_item_id: item.id,
      metadata: {
        intention: item.intention || "",
        notes: item.notes || "",
        ingredients: item.ingredients || []
      }
    });

    if (instance?.id) {
      item.instanceId = instance.id;
    }
  }

  item = createGrimoireHandoffForApothecaryItem(item);

  const updatedItems = existingItem
    ? items.map((savedItem) => (savedItem.id === item.id ? item : savedItem))
    : [item, ...items];

  saveApothecaryItems(updatedItems);

  if (existingItem) {
    syncPlacedApothecaryObjects(item);
  }

  closeCreateApothecaryModal();
  renderApothecaryItems();

  if (!existingItem) {
    replaceSelectedIngredientsWithApothecaryObject(item);
  }

  showAltarToast(existingItem ? `${name} updated` : `${name} saved to My Apothecary`);
}

function placeApothecaryItem(itemId) {
  const item = getApothecaryItemById(itemId);

  if (!item) {
    showAltarToast("Apothecary item not found");
    return;
  }

  placeObject({
    imagePath: item.imagePath,
    fallbackSymbol: "✦",
    label: item.name,
    type: "apothecary",
    form: item.type,
    entityId: item.entityId || "",
    instanceId: item.instanceId || "",
    apothecaryItemId: item.id,
    apothecaryType: item.type,
    apothecaryIngredients: JSON.stringify(item.ingredients || []),
    apothecaryIntention: item.intention || "",
    apothecaryNotes: item.notes || "",
    apothecaryLogToGrimoire: String(Boolean(item.logToGrimoire)),
    apothecaryGrimoireStatus: item.grimoireStatus || ""
  });

  closeAltarApothecaryOverlay();
  showAltarToast(`${item.name} placed`);
}

function syncPlacedApothecaryObjects(item) {
  if (!altarStage || !item) return;

  altarStage
    .querySelectorAll(`.altar-object[data-apothecary-item-id="${item.id}"]`)
    .forEach((object) => {
      object.dataset.label = item.name;
      object.dataset.entityId = item.entityId || "";
      object.dataset.instanceId = item.instanceId || object.dataset.instanceId || "";
      object.dataset.apothecaryType = item.type;
      object.dataset.apothecaryType = item.type;
      object.dataset.apothecaryIngredients = JSON.stringify(item.ingredients || []);
      object.dataset.apothecaryIntention = item.intention || "";
      object.dataset.apothecaryNotes = item.notes || "";
      object.dataset.apothecaryLogToGrimoire = String(Boolean(item.logToGrimoire));
      object.dataset.apothecaryGrimoireStatus = item.grimoireStatus || "";

      const img = object.querySelector("img:not(.candle-herb-overlay):not(.candle-oil-overlay)");

      if (img && item.imagePath) {
        img.src = item.imagePath;
        img.alt = item.name;
      }

      object.setAttribute(
        "aria-label",
        `${item.name || "Object"}. Click to select. Drag to move. Double click to remove.`
      );
    });

  if (selectedObject?.dataset.apothecaryItemId === item.id) {
    showAltarInfoCard(selectedObject);
  }

  saveWorkingAltarDraft();
}

function removePlacedApothecaryObjects(itemId) {
  if (!altarStage || !itemId) return;

  altarStage
    .querySelectorAll(`.altar-object[data-apothecary-item-id="${itemId}"]`)
    .forEach((object) => {
      stopFlame(object);
      object.remove();
    });

  if (selectedObject?.dataset.apothecaryItemId === itemId) {
    deselectObject();
  }

  updateEmptyMessage();
  renderLighting();
  saveWorkingAltarDraft();
}

function deleteApothecaryItem(itemId) {
  const item = getApothecaryItemById(itemId);
  if (!item) return;

  const confirmed = window.confirm(
    `Delete "${item.name}" from My Apothecary and remove every placed copy from the altar? This cannot be undone.`
  );

  if (!confirmed) return;

  pushAltarUndoSnapshot();

  const items = getApothecaryItems().filter((savedItem) => savedItem.id !== itemId);
  saveApothecaryItems(items);

  removePlacedApothecaryObjects(itemId);
  renderApothecaryItems();

  showAltarToast("Apothecary item deleted");
}

document.addEventListener("click", (event) => {
  const createButton = event.target.closest("[data-create-apothecary-item]");
  const closeButton = event.target.closest("[data-close-apothecary-create]");
  const placeButton = event.target.closest("[data-apothecary-place]");
  const editButton = event.target.closest("[data-apothecary-edit]");
  const deleteButton = event.target.closest("[data-apothecary-delete]");

  if (createButton) {
    openCreateApothecaryModal();
  }

  if (closeButton) {
    closeCreateApothecaryModal();
  }

  if (placeButton) {
    placeApothecaryItem(placeButton.dataset.apothecaryItemId);
  }

  if (editButton) {
    openCreateApothecaryModal("", editButton.dataset.apothecaryEdit);
  }

  if (deleteButton) {
    deleteApothecaryItem(deleteButton.dataset.apothecaryDelete);
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-apothecary-create-form]");
  if (!form) return;

  event.preventDefault();

  const modal = form.closest("[data-apothecary-create-modal]");
  if (!modal) return;

  await saveCreatedApothecaryItem(form, modal);
});
