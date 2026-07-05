/* =========================================================
   AUTHENTICATION
   Shared sanctuary login for altar and grimoire
   ========================================================= */

let currentUser = null;

const authForms = document.querySelectorAll("[data-auth-form]");
const authStatuses = document.querySelectorAll("[data-auth-status]");
const signOutButtons = document.querySelectorAll('[data-auth-action="signout"]');

function setAuthStatus(message) {
  authStatuses.forEach((status) => {
    status.textContent = message;
  });
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
    updateAuthUI(null);
    return null;
  }

  currentUser = data.user;
  updateAuthUI(currentUser);
  return currentUser;
}

async function signUpWithEmail(email, password) {
  const { data, error } = await db.auth.signUp({
    email,
    password
  });

  if (error) throw error;

  currentUser = data.user;
  updateAuthUI(currentUser);
  return data.user;
}

async function signInWithEmail(email, password) {
  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  currentUser = data.user;
  updateAuthUI(currentUser);
  return data.user;
}

async function signInWithGoogle() {
  const { error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) throw error;
}

async function signOutUser() {
  const { error } = await db.auth.signOut();

  if (error) throw error;

  currentUser = null;
  updateAuthUI(null);

  document.dispatchEvent(
    new CustomEvent("saltAuthSignedOut", {
      detail: { message: "Signed out." }
    })
  );
}

authForms.forEach((authForm) => {
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
      setAuthStatus(error.message);
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
      setAuthStatus(error.message);
    }
  }

  if (signOutButton) {
    try {
      await signOutUser();
      setAuthStatus("Signed out.");
    } catch (error) {
      setAuthStatus(error.message);
    }
  }
});

db.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null;
  updateAuthUI(currentUser);

  document.dispatchEvent(
    new CustomEvent("saltAuthChanged", {
      detail: {
        event,
        user: currentUser
      }
    })
  );
});

getCurrentUser().then((user) => {
  document.dispatchEvent(
    new CustomEvent("saltAuthReady", {
      detail: { user }
    })
  );
});
