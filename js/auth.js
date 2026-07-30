/* =========================================================
   AUTHENTICATION
   Shared sanctuary login for altar and grimoire
   ========================================================= */

let currentUser = null;
let saltAuthResolved = false;
window.getCurrentSaltUser = () => currentUser;
// Presentation only. TODO: replace with RLS-protected membership/roles or
// server-authoritative custom claims; database authorization remains decisive.
const SALT_COMMUNITY_MODERATOR_IDS = new Set(window.SaltEnvironment.moderatorIds);
window.isSaltCommunityModerator = (user = currentUser) => Boolean(user && SALT_COMMUNITY_MODERATOR_IDS.has(user.id));
window.getSaltCommunityModeratorState = () => ({ resolved: saltAuthResolved, user: currentUser, canModerate: saltAuthResolved && window.isSaltCommunityModerator(currentUser) });
function announceModeratorState() {
  window.dispatchEvent(new CustomEvent("saltModeratorStateReady", { detail: window.getSaltCommunityModeratorState() }));
}
// Let later-loaded Sanctuary consumers observe that the shared helper exists,
// even when Supabase has not resolved the user yet.
queueMicrotask(announceModeratorState);

const authForms = document.querySelectorAll("[data-auth-form]");
const authStatuses = document.querySelectorAll("[data-auth-status]");
const signOutButtons = document.querySelectorAll('[data-auth-action="signout"]');

function setAuthStatus(message) {
  authStatuses.forEach((status) => {
    status.textContent = message;
  });
}

function safeAuthMessage(error, context = "account") {
  return window.SaltAccountData?.authMessage?.(error, context) || "That request could not be completed. Please try again.";
}

function announceAuthSuccess(message) {
  document.dispatchEvent(
    new CustomEvent("saltAuthSuccess", {
      detail: { message }
    })
  );

}

function updateAuthUI(user) {
  const isSignedIn = Boolean(user);

  signOutButtons.forEach((button) => {
    button.hidden = !isSignedIn;
  });

  setAuthStatus(
    isSignedIn
      ? `Signed in as ${user.email}`
      : "Continue as a guest, or sign in to save across devices."
  );

  document.body.classList.toggle("is-signed-in", isSignedIn);
}

async function getCurrentUser() {
  const { data, error } = await db.auth.getUser();

  if (error) {
    currentUser = null;
    saltAuthResolved = true;
    updateAuthUI(null);
    announceModeratorState();
    return null;
  }

  currentUser = data.user;
  saltAuthResolved = true;
  updateAuthUI(currentUser);
  announceModeratorState();
  return currentUser;
}

async function signUpWithEmail(email, password) {
  window.SaltAccountData?.preserveGuestSnapshotBeforeAuth?.(localStorage);
  const { data, error } = await db.auth.signUp({
    email,
    password
  });

  if (error) throw error;

  currentUser = data.user;
  saltAuthResolved = true;
  updateAuthUI(currentUser);
  announceModeratorState();
  return data.user;
}

async function signInWithEmail(email, password) {
  window.SaltAccountData?.preserveGuestSnapshotBeforeAuth?.(localStorage);
  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  currentUser = data.user;
  saltAuthResolved = true;
  updateAuthUI(currentUser);
  announceModeratorState();
  return data.user;
}

async function signInWithGoogle() {
  window.SaltAccountData?.preserveGuestSnapshotBeforeAuth?.(localStorage);
  const { error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.SaltEnvironment.oauthReturnUrl("/")
    }
  });

  if (error) throw error;
}

async function signOutUser() {
  const { error } = await db.auth.signOut();

  if (error) throw error;

  currentUser = null;
  saltAuthResolved = true;
  updateAuthUI(null);
  announceModeratorState();
  window.SaltSyncStatus?.setUser(null);

  document.dispatchEvent(
    new CustomEvent("saltAuthSignedOut", {
      detail: { message: "Signed out." }
    })
  );
  // A clean navigation tears down user-scoped feature caches and listeners so
  // late cloud responses cannot reveal the previous account in guest mode.
  window.setTimeout(() => {
    window.location.assign(window.SaltEnvironment.resolvePath("/"));
  }, 0);
}

authForms.forEach((authForm) => {
  if (!authForm.querySelector("[data-forgot-password]")) {
    const actions = authForm.querySelector(".sanctuary-auth-actions, .altar-auth-actions") || authForm;
    actions.insertAdjacentHTML("beforeend", '<button class="button button--ghost button--small" type="button" data-forgot-password>Forgot your password?</button>');
  }
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(authForm);
    const email = formData.get("email");
    const password = formData.get("password");

    if (!email || !password) {
      setAuthStatus("Enter an email and password first.");
      return;
    }

    setAuthStatus("Opening your sanctuary...");

    try {
      await signInWithEmail(email, password);
      authForm.reset();
      setAuthStatus("Your sanctuary is open.");
      announceAuthSuccess("Your sanctuary is open.");
    } catch (error) {
      console.warn("Sign-in failed.", { code: error.code || "auth_error" });
      setAuthStatus(safeAuthMessage(error));
    }
  });
});

document.addEventListener("click", async (event) => {
  const signUpButton = event.target.closest('[data-auth-action="signup"]');
  const signOutButton = event.target.closest('[data-auth-action="signout"]');

  if (signUpButton) {
    const authForm = signUpButton.closest("form");
    if (!authForm) return;

    const formData = new FormData(authForm);
    const email = formData.get("email");
    const password = formData.get("password");

    if (!email || !password) {
      setAuthStatus("Enter an email and password first.");
      return;
    }

    setAuthStatus("Creating your sanctuary...");

    try {
      await signUpWithEmail(email, password);
      authForm.reset();
      setAuthStatus("Your sanctuary has been created.");
      announceAuthSuccess("Your sanctuary has been created.");
    } catch (error) {
      console.warn("Sign-up failed.", { code: error.code || "auth_error" });
      setAuthStatus(safeAuthMessage(error));
    }
  }

  if (signOutButton) {
    try {
      await signOutUser();
      setAuthStatus("Signed out.");
    } catch (error) {
      console.warn("Sign-out failed.", { code: error.code || "auth_error" });
      setAuthStatus(safeAuthMessage(error));
    }
  }

  const forgotButton = event.target.closest("[data-forgot-password]");
  if (forgotButton) {
    const form = forgotButton.closest("form");
    const email = form?.querySelector('[name="email"]')?.value || "";
    if (!email) { setAuthStatus("Enter your email address first."); return; }
    forgotButton.disabled = true;
    setAuthStatus("Sending a recovery link…");
    try { setAuthStatus(await window.SaltAccountData.requestRecovery(email)); }
    catch (error) { setAuthStatus(error.message); }
    finally { forgotButton.disabled = false; }
  }
});

db.auth.onAuthStateChange((event, session) => {
  if (session?.user) window.SaltAccountData?.preserveGuestSnapshotBeforeAuth?.(localStorage);
  currentUser = session?.user || null;
  saltAuthResolved = true;
  updateAuthUI(currentUser);
  window.SaltSyncStatus?.setUser(currentUser);

  document.dispatchEvent(
    new CustomEvent("saltAuthChanged", {
      detail: {
        event,
        user: currentUser
      }
    })
  );
  announceModeratorState();
});

getCurrentUser().then((user) => {
  saltAuthResolved = true;
  document.dispatchEvent(
    new CustomEvent("saltAuthReady", {
      detail: { user }
    })
  );
  announceModeratorState();
});
