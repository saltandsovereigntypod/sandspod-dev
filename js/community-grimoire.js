/* =========================================================
   COMMUNITY GRIMOIRE
   Public display for published community submissions + Field Notes
   ========================================================= */

let communityGrimoireEntries = [];
let communityGrimoireNotes = [];
let communityGrimoireSearchTerm = "";
let communityGrimoireTypeFilter = "all";

function escapeCommunityGrimoireHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCommunityGrimoireType(type) {
  const labels = {
    community_grimoire: "Community Grimoire",
    community_note: "Field Note",
    podcast: "Podcast Story or Question",
    blog: "Blog or Journal Submission",
    ritual_experience: "Ritual Experience",
    dream_experience: "Dream Experience",
    other: "Other"
  };

  return labels[type] || "Community Offering";
}

function formatCommunityNoteType(type) {
  const labels = {
    outcome: "Outcome",
    substitution: "Substitution",
    question: "Question",
    reflection: "Reflection"
  };

  return labels[type] || "Field Note";
}

function formatCommunityGrimoireDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function getCommunityGrimoireAuthor(entry) {
  if (entry.anonymous) return "Anonymous";
  return entry.display_name || "Community Member";
}

async function loadCommunityGrimoireEntries() {
  const status = document.querySelector("[data-community-grimoire-status]");

  if (typeof db === "undefined") {
    if (status) status.textContent = "The Community Grimoire could not open.";
    return [];
  }

  const { data, error } = await db
    .from("community_submissions")
    .select("*")
    .eq("status", "published")
    .is("parent_submission_id", null)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error);
    if (status) status.textContent = "The Community Grimoire could not open right now.";
    return [];
  }

  communityGrimoireEntries = data || [];
  return communityGrimoireEntries;
}

async function loadCommunityGrimoireNotes() {
  if (typeof db === "undefined") return [];

  const { data, error } = await db
    .from("community_submissions")
    .select("*")
    .eq("status", "published")
    .eq("submission_type", "community_note")
    .not("parent_submission_id", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    communityGrimoireNotes = [];
    return [];
  }

  communityGrimoireNotes = data || [];
  return communityGrimoireNotes;
}

function getNotesForEntry(entryId) {
  return communityGrimoireNotes.filter((note) => note.parent_submission_id === entryId);
}

function getFilteredCommunityGrimoireEntries() {
  const search = communityGrimoireSearchTerm.toLowerCase();

  return communityGrimoireEntries.filter((entry) => {
    const matchesType =
      communityGrimoireTypeFilter === "all" ||
      entry.submission_type === communityGrimoireTypeFilter;

    const searchable = [
      entry.title,
      entry.body,
      entry.display_name,
      entry.submission_type,
      ...(entry.tags || [])
    ]
      .join(" ")
      .toLowerCase();

    return matchesType && searchable.includes(search);
  });
}

function renderFieldNotes(entryId) {
  const notes = getNotesForEntry(entryId);

  return `
    <div class="community-field-notes">
      <h4>Practitioner Field Notes</h4>

      ${
        notes.length
          ? notes
              .map((note) => `
                <article class="community-field-note">
                  <p class="section-kicker">
                    ${escapeCommunityGrimoireHTML(formatCommunityNoteType(note.note_type))}
                  </p>

                  <p>${escapeCommunityGrimoireHTML(note.body)}</p>

                  <small>
                    Offered by ${escapeCommunityGrimoireHTML(getCommunityGrimoireAuthor(note))}
                    ${
                      note.created_at
                        ? ` · ${formatCommunityGrimoireDate(note.created_at)}`
                        : ""
                    }
                  </small>
                </article>
              `)
              .join("")
          : `<p class="community-grimoire-meta">No Field Notes have been published for this page yet.</p>`
      }

      <details class="community-field-note-form-wrap">
        <summary>Offer a Field Note or Question</summary>

        <form data-community-field-note-form data-parent-submission-id="${entryId}">
          <label>
            What kind of note is this?
            <select name="note_type" required>
              <option value="reflection">Reflection</option>
              <option value="outcome">Outcome</option>
              <option value="substitution">Substitution</option>
              <option value="question">Question</option>
            </select>
          </label>

          <label>
            Display name, optional
            <input type="text" name="display_name" maxlength="60" placeholder="Anonymous if left blank" />
          </label>

          <label>
            Your Field Note
            <textarea
              name="body"
              rows="4"
              maxlength="1200"
              required
              placeholder="Share an outcome, substitution, question, or reflection..."
            ></textarea>
          </label>

          <label class="community-note-check">
            <input type="checkbox" name="terms_agreed" required />
            I understand Field Notes are reviewed before appearing publicly.
          </label>

          <input type="checkbox" name="botcheck" tabindex="-1" autocomplete="off" class="community-note-botcheck" />

          <button type="submit" class="button button--primary">
            Offer Field Note
          </button>

          <p class="community-field-note-status" data-community-field-note-status></p>
        </form>
      </details>
    </div>
  `;
}

