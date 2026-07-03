/* =========================================================
   MY APOTHECARY
   User-created magical items from altar ingredients
   ========================================================= */

const APOTHECARY_STORAGE_KEY = "saltAndSovereigntyApothecaryItems";

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

function getSelectedApothecaryIngredients() {
  const ritualSelected = Array.from(
    altarStage.querySelectorAll(".altar-object.is-ritual-selected")
  );

  if (ritualSelected.length > 0) return ritualSelected;

  return selectedObject ? [selectedObject] : [];
}

function createIngredientSnapshot(object) {
  return {
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
          Create spell jars, oils, and herb mixes from ingredients you place on the altar.
        </p>
      </div>

      <button class="altar-workspace-tool" type="button" data-create-apothecary-item>
        ✦ Create Item
      </button>
    </div>

    ${
      items.length === 0
        ? `
          <div class="apothecary-placeholder">
            <p class="book-divider">✦ ☽ ✦ ☾ ✦</p>
            <h3>Your apothecary is waiting.</h3>
            <p>
              Select ingredients on the altar, then use Group to create a spell jar, oil, or herb mix.
            </p>
          </div>
        `
        : `
          <div class="altar-cabinet-content apothecary-items-grid">
            ${items
              .map((item) => `
                <button
                  type="button"
                  class="cabinet-tile"
                  data-apothecary-place
                  data-apothecary-item-id="${item.id}">
                  <span class="cabinet-tile-image-wrap">
                    <img src="${item.imagePath}" alt="" class="cabinet-tile-image" loading="lazy" />
                  </span>
                  <span class="cabinet-tile-name">${item.name}</span>
                  <span class="apothecary-tile-ingredients">
                    ${(item.ingredients || []).map((ingredient) => ingredient.label).slice(0, 3).join(" · ")}
                    ${(item.ingredients || []).length > 3 ? " · +" + ((item.ingredients || []).length - 3) : ""}
                  </span>
                </button>
              `)
              .join("")}
          </div>
        `
    }
  `;
}

function openCreateApothecaryModal(preselectedType = "") {
  const ingredients = getSelectedApothecaryIngredients();

  if (ingredients.length === 0) {
    showAltarToast("Select altar ingredients first");
    return;
  }

  const modal = document.createElement("div");
  modal.className = "apothecary-create-modal";
  modal.setAttribute("data-apothecary-create-modal", "");

  const ingredientSnapshots = ingredients.map(createIngredientSnapshot);

  modal.innerHTML = `
    <div class="apothecary-create-card" role="dialog" aria-modal="true" aria-label="Create Apothecary Item">
      <button class="altar-cabinet-close" type="button" data-close-apothecary-create aria-label="Close">
        ×
      </button>

      <p class="eyebrow">Create from altar</p>
      <h2>Create Apothecary Item</h2>

      <p class="apothecary-create-intro">
        These ingredients will become one saved working in My Apothecary.
      </p>

      <form data-apothecary-create-form>
        <label>
          What are you creating?
          <select name="type" required>
            ${apothecaryTypes
              .map((type) => `
                <option value="${type.id}" ${type.id === preselectedType ? "selected" : ""}>
                  ${type.label}
                </option>
              `)
              .join("")}
          </select>
        </label>

        <label>
          Name
          <input type="text" name="name" placeholder="Protection Jar, Dream Oil, Road Opening Blend..." required />
        </label>

        <label>
          Intention / Notes
          <textarea name="notes" rows="4" placeholder="What is this working for?"></textarea>
        </label>

        <div class="apothecary-image-choice">
          <p class="eyebrow">Image</p>

          <label class="my-sanctuary-check">
            <input type="radio" name="image_choice" value="preset" checked />
            Use preset image
          </label>

          <label class="my-sanctuary-check">
            <input type="radio" name="image_choice" value="upload" />
            Upload my own PNG
          </label>

          <input type="file" name="custom_image" accept="image/png,image/webp,image/jpeg" />
        </div>

        <div class="apothecary-ingredient-list">
          <p class="eyebrow">Ingredients</p>
          ${ingredientSnapshots
            .map((ingredient) => `
              <span>${ingredient.label}</span>
            `)
            .join("")}
        </div>

        <button class="button button--primary" type="submit">
          Save to My Apothecary
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

async function saveCreatedApothecaryItem(form, modal) {
  const formData = new FormData(form);
  const typeId = formData.get("type");
  const type = apothecaryTypes.find((itemType) => itemType.id === typeId);
  const name = String(formData.get("name") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const imageChoice = formData.get("image_choice");
  const file = formData.get("custom_image");

  if (!type || !name) return;

  let imagePath = type.presetImage;

  if (imageChoice === "upload" && file && file.size > 0) {
    imagePath = await readUploadedImage(file);
  }

  const ingredients = JSON.parse(modal.dataset.ingredients || "[]");

  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name,
    type: type.id,
    typeLabel: type.label,
    imagePath,
    notes,
    ingredients,
    createdAt: new Date().toISOString()
  };

  const items = getApothecaryItems();
  items.unshift(item);
  saveApothecaryItems(items);

  closeCreateApothecaryModal();
  renderApothecaryItems();
  showAltarToast(`${name} saved to My Apothecary`);
}

function placeApothecaryItem(itemId) {
  const item = getApothecaryItems().find((apothecaryItem) => {
    return apothecaryItem.id === itemId;
  });

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
    apothecaryItemId: item.id,
    apothecaryType: item.type,
    apothecaryIngredients: JSON.stringify(item.ingredients || [])
  });

  closeAltarApothecaryOverlay();
  showAltarToast(`${item.name} placed`);
}

document.addEventListener("click", (event) => {
  const createButton = event.target.closest("[data-create-apothecary-item]");
  const closeButton = event.target.closest("[data-close-apothecary-create]");
  const placeButton = event.target.closest("[data-apothecary-place]");

  if (createButton) {
    openCreateApothecaryModal();
  }

  if (closeButton) {
    closeCreateApothecaryModal();
  }

  if (placeButton) {
    placeApothecaryItem(placeButton.dataset.apothecaryItemId);
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