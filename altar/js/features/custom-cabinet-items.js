/* =========================================================
   CUSTOM CABINET ITEMS
   Supabase-backed cabinet shortcuts linked to Living Library
   ========================================================= */

let customCabinetItemsCache = [];

const CUSTOM_FORM_PRESETS = {
  herbs: ["Sprig", "Loose", "Oil", "Incense"],
  crystals: ["Point", "Chips", "Cluster"],
  candles: ["Place"],
  tools: ["Place"],
  deities: ["Place"],
  vessels: ["Place"]
};

function getCustomCabinetItems() {
  return customCabinetItemsCache;
}

function normalizeCustomForms(row) {
  if (Array.isArray(row.forms) && row.forms.length) {
    return row.forms;
  }

  return [
    {
      label: "Place",
      image: row.image_url,
      type: row.item_type,
      form: row.form_label || "standard",
      custom: true,
      entityId: row.entity_id || ""
    }
  ];
}

async function loadCustomCabinetItems() {
  const user = await getCurrentAssetUser();

  if (!user) {
    customCabinetItemsCache = [];
    return [];
  }

  const { data, error } = await db
    .from("custom_cabinet_items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    customCabinetItemsCache = [];
    return [];
  }

  customCabinetItemsCache = (data || []).map((row) => ({
    id: row.id,
    category: row.category,
    name: row.name,
    icon: row.icon || "✦",
    keywords: row.keywords || [],
    entityId: row.entity_id || "",
    customCabinetItemId: row.id,
    forms: normalizeCustomForms(row),
    createdAt: row.created_at
  }));

  return customCabinetItemsCache;
}

