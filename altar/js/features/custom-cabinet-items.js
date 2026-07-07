/* =========================================================
   CUSTOM CABINET ITEMS
   Supabase-backed cabinet shortcuts linked to Living Library
   ========================================================= */

let customCabinetItemsCache = [];

async function getCustomCabinetItems() {
  return customCabinetItemsCache;
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
    forms: [
      {
        label: "Place",
        image: row.image_url,
        type: row.item_type,
        form: row.form_label || "standard",
        custom: true,
        entityId: row.entity_id || ""
      }
    ],
    createdAt: row.created_at
  }));

  return customCabinetItemsCache;
}

function getAllLivingLibraryEntitiesForCustomCabinet() {
  if (typeof Library === "undefined") return [];

  const rawLibrary = JSON.parse(localStorage.getItem("saltAndSovereigntyLibrary")) || {};
  return Object.values(rawLibrary.entities || {}).sort((a, b) => {
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function getCustomCabinetCategoryLabel(category = "") {
  const match = cabinetCategories.find((item) => item.id === category);
  return match?.label || category || "Custom";
}

async function openCustomCabinetItemModal() {
  closeCustomCabinetItemModal();

  const entities = getAllLivingLibraryEntitiesForCustomCabinet();

  const modal = document.createElement("div");
  modal.className = "custom-cabinet-item-modal";
  modal.setAttribute("data-custom-cabinet-item-modal", "");

  modal.innerHTML = `
    <div class="custom-cabinet-item-card" role="dialog" aria-modal="true" aria-label="Create Custom Cabinet Item">
      <button class="altar-cabinet-close" type="button" data-close-custom-cabinet-item aria-label="Close">
        ×
      </button>

      <p class="eyebrow">Cabinet</p>
      <h2>Create Custom Cabinet Item</h2>

      <form data-custom-cabinet-item-form>
        <label>
          Cabinet Category
          <select name="category" required>
            ${cabinetCategories
              .filter((category) => category.id !== "backgrounds")
              .map((category) => `<option value="${category.id}">${category.label}</option>`)
              .join("")}
          </select>
        </label>

        <label>
          Item Name
          <input type="text" name="name" placeholder="Grandmother's key, blue offering bowl, handmade wand..." required />
        </label>

        <label>
          Form
          <input type="text" name="form" placeholder="standard, statue, bowl, charm, bundle..." value="standard" />
        </label>

        <label>
          Image
          <input type="file" name="image" accept="image/png,image/webp,image/jpeg" required />
        </label>

        <div class="custom-cabinet-link-options">
          <p class="eyebrow">Living Library Link</p>

          <label class="my-sanctuary-check">
            <input type="radio" name="library_mode" value="existing" checked />
            Link to an existing Living Library entry
          </label>

          <label>
            Existing Entry
            <select name="entity_id">
              <option value="">Choose an entry</option>
              ${entities
                .map((entity) => `
                  <option value="${entity.id}">
                    ${entity.name || "Untitled"} (${entity.type || "entry"})
                  </option>
                `)
                .join("")}
            </select>
          </label>

          <label class="my-sanctuary-check">
            <input type="radio" name="library_mode" value="new" />
            Create a new My Practice entry
          </label>

          <label>
            My Practice Notes
            <textarea
              name="my_practice_notes"
              rows="4"
              placeholder="What is this object, how do you use it, what does it mean in your practice?"
            ></textarea>
          </label>

          <label>
            Keywords
            <input type="text" name="keywords" placeholder="protection, ancestors, devotion, dreamwork" />
          </label>
        </div>

        <button class="button button--primary" type="submit">
          Save Custom Cabinet Item
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

async function saveCustomCabinetItem(form) {
  const user = await getCurrentAssetUser();

  if (!user) {
    showAltarToast("Please sign in to save custom cabinet items");
    return;
  }

  const formData = new FormData(form);
  const category = String(formData.get("category") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const formLabel = String(formData.get("form") || "standard").trim() || "standard";
  const libraryMode = String(formData.get("library_mode") || "existing");
  const selectedEntityId = String(formData.get("entity_id") || "");
  const notes = String(formData.get("my_practice_notes") || "").trim();
  const keywords = String(formData.get("keywords") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const file = formData.get("image");

  if (!category || !name || !file || !file.size) {
    showAltarToast("Add a name, category, and image first");
    return;
  }

  const imageUrl = await uploadUserAsset(file, "custom-cabinet-items");
  if (!imageUrl) return;

  const itemType = getCustomCabinetTypeForCategory(category);
  let entityId = selectedEntityId;

  if (libraryMode === "new") {
    if (typeof Library === "undefined") {
      showAltarToast("Living Library is not ready");
      return;
    }

    const entity = Library.createEntity({
      type: itemType,
      name,
      image: "",
      traditional: {},
      community: {},
      myPractice: {
        Notes: notes,
        CreatedFrom: "Custom Cabinet Item",
        CabinetCategory: getCustomCabinetCategoryLabel(category),
        Form: formLabel
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

  if (libraryMode === "existing" && !entityId) {
    showAltarToast("Choose a Living Library entry or create a new one");
    return;
  }

  const { error } = await db.from("custom_cabinet_items").insert({
    user_id: user.id,
    category,
    name,
    icon: "✦",
    keywords,
    entity_id: entityId,
    image_url: imageUrl,
    item_type: itemType,
    form_label: formLabel,
    metadata: {
      libraryMode
    }
  });

  if (error) {
    console.error(error);
    showAltarToast("Custom cabinet item could not be saved");
    return;
  }

  await loadCustomCabinetItems();

  closeCustomCabinetItemModal();

  activeCabinetCategory = category;
  renderCabinet();

  showAltarToast(`${name} added to Cabinet`);
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