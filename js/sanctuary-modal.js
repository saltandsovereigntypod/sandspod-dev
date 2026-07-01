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

function closeSanctuaryModal() {
  const modal = document.querySelector("[data-sanctuary-modal]");
  if (!modal) return;

  modal.hidden = true;
  document.body.classList.remove("sanctuary-modal-open");
  rememberSanctuaryChoice();
}

function openSanctuaryModal() {
  const modal = document.querySelector("[data-sanctuary-modal]");
  if (!modal) return;

  modal.hidden = false;
  document.body.classList.add("sanctuary-modal-open");
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

  if (guestButton || closeButton) {
    closeSanctuaryModal();
  }
});

document.addEventListener("saltAuthSuccess", () => {
  closeSanctuaryModal();
});

document.addEventListener("saltAuthChanged", () => {
  if (currentUser) {
    closeSanctuaryModal();
  }
});

window.addEventListener("load", () => {
  window.setTimeout(() => {
    if (shouldShowSanctuaryModal()) {
      openSanctuaryModal();
    }
  }, 350);
});
