/* =========================================================
   ALTAR AUTH HELPERS
   Sign-in checks used by altar saves
   ========================================================= */

function isUserSignedIn() {
  return typeof currentUser !== "undefined" && currentUser;
}

async function ensureAltarUser() {
  if (isUserSignedIn()) return currentUser;

  if (typeof getCurrentUser === "function") {
    return await getCurrentUser();
  }

  return null;
}
