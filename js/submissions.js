/* =========================================================
   COMMUNITY SUBMISSIONS
   Submission form + My Submissions view
   ========================================================= */

function escapeSubmissionHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseSubmissionTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatSubmissionType(type) {
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

function formatSubmissionStatus(status) {
  const labels = {
    pending: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
    published: "Published",
    needs_revision: "Needs Revision"
  };

  return labels[status] || status || "Pending Review";
}

async function getSubmissionDisplayName(displayAs) {
  if (displayAs === "anonymous") return "Anonymous";

  if (typeof getMySettings !== "function") return "";

  const settings = await getMySettings();

  if (displayAs === "preferred_name") {
    return settings.preferred_name || "Preferred Name";
  }

  if (displayAs === "magical_name") {
    return settings.magical_name || "Magical Name";
  }

  return "Anonymous";
}

async function getMyCommunitySubmissions() {
  if (!currentUser) return [];

  const { data, error } = await db
    .from("community_submissions")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data || [];
}

async function getSubmissionMessages(submissionId) {
  if (!currentUser) return [];

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

async function renderMySubmissionsList() {
  const list = document.querySelector("[data-my-submissions-list]");
  if (!list) return;

  if (!currentUser) {
    list.innerHTML = `
      <p class="my-sanctuary-empty">
        Sign in to view submission status and responses.
      </p>
    `;
    return;
  }

  const submissions = await getMyCommunitySubmissions();

  if (submissions.length === 0) {
    list.innerHTML = `
      <p class="my-sanctuary-empty">
        You have not offered anything to the Sanctuary yet.
      </p>
    `;
    return;
  }

  list.innerHTML = submissions
    .map((submission) => `
      <article class="my-submission-card" data-my-submission-id="${submission.id}">
        <button class="my-submission-toggle" type="button" data-my-submission-toggle>
          <span>
            <strong>${escapeSubmissionHTML(submission.title)}</strong>
            <small>${formatSubmissionType(submission.submission_type)} · ${formatSubmissionStatus(submission.status)}</small>
          </span>
          <span aria-hidden="true">⌄</span>
        </button>

        <div class="my-submission-detail" data-my-submission-detail hidden>
          <p>${escapeSubmissionHTML(submission.body)}</p>

          ${
            submission.reviewer_response
              ? `<div class="my-submission-response">
                  <strong>Response from Salt & Sovereignty</strong>
                  <p>${escapeSubmissionHTML(submission.reviewer_response)}</p>
                </div>`
              : `<p class="my-submission-muted">No response has been added yet.</p>`
          }

          <div class="my-submission-messages" data-my-submission-messages></div>

          <form class="my-submission-reply-form" data-my-submission-reply-form>
            <label>
              Reply or ask a question
              <textarea name="message" rows="3"></textarea>
            </label>

            <button class="button button--ghost button--small" type="submit">
              Send Reply
            </button>
          </form>
        </div>
      </article>
    `)
    .join("");
}

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-community-submission-form]");
  if (!form) return;

  event.preventDefault();

  const status = document.querySelector("[data-community-submission-status]");
  const formData = new FormData(form);

  const displayAs = formData.get("display_as") || "anonymous";
  const displayName = await getSubmissionDisplayName(displayAs);

  const submission = {
    user_id: currentUser?.id || null,
    submission_type: formData.get("submission_type"),
    title: formData.get("title").trim(),
    body: formData.get("body").trim(),
    display_as: displayAs,
    display_name: displayName,
    anonymous: displayAs === "anonymous",
    tags: parseSubmissionTags(formData.get("tags")),
    original_work_confirmed: formData.get("original_work_confirmed") === "on",
    terms_agreed: formData.get("terms_agreed") === "on",
    status: "pending"
  };

  if (!submission.title || !submission.body) {
    if (status) status.textContent = "Please add a title and submission.";
    return;
  }

  const { error } = await db.from("community_submissions").insert(submission);

  if (error) {
    console.error(error);
    if (status) status.textContent = "Your offering could not be sent.";
    return;
  }

  form.reset();

  if (status) {
    status.textContent =
      "Your offering has been received. Every submission is personally reviewed before finding its place within Salt & Sovereignty.";
  }
});

document.addEventListener("click", async (event) => {
  const toggle = event.target.closest("[data-my-submission-toggle]");
  if (!toggle) return;

  const card = toggle.closest("[data-my-submission-id]");
  const detail = card?.querySelector("[data-my-submission-detail]");
  const messagesWrap = card?.querySelector("[data-my-submission-messages]");

  if (!card || !detail) return;

  detail.hidden = !detail.hidden;

  if (!detail.hidden && messagesWrap) {
    const messages = await getSubmissionMessages(card.dataset.mySubmissionId);

    messagesWrap.innerHTML = messages.length
      ? messages
          .map((message) => `
            <div class="my-submission-message">
              <strong>${message.sender_role === "admin" ? "Salt & Sovereignty" : "You"}</strong>
              <p>${escapeSubmissionHTML(message.message)}</p>
            </div>
          `)
          .join("")
      : "";
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-my-submission-reply-form]");
  if (!form) return;

  event.preventDefault();

  const card = form.closest("[data-my-submission-id]");
  const submissionId = card?.dataset.mySubmissionId;
  const message = form.message.value.trim();

  if (!submissionId || !message || !currentUser) return;

  const { error } = await db.from("community_submission_messages").insert({
    submission_id: submissionId,
    user_id: currentUser.id,
    sender_role: "user",
    message
  });

  if (error) {
    console.error(error);
    showMySanctuaryNotice("Reply could not be sent.");
    return;
  }

  form.reset();
  showMySanctuaryNotice("Reply sent.");
});
