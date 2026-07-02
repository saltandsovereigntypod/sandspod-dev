/* =========================================================
   CREATOR DASHBOARD V2
   Private review inbox for Salt & Sovereignty submissions
   ========================================================= */

const SALT_ADMIN_IDS = [
  "ddc5463e-1551-498b-b5af-79ce52ac591c",
  "5c63e3ac-920c-4980-9aa7-f6f322a67a2e"
];

const ADMIN_STATUS_FILTERS = [
  "pending",
  "needs_revision",
  "approved",
  "published",
  "rejected",
  "archived",
  "all"
];

let adminSubmissionFilter = "pending";
let adminSubmissionSearch = "";
let adminSubmissionPage = 1;
let adminSubmissionPageSize = 25;
let adminSubmissions = [];
let activeAdminSubmission = null;
let adminUnreadCounts = {};

function isSaltSubmissionAdmin() {
  return currentUser && SALT_ADMIN_IDS.includes(currentUser.id);
}

function adminSubmissionStatus(message) {
  const status = document.querySelector("[data-admin-submission-status]");
  if (!status) return;

  status.textContent = message || "";

  if (message) {
    window.clearTimeout(adminSubmissionStatus.timeout);
    adminSubmissionStatus.timeout = window.setTimeout(() => {
      status.textContent = "";
    }, 2800);
  }
}

function escapeAdminSubmissionHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatAdminSubmissionType(type) {
  const labels = {
    community_grimoire: "Community Grimoire",
    podcast: "Podcast Story or Question",
    blog: "Blog or Journal Submission",
    ritual_experience: "Ritual Experience",
    dream_experience: "Dream Experience",
    other: "Other"
  };

  return labels[type] || "Submission";
}

function formatAdminStatus(status) {
  const labels = {
    pending: "Pending Review",
    needs_revision: "Needs Revision",
    approved: "Approved",
    rejected: "Rejected",
    published: "Published",
    archived: "Archived"
  };

  return labels[status] || status || "Pending Review";
}

