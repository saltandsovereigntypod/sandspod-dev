/* =========================================================
   MY SANCTUARY PANEL
   Shared account / sanctuary navigation panel
   ========================================================= */

function showMySanctuaryNotice(message) {
  const panel = document.querySelector("[data-my-sanctuary-panel]");
  if (!panel) return;

  const notice = panel.querySelector("[data-my-sanctuary-notice]");
  if (!notice) return;

  notice.textContent = message;
  notice.hidden = false;

  window.clearTimeout(showMySanctuaryNotice.timeout);
  showMySanctuaryNotice.timeout = window.setTimeout(() => {
    notice.hidden = true;
  }, 2200);
}

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

      <p class="my-sanctuary-notice" data-my-sanctuary-notice hidden></p>

      <form class="altar-auth-form my-sanctuary-auth-form" data-my-sanctuary-auth-form>
        <label>
          Email
          <input type="email" name="email" autocomplete="email" />
        </label>

        <label>
          Password
          <input type="password" name="password" autocomplete="current-password" />
        </label>

        <div class="my-sanctuary-auth-actions">
          <button class="button button--primary" type="submit">
            Open Sanctuary
          </button>

          <button class="button" type="button" data-my-sanctuary-signup>
            Create Sanctuary
          </button>
        </div>
      </form>

      <nav class="my-sanctuary-links" aria-label="Sanctuary navigation">
        <a href="/altar/">🕯 Digital Altar</a>
        <a href="/grimoire/index.html">📖 Book of Shadows</a>
        <span>🌙 Saved Rituals <em>Coming soon</em></span>
        <span>✨ Community Grimoire <em>Coming soon</em></span>
        <span>⚙ Settings <em>Coming soon</em></span>
      </nav>

      <div class="my-sanctuary-actions">
        <button class="button button--ghost" type="button" data-my-sanctuary-signout hidden>
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
  const authForm = panel.querySelector("[data-my-sanctuary-auth-form]");
  const signOutButton = panel.querySelector("[data-my-sanctuary-signout]");

  const isSignedIn = Boolean(currentUser);

  if (userLine) {
    userLine.textContent = isSignedIn
      ? `Signed in as ${currentUser.email}`
      : "Guest mode";
  }

  if (authForm) {
    authForm.hidden = isSignedIn;
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

document.addEventListener("submit", async (event) => {
  const authForm = event.target.closest("[data-my-sanctuary-auth-form]");
  if (!authForm) return;

  event.preventDefault();

  const formData = new FormData(authForm);
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || !password) {
    showMySanctuaryNotice("Enter an email and password first.");
    return;
  }

  showMySanctuaryNotice("Opening your sanctuary...");

  try {
    await signInWithEmail(email, password);
    authForm.reset();
    updateMySanctuaryPanel();
    showMySanctuaryNotice("Your sanctuary is open.");
  } catch (error) {
    showMySanctuaryNotice(error.message);
  }
});

document.addEventListener("click", async (event) => {
  const openButton = event.target.closest("[data-my-sanctuary-open]");
  const closeButton = event.target.closest("[data-my-sanctuary-close]");
  const signUpButton = event.target.closest("[data-my-sanctuary-signup]");
  const signOutButton = event.target.closest("[data-my-sanctuary-signout]");

  if (openButton) {
    openMySanctuaryPanel();
  }

  if (closeButton) {
    closeMySanctuaryPanel();
  }

  if (signUpButton) {
    const panel = document.querySelector("[data-my-sanctuary-panel]");
    const authForm = panel?.querySelector("[data-my-sanctuary-auth-form]");
    if (!authForm) return;

    const formData = new FormData(authForm);
    const email = formData.get("email");
    const password = formData.get("password");

    if (!email || !password) {
      showMySanctuaryNotice("Enter an email and password first.");
      return;
    }

    showMySanctuaryNotice("Creating your sanctuary...");

    try {
      await signUpWithEmail(email, password);
      authForm.reset();
      updateMySanctuaryPanel();
      showMySanctuaryNotice("Your sanctuary has been created.");
    } catch (error) {
      showMySanctuaryNotice(error.message);
    }
  }

  if (signOutButton) {
    try {
      await signOutUser();
      updateMySanctuaryPanel();
      showMySanctuaryNotice("Signed out.");
    } catch (error) {
      showMySanctuaryNotice(error.message);
    }
  }
});

document.addEventListener("saltAuthChanged", updateMySanctuaryPanel);
document.addEventListener("saltAuthSuccess", updateMySanctuaryPanel);

createMySanctuaryPanel();
updateMySanctuaryPanel();
