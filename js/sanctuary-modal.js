/* =========================================================
   SANCTUARY MODAL
   Shared guest / sign-in popup for altar and grimoire
   ========================================================= */

const SANCTUARY_CHOICE_KEY = "saltAndSovereigntySanctuaryChoice";

function hasMadeSanctuaryChoice() {
  return localStorage.getItem(SANCTUARY_CHOICE_KEY) === "true";
}

function rememberSanctuaryChoice() {
  localStorage.setItem(SANCTUARY_CHOICE_KEY, "true");
}

function getSanctuaryModal() {
  return document.querySelector("[data-sanctuary-modal]");
}

function updateSanctuaryModalForUser() {
  const modal = getSanctuaryModal();
  if (!modal) return;

  const signedOutView = modal.querySelector("[data-sanctuary-signed-out]");
  const signedInView = modal.querySelector("[data-sanctuary-signed-in]");
  const signedInEmail = modal.querySelector("[data-sanctuary-email]");

  const isSignedIn = Boolean(currentUser);

  if (signedOutView) signedOutView.hidden = isSignedIn;
  if (signedInView) signedInView.hidden = !isSignedIn;

  if (signedInEmail && currentUser?.email) {
    signedInEmail.textContent = currentUser.email;
  }
}

function closeSanctuaryModal() {
  const modal = getSanctuaryModal();
  if (!modal) return;

  modal.classList.remove("is-visible");

  window.setTimeout(() => {
    modal.hidden = true;
    document.body.classList.remove("sanctuary-modal-open");
  }, 260);

  rememberSanctuaryChoice();
}

function openSanctuaryModal() {
  const modal = getSanctuaryModal();
  if (!modal) return;

  updateSanctuaryModalForUser();

  modal.hidden = false;
  document.body.classList.add("sanctuary-modal-open");

  requestAnimationFrame(() => {
    modal.classList.add("is-visible");
  });
}

function shouldShowSanctuaryModal() {
  const isSanctuaryPage =
    document.body.classList.contains("altar-page") ||
    document.body.classList.contains("grimoire-page-shell");

  return isSanctuaryPage && !currentUser && !hasMadeSanctuaryChoice();
}

document.addEventListener("click", (event) => {
  const guestButton = event.target.closest("[data-sanctuary-guest]");
  const closeButton = event.target.closest("[data-sanctuary-close]");
  const continueButton = event.target.closest("[data-sanctuary-continue]");

  if (guestButton || closeButton || continueButton) {
    closeSanctuaryModal();
  }
});

document.addEventListener("saltAuthSuccess", () => {
  updateSanctuaryModalForUser();
  closeSanctuaryModal();
});

document.addEventListener("saltAuthChanged", () => {
  updateSanctuaryModalForUser();
});

window.addEventListener("load", () => {
  window.setTimeout(() => {
    updateSanctuaryModalForUser();

    if (shouldShowSanctuaryModal()) {
      openSanctuaryModal();
    }
  }, 350);
});
