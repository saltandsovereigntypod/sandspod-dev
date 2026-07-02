/* =========================================================
   MY RITUALS
   Guest/local + signed-in/cloud ritual storage
   ========================================================= */

const MY_RITUALS_LOCAL_KEY = "saltAndSovereigntyUserRituals";

function getLocalMyRituals() {
  try {
    return JSON.parse(localStorage.getItem(MY_RITUALS_LOCAL_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLocalMyRituals(rituals) {
  localStorage.setItem(MY_RITUALS_LOCAL_KEY, JSON.stringify(rituals));
}

function parseRitualTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function getMyRituals() {
  if (!currentUser) {
    return getLocalMyRituals();
  }

  const { data, error } = await db
    .from("user_rituals")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return getLocalMyRituals();
  }

  return data || [];
}

async function saveMyRitual(ritual) {
  if (!currentUser) {
    const rituals = getLocalMyRituals();

    rituals.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      ...ritual,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    saveLocalMyRituals(rituals);
    return;
  }

  const { error } = await db.from("user_rituals").insert({
    user_id: currentUser.id,
    ...ritual
  });

  if (error) throw error;
}

async function deleteMyRitual(ritualId) {
  if (!currentUser) {
    saveLocalMyRituals(getLocalMyRituals().filter((ritual) => ritual.id !== ritualId));
    return;
  }

  const { error } = await db
    .from("user_rituals")
    .delete()
    .eq("id", ritualId)
    .eq("user_id", currentUser.id);

  if (error) throw error;
}

async function renderMyRitualsList() {
  const list = document.querySelector("[data-my-rituals-list]");
  if (!list) return;

  const rituals = await getMyRituals();

  if (rituals.length === 0) {
    list.innerHTML = `
      <p class="my-sanctuary-empty">
        No rituals saved yet. Create one above when you're ready.
      </p>
    `;
    return;
  }

  list.innerHTML = rituals
    .map((ritual) => {
      const tags = Array.isArray(ritual.tags) ? ritual.tags : [];

      return `
        <article class="my-ritual-card" data-my-ritual-id="${ritual.id}">
          <h3>${ritual.title || "Untitled Ritual"}</h3>

          ${ritual.intention ? `<p><strong>Intention:</strong> ${ritual.intention}</p>` : ""}
          ${ritual.moon_phase ? `<p><strong>Moon:</strong> ${ritual.moon_phase}</p>` : ""}
          ${ritual.linked_altar ? `<p><strong>Altar:</strong> ${ritual.linked_altar}</p>` : ""}
          ${ritual.notes ? `<p>${ritual.notes}</p>` : ""}

          ${
            tags.length
              ? `<p class="my-ritual-tags">${tags.map((tag) => `<span>${tag}</span>`).join("")}</p>`
              : ""
          }

          <button class="button button--ghost button--small" type="button" data-my-ritual-delete>
            Delete
          </button>
        </article>
      `;
    })
    .join("");
}

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-my-ritual-form]");
  if (!form) return;

  event.preventDefault();

  const ritual = {
    title: form.title.value.trim(),
    intention: form.intention.value.trim(),
    notes: form.notes.value.trim(),
    moon_phase: form.moon_phase.value.trim(),
    linked_altar: form.linked_altar.value.trim(),
    tags: parseRitualTags(form.tags.value),
    ritual_date: form.ritual_date.value || null,
    updated_at: new Date().toISOString()
  };

  if (!ritual.title) {
    showMySanctuaryNotice("Name your ritual first.");
    return;
  }

  try {
    await saveMyRitual(ritual);
    form.reset();
    await renderMyRitualsList();
    showMySanctuaryNotice("Ritual saved.");
  } catch (error) {
    console.error(error);
    showMySanctuaryNotice("Ritual could not be saved.");
  }
});

document.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-my-ritual-delete]");
  if (!deleteButton) return;

  const card = deleteButton.closest("[data-my-ritual-id]");
  const ritualId = card?.dataset.myRitualId;

  if (!ritualId) return;

  const confirmed = window.confirm("Delete this ritual?");
  if (!confirmed) return;

  try {
    await deleteMyRitual(ritualId);
    await renderMyRitualsList();
    showMySanctuaryNotice("Ritual deleted.");
  } catch (error) {
    console.error(error);
    showMySanctuaryNotice("Ritual could not be deleted.");
  }
});