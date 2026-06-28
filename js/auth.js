/* =========================================================
   AUTHENTICATION
   Handles sign up, sign in, sign out, and current user state
   ========================================================= */

let currentUser = null;

async function getCurrentUser() {
  const { data, error } = await db.auth.getUser();

  if (error) {
    console.warn("Could not get current user:", error.message);
    currentUser = null;
    return null;
  }

  currentUser = data.user;
  return currentUser;
}

async function signUpWithEmail(email, password) {
  const { data, error } = await db.auth.signUp({
    email,
    password
  });

  if (error) {
    throw error;
  }

  currentUser = data.user;
  return data.user;
}

async function signInWithEmail(email, password) {
  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw error;
  }

  currentUser = data.user;
  return data.user;
}

async function signOutUser() {
  const { error } = await db.auth.signOut();

  if (error) {
    throw error;
  }

  currentUser = null;
}

db.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null;

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
