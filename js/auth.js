/* =========================================================
   AUTHENTICATION
   Handles sign up, sign in, sign out, and current user state
   ========================================================= */

let currentUser = null;

const authPanel = document.querySelector("[data-auth-panel]");
const authForm = document.querySelector("[data-auth-form]");
const authStatus = document.querySelector("[data-auth-status]");
const signInButton = document.querySelector('[data-auth-action="signin"]');
const signUpButton = document.querySelector('[data-auth-action="signup"]');
const signOutButton = document.querySelector('[data-auth-action="signout"]');

function announceAuthSuccess(message) {
  document.dispatchEvent(
    new CustomEvent("saltAuthSuccess", {
      detail: { message }
    })
  );
}

function updateAuthUI(user) {
  const isSignedIn = Boolean(user);

  if (authPanel) {
    authPanel.classList.toggle("is-signed-in", isSignedIn);
  }

  if (signInButton) signInButton.hidden = isSignedIn;
  if (signUpButton) signUpButton.hidden = isSignedIn;
  if (signOutButton) signOutButton.hidden = !isSignedIn;

  if (authStatus) {
    authStatus.textContent = isSignedIn
      ? `Signed in as ${user.email}`
      : "Sign in or create an account to save this altar.";
  }
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

async function signOutUser() {
  const { error } = await db.auth.signOut();

  if (error) throw error;

  currentUser = null;
  updateAuthUI(null);
}

if (authForm) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(authForm);
    const email = formData.get("email");
    const password = formData.get("password");

    if (!email || !password) return;

    if (authStatus) {
      authStatus.textContent = "Opening your grimoire...";
    }

    try {
      await signInWithEmail(email, password);

      if (authStatus) {
        authStatus.textContent = "Your grimoire is open.";
      }

      authForm.reset();
      announceAuthSuccess("Your grimoire is open.");
    } catch (error) {
      if (authStatus) {
        authStatus.textContent = error.message;
      }
    }
  });
}

if (signUpButton) {
  signUpButton.addEventListener("click", async () => {
    if (!authForm) return;

    const formData = new FormData(authForm);
    const email = formData.get("email");
    const password = formData.get("password");

    if (!email || !password) {
      if (authStatus) {
        authStatus.textContent = "Enter an email and password first.";
      }

      return;
    }

    if (authStatus) {
      authStatus.textContent = "Creating your grimoire...";
    }

    try {
      await signUpWithEmail(email, password);

      if (authStatus) {
        authStatus.textContent = "Your grimoire has been created.";
      }

      authForm.reset();
      announceAuthSuccess("Your grimoire has been created.");
    } catch (error) {
      if (authStatus) {
        authStatus.textContent = error.message;
      }
    }
  });
}

if (signOutButton) {
  signOutButton.addEventListener("click", async () => {
    try {
      await signOutUser();

      if (authStatus) {
        authStatus.textContent = "Your grimoire has been closed.";
      }

      document.dispatchEvent(
        new CustomEvent("saltAuthSignedOut", {
          detail: { message: "Your grimoire has been closed." }
        })
      );
    } catch (error) {
      if (authStatus) {
        authStatus.textContent = error.message;
      }
    }
  });
}

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

getCurrentUser();
