/* =========================================================
   MY SANCTUARY PANEL
   Shared account / sanctuary navigation panel
   ========================================================= */

function createMySanctuaryPanel() {
  if (document.querySelector("[data-my-sanctuary-panel]")) return;

  const panel = document.createElement("div");
  panel.className = "my-sanctuary-panel";
  panel.hidden = true;
  panel.setAttribute("data-my-sanctuary-panel", "");

  panel.innerHTML = `
    <div class="my-sanctuary-backdrop" data-my-sanctuary-close></div>

    <aside class="my-sanctuary-card" aria-label="My Sanctuary">
      <button class="my-sanctuary-close" type="button" data-my-sanctuary-close aria-label="Close">
        ×
      </button>

      <p class="eyebrow">The Sanctuary</p>
      <h2>My Sanctuary</h2>

      <p class="my-sanctuary-user" data-my-sanctuary-user>
        Guest mode
      </p>

      <nav class="my-sanctuary-links" aria-label="Sanctuary navigation">
        <a href="/sandspod/altar/">🕯 Digital Altar</a>
        <a href="/sandspod/grimoire/index.html">📖 Book of Shadows</a>
        <span>🌙 Saved Rituals <em>Coming soon</em></span>
        <span>✨ Community Grimoire <em>Coming soon</em></span>
        <span>⚙ Settings <em>Coming soon</em></span>
      </nav>

      <div class="my-sanctuary-actions">
        <button class="button button--primary" type="button" data-my-sanctuary-auth>
          Open Sanctuary
        </button>

        <button class="button button--ghost" type="button" data-auth-action="signout" hidden>
          Sign Out
        </button>
      </div>
    </aside>
  `;

  document.body.appendChild(panel);
}

function updateMySanctuaryPanel() {
  const panel = document.querySelector("[data-my-sanctuary-panel]");
  if (!panel) return;

  const userLine = panel.querySelector("[data-my-sanctuary-user]");
  const authButton = panel.querySelector("[data-my-sanctuary-auth]");
  const signOutButton = panel.querySelector('[data-auth-action="signout"]');

  const isSignedIn = Boolean(currentUser);

  if (userLine) {
    userLine.textContent = isSignedIn
      ? `Signed in as ${currentUser.email}`
      : "Guest mode";
  }

  if (authButton) {
    authButton.hidden = isSignedIn;
  }

  if (signOutButton) {
    signOutButton.hidden = !isSignedIn;
  }
}

function openMySanctuaryPanel() {
  createMySanctuaryPanel();
  updateMySanctuaryPanel();

  const panel = document.querySelector("[data-my-sanctuary-panel]");
  if (!panel) return;

  panel.hidden = false;

  requestAnimationFrame(() => {
    panel.classList.add("is-visible");
  });
}

function closeMySanctuaryPanel() {
  const panel = document.querySelector("[data-my-sanctuary-panel]");
  if (!panel) return;

  panel.classList.remove("is-visible");

  window.setTimeout(() => {
    panel.hidden = true;
  }, 250);
}

document.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-my-sanctuary-open]");
  const closeButton = event.target.closest("[data-my-sanctuary-close]");
  const authButton = event.target.closest("[data-my-sanctuary-auth]");

  if (openButton) {
    openMySanctuaryPanel();
  }

  if (closeButton) {
    closeMySanctuaryPanel();
  }

  if (authButton) {
    closeMySanctuaryPanel();
    openSanctuaryModal();
  }
});

document.addEventListener("saltAuthChanged", updateMySanctuaryPanel);
document.addEventListener("saltAuthSuccess", updateMySanctuaryPanel);

createMySanctuaryPanel();
updateMySanctuaryPanel();