function getAllLivingLibraryEntitiesForCustomCabinet() {
  const rawLibrary = JSON.parse(localStorage.getItem("saltAndSovereigntyLibrary")) || {};
  return Object.values(rawLibrary.entities || {}).sort((a, b) => {
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function getCustomCabinetCategoryLabel(category = "") {
  const match = cabinetCategories.find((item) => item.id === category);
  return match?.label || category || "Custom";
}

function getCustomCabinetTypeForCategory(category = "") {
  const map = {
    candles: "candle",
    herbs: "herb",
    crystals: "crystal",
    tools: "tool",
    deities: "deity",
    vessels: "vessel"
  };

  return map[category] || "object";
}

function getCustomItemById(itemId) {
  return customCabinetItemsCache.find((item) => item.id === itemId) || null;
}

function renderCustomFormUploadFields(category = "tools", existingForms = []) {
  const presetForms = CUSTOM_FORM_PRESETS[category] || ["Place"];

  return presetForms
    .map((formLabel) => {
      const existing = existingForms.find((form) => form.label === formLabel);
      const checked = existing || formLabel === "Place";

      return `
        <div class="custom-form-upload-row">
          <label class="my-sanctuary-check">
            <input type="checkbox" name="form_enabled_${formLabel}" ${checked ? "checked" : ""} />
            ${formLabel}
          </label>

          <input
            type="file"
            name="form_image_${formLabel}"
            accept="image/png,image/webp,image/jpeg"
            ${existing ? "" : checked ? "required" : ""}
          />

          <input type="hidden" name="existing_form_image_${formLabel}" value="${existing?.image || ""}" />
        </div>
      `;
    })
    .join("");
}

async function openCustomCabinetItemModal(editItemId = "") {
  closeCustomCabinetItemModal();

  const existingItem = editItemId ? getCustomItemById(editItemId) : null;
  const entities = getAllLivingLibraryEntitiesForCustomCabinet();
  const selectedCategory = existingItem?.category || "tools";

  const modal = document.createElement("div");
  modal.className = "custom-cabinet-item-modal";
  modal.setAttribute("data-custom-cabinet-item-modal", "");

  if (existingItem) {
    modal.dataset.editItemId = existingItem.id;
  }

  modal.innerHTML = `
    <div class="custom-cabinet-item-card" role="dialog" aria-modal="true">
      <button class="altar-cabinet-close" type="button" data-close-custom-cabinet-item aria-label="Close">×</button>

      <p class="eyebrow">Cabinet</p>
      <h2>${existingItem ? "Edit Custom Cabinet Item" : "Create Custom Cabinet Item"}</h2>

      <form data-custom-cabinet-item-form>
        <label>
          Cabinet Category
          <select name="category" required data-custom-cabinet-category-select>
            ${cabinetCategories
              .filter((category) => category.id !== "backgrounds")
              .map((category) => `
                <option value="${category.id}" ${category.id === selectedCategory ? "selected" : ""}>
                  ${category.label}
                </option>
              `)
              .join("")}
          </select>
        </label>

        <label>
          Item Name
          <input type="text" name="name" value="${existingItem?.name || ""}" required />
        </label>

        <div class="custom-cabinet-link-options">
          <p class="eyebrow">Living Library Link</p>

          <label class="my-sanctuary-check">
            <input type="radio" name="library_mode" value="existing" ${existingItem ? "checked" : "checked"} />
            Link to an existing Living Library entry
          </label>

          <label>
            Existing Entry
            <select name="entity_id">
              <option value="">Choose an entry</option>
              ${entities
                .map((entity) => `
                  <option value="${entity.id}" ${entity.id === existingItem?.entityId ? "selected" : ""}>
                    ${entity.name || "Untitled"} (${entity.type || "entry"})
                  </option>
                `)
                .join("")}
            </select>
          </label>

          <label class="my-sanctuary-check">
            <input type="radio" name="library_mode" value="new" ${existingItem ? "disabled" : ""} />
            Create a new My Practice entry
          </label>

          <label>
            My Practice Notes
            <textarea name="my_practice_notes" rows="4"></textarea>
          </label>

          <label>
            Keywords
            <input type="text" name="keywords" value="${(existingItem?.keywords || []).join(", ")}" />
          </label>
        </div>

        <div class="custom-cabinet-link-options">
          <p class="eyebrow">Forms</p>
          <p>Choose which forms this item should have. Upload images now, or leave unchecked and add them later.</p>

          <div data-custom-form-upload-fields>
            ${renderCustomFormUploadFields(selectedCategory, existingItem?.forms || [])}
          </div>
        </div>

        <button class="button button--primary" type="submit">
          ${existingItem ? "Save Changes" : "Save Custom Cabinet Item"}
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add("altar-modal-open");
}

function closeCustomCabinetItemModal() {
  const modal = document.querySelector("[data-custom-cabinet-item-modal]");
  if (!modal) return;

  modal.remove();
  document.body.classList.remove("altar-modal-open");
}

async function collectCustomCabinetForms(formData, category, itemType, entityId, existingForms = []) {
  const presetForms = CUSTOM_FORM_PRESETS[category] || ["Place"];
  const forms = [];

  for (const formLabel of presetForms) {
    const enabled = formData.get(`form_enabled_${formLabel}`) === "on";
    if (!enabled) continue;

    const file = formData.get(`form_image_${formLabel}`);
    const existingImage = String(formData.get(`existing_form_image_${formLabel}`) || "");

    let image = existingImage;

    if (file && file.size > 0) {
      image = await uploadUserAsset(file, "custom-cabinet-items");
    }

    if (!image) continue;

    forms.push({
      label: formLabel,
      image,
      type: itemType,
      form: formLabel.toLowerCase().replaceAll(" ", "-"),
      custom: true,
      entityId
    });
  }

  return forms.length ? forms : existingForms;
}

async function saveCustomCabinetItem(form) {
  const user = await getCurrentAssetUser();

  if (!user) {
    showAltarToast("Please sign in to save custom cabinet items");
    return;
  }

  const modal = form.closest("[data-custom-cabinet-item-modal]");
  const editItemId = modal?.dataset.editItemId || "";
  const existingItem = editItemId ? getCustomItemById(editItemId) : null;

  const formData = new FormData(form);
  const category = String(formData.get("category") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const libraryMode = String(formData.get("library_mode") || "existing");
  const selectedEntityId = String(formData.get("entity_id") || "");
  const notes = String(formData.get("my_practice_notes") || "").trim();
  const keywords = String(formData.get("keywords") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!category || !name) {
    showAltarToast("Add a name and category first");
    return;
  }

  const itemType = getCustomCabinetTypeForCategory(category);
  let entityId = selectedEntityId || existingItem?.entityId || "";

  if (!existingItem && libraryMode === "new") {
    const entity = Library.createEntity({
      type: itemType,
      name,
      image: "",
      traditional: {},
      community: {},
      myPractice: {
        Notes: notes,
        CreatedFrom: "Custom Cabinet Item",
        CabinetCategory: getCustomCabinetCategoryLabel(category)
      },
      metadata: {
        customCabinetItem: true,
        createdFrom: "altar-cabinet"
      },
      aliases: keywords
    });

    entityId = entity.id;

    if (typeof saveLivingLibraryEntityToSupabase === "function") {
      await saveLivingLibraryEntityToSupabase(entity.id);
    }
  }

  if (!entityId) {
    showAltarToast("Choose a Living Library entry or create a new one");
    return;
  }

  const forms = await collectCustomCabinetForms(
    formData,
    category,
    itemType,
    entityId,
    existingItem?.forms || []
  );

  if (!forms.length) {
    showAltarToast("Choose at least one form and upload an image");
    return;
  }

  const row = {
    user_id: user.id,
    category,
    name,
    icon: "✦",
    keywords,
    entity_id: entityId,
    image_url: forms[0].image,
    item_type: itemType,
    form_label: forms[0].form || "standard",
    forms,
    metadata: {
      libraryMode,
      multiForm: forms.length > 1
    },
    updated_at: new Date().toISOString()
  };

  const query = editItemId
    ? db.from("custom_cabinet_items").update(row).eq("user_id", user.id).eq("id", editItemId)
    : db.from("custom_cabinet_items").insert(row);

  const { error } = await query;

  if (error) {
    console.error(error);
    showAltarToast("Custom cabinet item could not be saved");
    return;
  }

  await loadCustomCabinetItems();

  closeCustomCabinetItemModal();
  activeCabinetCategory = category;
  renderCabinet();

  showAltarToast(existingItem ? `${name} updated` : `${name} added to Cabinet`);
}

async function deleteCustomCabinetItem(itemId) {
  const user = await getCurrentAssetUser();
  if (!user || !itemId) return;

  const confirmed = window.confirm("Delete this custom cabinet item? This will not delete the Living Library entry.");
  if (!confirmed) return;

  const { error } = await db
    .from("custom_cabinet_items")
    .delete()
    .eq("user_id", user.id)
    .eq("id", itemId);

  if (error) {
    console.error(error);
    showAltarToast("Custom cabinet item could not be deleted");
    return;
  }

  await loadCustomCabinetItems();
  renderCabinetItems();
  showAltarToast("Custom cabinet item deleted");
}