function renderCommunityGrimoireEntries() {
  const list = document.querySelector("[data-community-grimoire-list]");
  const status = document.querySelector("[data-community-grimoire-status]");

  if (!list) return;

  const entries = getFilteredCommunityGrimoireEntries();

  if (!communityGrimoireEntries.length) {
    if (status) {
      status.textContent =
        "No pages have been published yet. The Community Grimoire is waiting for its first offerings.";
    }

    list.innerHTML = "";
    return;
  }

  if (!entries.length) {
    if (status) status.textContent = "No published pages match that search.";
    list.innerHTML = "";
    return;
  }

  if (status) {
    status.textContent = `${entries.length} published page${entries.length === 1 ? "" : "s"} found.`;
  }

  list.innerHTML = entries
    .map((entry) => {
      const tags = Array.isArray(entry.tags) ? entry.tags : [];

      return `
        <article class="community-grimoire-card">
          <div class="community-grimoire-card-header">
            <p class="section-kicker">
              ${escapeCommunityGrimoireHTML(formatCommunityGrimoireType(entry.submission_type))}
            </p>

            <h3>${escapeCommunityGrimoireHTML(entry.title)}</h3>

            <p class="community-grimoire-meta">
              Offered by ${escapeCommunityGrimoireHTML(getCommunityGrimoireAuthor(entry))}
              ${
                entry.updated_at || entry.created_at
                  ? ` · ${formatCommunityGrimoireDate(entry.updated_at || entry.created_at)}`
                  : ""
              }
            </p>
          </div>

          <div class="community-grimoire-body">
            ${escapeCommunityGrimoireHTML(entry.body)
              .split("\n")
              .filter(Boolean)
              .map((paragraph) => `<p>${paragraph}</p>`)
              .join("")}
          </div>

          ${
            tags.length
              ? `
                <div class="community-grimoire-tags">
                  ${tags
                    .map((tag) => `<span>${escapeCommunityGrimoireHTML(tag)}</span>`)
                    .join("")}
                </div>
              `
              : ""
          }

          ${renderFieldNotes(entry.id)}
        </article>
      `;
    })
    .join("");
}

async function submitCommunityFieldNote(form) {
  if (!form || typeof db === "undefined") return;

  const status = form.querySelector("[data-community-field-note-status]");
  const formData = new FormData(form);

  if (formData.get("botcheck")) return;

  const parentSubmissionId = form.dataset.parentSubmissionId || "";
  const noteType = String(formData.get("note_type") || "reflection");
  const body = String(formData.get("body") || "").trim();
  const displayName = String(formData.get("display_name") || "").trim();

  if (!parentSubmissionId || !body) {
    if (status) status.textContent = "Please write your Field Note before offering it.";
    return;
  }

  const parentEntry = communityGrimoireEntries.find((entry) => entry.id === parentSubmissionId);

  const { error } = await db.from("community_submissions").insert({
    user_id: typeof currentUser !== "undefined" ? currentUser?.id || null : null,
    parent_submission_id: parentSubmissionId,
    submission_type: "community_note",
    note_type: noteType,
    title: `Field Note on: ${parentEntry?.title || "Community Grimoire Page"}`,
    body,
    display_as: displayName ? "custom" : "anonymous",
    display_name: displayName || "Anonymous",
    anonymous: !displayName,
    tags: ["field-note", noteType],
    original_work_confirmed: true,
    terms_agreed: formData.get("terms_agreed") === "on",
    status: "pending"
  });

  if (error) {
    console.error(error);
    if (status) status.textContent = "Your Field Note could not be sent.";
    return;
  }

  form.reset();

  if (status) {
    status.textContent =
      "Your Field Note has been received and will appear here if approved.";
  }
}

async function initCommunityGrimoirePage() {
  if (!document.querySelector("[data-community-grimoire-list]")) return;

  const searchInput = document.querySelector("[data-community-grimoire-search]");
  const typeFilter = document.querySelector("[data-community-grimoire-filter]");

  await loadCommunityGrimoireEntries();
  await loadCommunityGrimoireNotes();
  renderCommunityGrimoireEntries();

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      communityGrimoireSearchTerm = searchInput.value || "";
      renderCommunityGrimoireEntries();
    });
  }

  if (typeFilter) {
    typeFilter.addEventListener("change", () => {
      communityGrimoireTypeFilter = typeFilter.value || "all";
      renderCommunityGrimoireEntries();
    });
  }
}

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-community-field-note-form]");
  if (!form) return;

  event.preventDefault();
  await submitCommunityFieldNote(form);
});

document.addEventListener("DOMContentLoaded", initCommunityGrimoirePage);