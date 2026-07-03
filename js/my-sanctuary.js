/* =========================================================
   MY SANCTUARY PANEL
   Shared account / sanctuary home panel
   ========================================================= */

let mySanctuaryView = "welcome";

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
  }, 2600);
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
      <p class="my-sanctuary-notice" data-my-sanctuary-notice hidden></p>

      <section class="my-sanctuary-view" data-sanctuary-view="welcome">
        <h2>Welcome Home</h2>

        <p class="my-sanctuary-intro">
          Your private home within Salt & Sovereignty. Build an altar, write in your Book of Shadows,
          keep rituals and notes, and return to your practice in a way that feels like yours.
        </p>

        <p class="my-sanctuary-soft-note">
          Continue as a guest, or sign in to keep your sanctuary across devices.
        </p>

        <div class="my-sanctuary-choice-actions">
          <button class="button button--primary" type="button" data-my-sanctuary-show-auth>
            Sign In
          </button>

          <button class="button button--ghost" type="button" data-my-sanctuary-guest>
            Continue as Guest
          </button>
        </div>
      </section>

      <section class="my-sanctuary-view" data-sanctuary-view="auth" hidden>
        <h2>Welcome Back</h2>

        <p class="my-sanctuary-intro">
          Open your sanctuary to save your altar, grimoire, rituals, notes, and magical practice across devices.
        </p>

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

            <button
              class="button button--google"
              type="button"
              data-my-sanctuary-google>
              Continue with Google
            </button>

            <button class="button" type="button" data-my-sanctuary-signup>
              Create Sanctuary
            </button>

            <button class="button button--ghost" type="button" data-my-sanctuary-back>
              ← Back
            </button>
          </div>
        </form>
      </section>

      <section class="my-sanctuary-view" data-sanctuary-view="dashboard" hidden>
        <h2 data-my-sanctuary-dashboard-title>Guest Sanctuary</h2>

        <p class="my-sanctuary-user" data-my-sanctuary-user>
          Guest mode
        </p>

        <p class="my-sanctuary-intro" data-my-sanctuary-dashboard-copy>
          You're exploring as a guest. You can still use the altar and Book of Shadows,
          but cloud syncing needs a Sanctuary account.
        </p>

        <nav class="my-sanctuary-links" aria-label="Sanctuary navigation">
           <a href="/altar/">🕯 My Digital Altar</a>
           <a href="/grimoire/index.html">📖 My Book of Shadows</a>
           <button type="button" data-my-sanctuary-view-button="rituals">🌙 My Saved Rituals</button>
           <a href="/submit/">✦ Offer to the Sanctuary</a>
           <span>✨ Community Grimoire <em>Coming soon</em></span>
           <button type="button" data-my-sanctuary-view-button="submissions">📬 My Submissions</button>
           <button type="button" data-my-sanctuary-view-button="settings">⚙ My Settings</button>
         </nav>

        <div class="my-sanctuary-actions">
          <button class="button button--ghost" type="button" data-my-sanctuary-show-auth>
            Sign In
          </button>

          <button class="button button--ghost" type="button" data-my-sanctuary-signout hidden>
            Sign Out
          </button>
        </div>
      </section>

      <section class="my-sanctuary-view" data-sanctuary-view="rituals" hidden>
        <h2>My Rituals</h2>

        <p class="my-sanctuary-intro">
          Save ritual notes, intentions, moon phases, altar links, and tags.
        </p>

        <form class="my-sanctuary-form" data-my-ritual-form>
          <label>
            Ritual Name
            <input type="text" name="title" />
          </label>

          <label>
            Intention
            <input type="text" name="intention" />
          </label>

          <label>
            Moon Phase
            <input type="text" name="moon_phase" placeholder="New moon, full moon, dark moon..." />
          </label>

          <label>
            Linked Altar
            <input type="text" name="linked_altar" placeholder="Optional altar name" />
          </label>

          <label>
            Ritual Date
            <input type="date" name="ritual_date" />
          </label>

          <label>
            Tags
            <input type="text" name="tags" placeholder="protection, Hekate, cleansing" />
          </label>

          <label>
            Notes
            <textarea name="notes" rows="5"></textarea>
          </label>

          <button class="button button--primary" type="submit">
            Save Ritual
          </button>
        </form>

        <div class="my-rituals-list" data-my-rituals-list></div>

        <button class="button button--ghost" type="button" data-my-sanctuary-dashboard>
          ← Back to Sanctuary
        </button>
      </section>

      <section class="my-sanctuary-view" data-sanctuary-view="submissions" hidden>
        <h2>My Submissions</h2>
      
        <p class="my-sanctuary-intro">
          See what you have offered to Salt & Sovereignty, check review status, and read any responses.
        </p>
      
        <div class="my-submissions-list" data-my-submissions-list></div>
      
        <button class="button button--ghost" type="button" data-my-sanctuary-dashboard>
          ← Back to Sanctuary
        </button>
      </section>

      <section class="my-sanctuary-view" data-sanctuary-view="settings" hidden>
        <h2>My Settings</h2>

        <p class="my-sanctuary-intro">
          Shape your sanctuary so it feels more like yours.
        </p>

        <form class="my-sanctuary-form" data-my-settings-form>
          <label>
            Preferred Name
            <input type="text" name="preferred_name" />
          </label>

          <label>
              Pronouns
              <input type="text" name="pronouns" placeholder="she/her, they/them, he/him..." />
            </label>

          <label>
            Magical Name
            <input type="text" name="magical_name" />
          </label>

          <label>
            Default Altar Background
            <select name="default_altar_background">
              <option value="">No default</option>
              <option value="Forest Altar">Forest Altar</option>
              <option value="Deity Shelf Altar">Deity Shelf Altar</option>
            </select>
          </label>

          <label class="my-sanctuary-check">
            <input type="checkbox" name="default_mundane_mode" />
            Use mundane mode by default for my Book of Shadows
          </label>

          <button class="button button--primary" type="submit">
            Save Settings
          </button>
        </form>

        <div class="my-sanctuary-admin-link" data-sanctuary-admin-link hidden>
           <p class="eyebrow">Admin</p>
         
           <a class="button button--ghost" href="/admin/submissions/">
             Review Community Submissions →
           </a>
         </div>

        <button class="button button--ghost" type="button" data-my-sanctuary-dashboard>
          ← Back to Sanctuary
        </button>
      </section>
    </aside>
  `;

  document.body.appendChild(panel);
}

function setMySanctuaryView(view) {
  const panel = document.querySelector("[data-my-sanctuary-panel]");
  if (!panel) return;

  mySanctuaryView = view;

  panel.querySelectorAll("[data-sanctuary-view]").forEach((section) => {
    section.hidden = section.dataset.sanctuaryView !== view;
  });

  if (view === "rituals" && typeof renderMyRitualsList === "function") {
    renderMyRitualsList();
  }

  if (view === "settings" && typeof populateMySettingsForm === "function") {
    populateMySettingsForm();
  }

   if (view === "submissions" && typeof renderMySubmissionsList === "function") {
     renderMySubmissionsList();
   }
}

function updateSanctuaryAdminLink() {
  const adminLink = document.querySelector("[data-sanctuary-admin-link]");
  if (!adminLink) return;

  const adminIds = [
    "ddc5463e-1551-498b-b5af-79ce52ac591c",
    "5c63e3ac-920c-4980-9aa7-f6f322a67a2e"
  ];

  adminLink.hidden = !currentUser || !adminIds.includes(currentUser.id);
}

function updateMySanctuaryPanel() {
  const panel = document.querySelector("[data-my-sanctuary-panel]");
  if (!panel) return;

  const userLine = panel.querySelector("[data-my-sanctuary-user]");
  const dashboardTitle = panel.querySelector("[data-my-sanctuary-dashboard-title]");
  const dashboardCopy = panel.querySelector("[data-my-sanctuary-dashboard-copy]");
  const signInButtons = panel.querySelectorAll("[data-my-sanctuary-show-auth]");
  const signOutButton = panel.querySelector("[data-my-sanctuary-signout]");

  const isSignedIn = Boolean(currentUser);

  if (userLine) {
    userLine.textContent = isSignedIn
      ? `Signed in as ${currentUser.email}`
      : "Guest mode";
  }

  if (dashboardTitle) {
    dashboardTitle.textContent = isSignedIn ? "Welcome Back" : "Guest Sanctuary";
  }

  if (dashboardCopy) {
    dashboardCopy.textContent = isSignedIn
      ? "Your sanctuary is open. Your altar, grimoire, rituals, notes, and saved practice can follow you across your devices."
      : "You're exploring as a guest. You can still use the altar and Book of Shadows, but cloud syncing needs a Sanctuary account.";
  }

  signInButtons.forEach((button) => {
    button.hidden = isSignedIn;
  });

  if (signOutButton) {
    signOutButton.hidden = !isSignedIn;
  }

   updateSanctuaryAdminLink();

  if (isSignedIn && mySanctuaryView !== "auth" && mySanctuaryView !== "rituals" && mySanctuaryView !== "settings") {
    setMySanctuaryView("dashboard");
  }
}

function openMySanctuaryPanel() {
  createMySanctuaryPanel();
  updateMySanctuaryPanel();

  const panel = document.querySelector("[data-my-sanctuary-panel]");
  if (!panel) return;

  setMySanctuaryView(currentUser ? "dashboard" : "welcome");

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
    setMySanctuaryView("dashboard");
    showMySanctuaryNotice("Your sanctuary is open.");
  } catch (error) {
    showMySanctuaryNotice(error.message);
  }
});

document.addEventListener("click", async (event) => {
  const openButton = event.target.closest("[data-my-sanctuary-open]");
  const closeButton = event.target.closest("[data-my-sanctuary-close]");
  const showAuthButton = event.target.closest("[data-my-sanctuary-show-auth]");
  const guestButton = event.target.closest("[data-my-sanctuary-guest]");
  const backButton = event.target.closest("[data-my-sanctuary-back]");
  const dashboardButton = event.target.closest("[data-my-sanctuary-dashboard]");
  const viewButton = event.target.closest("[data-my-sanctuary-view-button]");
  const signUpButton = event.target.closest("[data-my-sanctuary-signup]");
  const googleButton = event.target.closest("[data-my-sanctuary-google]");
  const signOutButton = event.target.closest("[data-my-sanctuary-signout]");

  if (openButton) openMySanctuaryPanel();
  if (closeButton) closeMySanctuaryPanel();
  if (showAuthButton) setMySanctuaryView("auth");
  if (guestButton) setMySanctuaryView("dashboard");
  if (backButton) setMySanctuaryView("welcome");
  if (dashboardButton) setMySanctuaryView("dashboard");

  if (viewButton) {
     setMySanctuaryView(viewButton.dataset.mySanctuaryViewButton);
   }

   if (googleButton) {
     try {
       await signInWithGoogle();
     } catch (error) {
       showMySanctuaryNotice(error.message);
     }
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
      setMySanctuaryView("dashboard");
      showMySanctuaryNotice("Your sanctuary has been created.");
    } catch (error) {
      showMySanctuaryNotice(error.message);
    }
  }

  if (signOutButton) {
    try {
      await signOutUser();
      updateMySanctuaryPanel();
      setMySanctuaryView("welcome");
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
