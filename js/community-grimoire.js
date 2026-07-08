/* =========================================================
   COMMUNITY GRIMOIRE
   Public display for published community submissions
   ========================================================= */

let communityGrimoireEntries = [];
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
    podcast: "Podcast Story or Question",
    blog: "Blog or Journal Submission",
    ritual_experience: "Ritual Experience",
    dream_experience: "Dream Experience",
    other: "Other"
  };

  return labels[type] || "Community Offering";
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
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error);

    if (status) {
      status.textContent = "The Community Grimoire could not open right now.";
    }

    return [];
  }

  communityGrimoireEntries = data || [];
  return communityGrimoireEntries;
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
    if (status) {
      status.textContent = "No published pages match that search.";
    }

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
        <article class="community-grimoire-card reveal">
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
        </article>
      `;
    })
    .join("");
}

async function initCommunityGrimoirePage() {
  if (!document.querySelector("[data-community-grimoire-list]")) return;

  const searchInput = document.querySelector("[data-community-grimoire-search]");
  const typeFilter = document.querySelector("[data-community-grimoire-filter]");

  await loadCommunityGrimoireEntries();
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

document.addEventListener("DOMContentLoaded", initCommunityGrimoirePage);