function formatAdminDate(date) {
  if (!date) return "No date";

  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

async function requireSubmissionAdmin() {
  await getCurrentUser();

  if (!isSaltSubmissionAdmin()) {
    document.querySelector(".creator-dashboard").innerHTML = `
      <div class="section-intro">
        <p class="eyebrow">Private Admin</p>
        <h1>Access Restricted</h1>
        <p>You need to be signed into an approved Salt & Sovereignty admin account to view this page.</p>
      </div>
    `;

    return false;
  }

  return true;
}

async function autoArchiveOldSubmissions() {
  if (!isSaltSubmissionAdmin()) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const { error } = await db
    .from("community_submissions")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .in("status", ["published", "rejected"])
    .lt("last_activity_at", cutoff.toISOString());

  if (error) console.error(error);
}

async function getUnreadAdminMessages() {
  const { data, error } = await db
    .from("community_submission_messages")
    .select("submission_id, community_submissions(status)")
    .eq("sender_role", "user")
    .eq("read_by_admin", false);

  if (error) {
    console.error(error);
    return {};
  }

  const counts = {
    pending: 0,
    needs_revision: 0,
    approved: 0,
    published: 0,
    rejected: 0,
    archived: 0,
    all: 0,
    bySubmission: {}
  };

  (data || []).forEach((message) => {
    const status = message.community_submissions?.status || "pending";

    counts.all += 1;
    counts[status] = (counts[status] || 0) + 1;
    counts.bySubmission[message.submission_id] =
      (counts.bySubmission[message.submission_id] || 0) + 1;
  });

  return counts;
}

async function updateAdminUnreadCounts() {
  adminUnreadCounts = await getUnreadAdminMessages();
  renderAdminFilterButtons();
}

function renderAdminFilterButtons() {
  const sidebar = document.querySelector(".creator-dashboard-sidebar");
  if (!sidebar) return;

  sidebar.innerHTML = ADMIN_STATUS_FILTERS
    .map((filter) => {
      const count = adminUnreadCounts[filter] || 0;
      const label = filter === "all" ? "All" : formatAdminStatus(filter);

      return `
        <button
          type="button"
          class="${filter === adminSubmissionFilter ? "is-active" : ""}"
          data-admin-filter="${filter}">
          <span>${label}</span>
          ${count ? `<strong>${count}</strong>` : ""}
        </button>
      `;
    })
    .join("");
}

async function loadAdminSubmissions() {
  if (!isSaltSubmissionAdmin()) return;

  adminSubmissionStatus("Loading submissions...");

  const from = (adminSubmissionPage - 1) * adminSubmissionPageSize;
  const to = from + adminSubmissionPageSize - 1;

  let query = db
    .from("community_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (adminSubmissionFilter !== "all") {
    query = query.eq("status", adminSubmissionFilter);
  }

  if (adminSubmissionSearch.trim()) {
    const term = `%${adminSubmissionSearch.trim()}%`;
    query = query.or(
      `title.ilike.${term},body.ilike.${term},display_name.ilike.${term}`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    adminSubmissionStatus("Could not load submissions.");
    return;
  }

  adminSubmissions = data || [];

  await updateAdminUnreadCounts();
  renderAdminSubmissionList();
  updateAdminPagination();
  adminSubmissionStatus("");
}

function renderAdminSubmissionList() {
  const list = document.querySelector("[data-admin-submission-list]");
  if (!list) return;

  if (adminSubmissions.length === 0) {
    list.innerHTML = `<p class="my-sanctuary-empty">No submissions found.</p>`;
    return;
  }

  list.innerHTML = adminSubmissions
    .map((submission) => {
      const unread = adminUnreadCounts.bySubmission?.[submission.id] || 0;

      return `
        <article
          class="admin-submission-list-item ${activeAdminSubmission?.id === submission.id ? "is-active" : ""}"
          data-admin-submission-id="${submission.id}">
          <button type="button" class="admin-submission-open" data-admin-open-submission>
            <strong>${escapeAdminSubmissionHTML(submission.title)}</strong>
            <span>${formatAdminSubmissionType(submission.submission_type)}</span>
            <small>${formatAdminStatus(submission.status)} · ${formatAdminDate(submission.created_at)}</small>
            ${unread ? `<em>${unread} unread</em>` : ""}
          </button>

          <div class="admin-card-actions">
            <button type="button" data-admin-card-status="approved">Approve</button>
            <button type="button" data-admin-card-status="needs_revision">Revision</button>
            <button type="button" data-admin-card-status="published">Publish</button>
            <button type="button" data-admin-card-status="rejected">Reject</button>
            <button type="button" data-admin-card-status="archived">Archive</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateAdminPagination() {
  const label = document.querySelector("[data-admin-page-label]");
  if (label) label.textContent = `Page ${adminSubmissionPage}`;
}

async function loadAdminSubmissionMessages(submissionId) {
  const { data, error } = await db
    .from("community_submission_messages")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

async function markSubmissionMessagesRead(submissionId) {
  const { error } = await db
    .from("community_submission_messages")
    .update({ read_by_admin: true })
    .eq("submission_id", submissionId)
    .eq("sender_role", "user")
    .eq("read_by_admin", false);

  if (error) console.error(error);
}

async function renderAdminSubmissionDetail(submissionId) {
  const detail = document.querySelector("[data-admin-submission-detail]");
  if (!detail) return;

  const submission = adminSubmissions.find((item) => item.id === submissionId);
  if (!submission) return;

  activeAdminSubmission = submission;

  await markSubmissionMessagesRead(submission.id);
  await updateAdminUnreadCounts();

  const messages = await loadAdminSubmissionMessages(submission.id);
  const tags = Array.isArray(submission.tags) ? submission.tags : [];

  detail.innerHTML = `
    <article class="admin-submission-review">
      <div class="admin-review-heading">
        <p class="eyebrow">${formatAdminSubmissionType(submission.submission_type)}</p>
        <h2>${escapeAdminSubmissionHTML(submission.title)}</h2>
      </div>

      <div class="admin-submission-meta">
        <p><strong>Status:</strong> ${formatAdminStatus(submission.status)}</p>
        <p><strong>Submitted:</strong> ${formatAdminDate(submission.created_at)}</p>
        <p><strong>Display:</strong> ${escapeAdminSubmissionHTML(submission.display_name || "Anonymous")}</p>
        <p><strong>Anonymous:</strong> ${submission.anonymous ? "Yes" : "No"}</p>
      </div>

      ${
        tags.length
          ? `<p class="my-ritual-tags">${tags.map((tag) => `<span>${escapeAdminSubmissionHTML(tag)}</span>`).join("")}</p>`
          : ""
      }

      <div class="admin-submission-body">
        ${escapeAdminSubmissionHTML(submission.body).replaceAll("\n", "<br>")}
      </div>

      <section class="admin-submission-messages">
        <h3>Conversation</h3>

        <div class="admin-message-thread">
          ${
            messages.length
              ? messages
                  .map((message) => `
                    <div class="my-submission-message ${message.sender_role === "admin" ? "is-admin-message" : "is-user-message"}">
                      <strong>${message.sender_role === "admin" ? "Salt & Sovereignty" : "Submitter"}</strong>
                      <p>${escapeAdminSubmissionHTML(message.message)}</p>
                    </div>
                  `)
                  .join("")
              : `<p class="my-submission-muted">No conversation yet.</p>`
          }
        </div>

        <form data-admin-message-form>
          <label>
            Message visible to submitter
            <textarea name="message" rows="3"></textarea>
          </label>

          <button class="button button--ghost button--small" type="submit">
            Send Message
          </button>
        </form>
      </section>

      <label>
        Private moderator notes
        <textarea rows="4" data-admin-moderator-notes>${escapeAdminSubmissionHTML(submission.moderator_notes || "")}</textarea>
      </label>

      <button class="button button--primary button--small" type="button" data-admin-save-notes>
        Save Moderator Notes
      </button>
    </article>
  `;

  renderAdminSubmissionList();
}

async function updateAdminSubmissionStatus(submissionId, status) {
  const submission =
    adminSubmissions.find((item) => item.id === submissionId) ||
    activeAdminSubmission;

  if (!submission) return;

  const notes =
    submission.id === activeAdminSubmission?.id
      ? document.querySelector("[data-admin-moderator-notes]")?.value || ""
      : submission.moderator_notes || "";

  const patch = {
    status,
    moderator_notes: notes,
    updated_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString()
  };

  if (status === "published") patch.published_at = new Date().toISOString();
  if (status === "archived") patch.archived_at = new Date().toISOString();

  if (["approved", "needs_revision", "rejected", "published", "archived"].includes(status)) {
    patch.reviewed_at = new Date().toISOString();
  }

  const { error } = await db
    .from("community_submissions")
    .update(patch)
    .eq("id", submission.id);

  if (error) {
    console.error(error);
    adminSubmissionStatus("Could not update submission.");
    return;
  }

  adminSubmissionStatus(`Moved to ${formatAdminStatus(status)}.`);

  await loadAdminSubmissions();

  const nextSubmission = adminSubmissions[0];

  if (nextSubmission) {
    await renderAdminSubmissionDetail(nextSubmission.id);
  } else {
    activeAdminSubmission = null;
    document.querySelector("[data-admin-submission-detail]").innerHTML = `
      <p class="my-sanctuary-empty">No submissions left in this view.</p>
    `;
  }
}

async function saveAdminSubmissionNotes() {
  if (!activeAdminSubmission) return;

  const notes = document.querySelector("[data-admin-moderator-notes]")?.value || "";

  const { error } = await db
    .from("community_submissions")
    .update({
      moderator_notes: notes,
      updated_at: new Date().toISOString()
    })
    .eq("id", activeAdminSubmission.id);

  if (error) {
    console.error(error);
    adminSubmissionStatus("Could not save notes.");
    return;
  }

  adminSubmissionStatus("Moderator notes saved.");
}

document.addEventListener("click", async (event) => {
  const filterButton = event.target.closest("[data-admin-filter]");
  const openButton = event.target.closest("[data-admin-open-submission]");
  const cardStatusButton = event.target.closest("[data-admin-card-status]");
  const saveNotesButton = event.target.closest("[data-admin-save-notes]");
  const pageButton = event.target.closest("[data-admin-page]");

  if (filterButton) {
    adminSubmissionFilter = filterButton.dataset.adminFilter;
    adminSubmissionPage = 1;
    activeAdminSubmission = null;

    await loadAdminSubmissions();

    document.querySelector("[data-admin-submission-detail]").innerHTML = `
      <p class="my-sanctuary-empty">Choose a submission to review.</p>
    `;
  }

  if (openButton) {
    const card = openButton.closest("[data-admin-submission-id]");
    await renderAdminSubmissionDetail(card.dataset.adminSubmissionId);
  }

  if (cardStatusButton) {
    const card = cardStatusButton.closest("[data-admin-submission-id]");
    await updateAdminSubmissionStatus(
      card.dataset.adminSubmissionId,
      cardStatusButton.dataset.adminCardStatus
    );
  }

  if (saveNotesButton) {
    await saveAdminSubmissionNotes();
  }

  if (pageButton) {
    if (pageButton.dataset.adminPage === "prev") {
      adminSubmissionPage = Math.max(1, adminSubmissionPage - 1);
    }

    if (pageButton.dataset.adminPage === "next") {
      adminSubmissionPage += 1;
    }

    activeAdminSubmission = null;
    await loadAdminSubmissions();

    document.querySelector("[data-admin-submission-detail]").innerHTML = `
      <p class="my-sanctuary-empty">Choose a submission to review.</p>
    `;
  }
});

document.addEventListener("input", async (event) => {
  const search = event.target.closest("[data-admin-search]");
  if (!search) return;

  adminSubmissionSearch = search.value || "";
  adminSubmissionPage = 1;

  window.clearTimeout(document.adminSearchTimeout);
  document.adminSearchTimeout = window.setTimeout(loadAdminSubmissions, 250);
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-admin-message-form]");
  if (!form) return;

  event.preventDefault();

  if (!activeAdminSubmission) return;

  const message = form.message.value.trim();
  if (!message) return;

  const { error: messageError } = await db
    .from("community_submission_messages")
    .insert({
      submission_id: activeAdminSubmission.id,
      user_id: currentUser.id,
      sender_role: "admin",
      message,
      read_by_admin: true
    });

  if (messageError) {
    console.error(messageError);
    adminSubmissionStatus("Message could not be sent.");
    return;
  }

  await db
    .from("community_submissions")
    .update({
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", activeAdminSubmission.id);

  form.reset();
  adminSubmissionStatus("Message sent.");
  await renderAdminSubmissionDetail(activeAdminSubmission.id);
});

window.addEventListener("load", async () => {
  const allowed = await requireSubmissionAdmin();

  if (allowed) {
    await autoArchiveOldSubmissions();
    await loadAdminSubmissions();
  }
});
