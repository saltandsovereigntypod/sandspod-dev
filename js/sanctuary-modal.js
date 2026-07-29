/* =========================================================
   SANCTUARY MODAL
   Shared guest / sign-in popup for altar and grimoire
   ========================================================= */

const SANCTUARY_CHOICE_KEY = "saltAndSovereigntySanctuaryChoice";
let sanctuaryModalOpener = null;

function hasMadeSanctuaryChoice() {
  return localStorage.getItem(SANCTUARY_CHOICE_KEY) === "true";
}

function rememberSanctuaryChoice() {
  localStorage.setItem(SANCTUARY_CHOICE_KEY, "true");
  localStorage.setItem("saltAndSovereigntyGuestScope", "true");
  localStorage.removeItem("saltAndSovereigntyPendingGuestMigrationSnapshot");
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

function closeSanctuaryModal({ clearDestination = false } = {}) {
  const modal = getSanctuaryModal();
  if (!modal) return;

  modal.classList.remove("is-visible");

  window.setTimeout(() => {
    modal.hidden = true;
    document.body.classList.remove("sanctuary-modal-open");
    if (sanctuaryModalOpener?.isConnected) sanctuaryModalOpener.focus();
    sanctuaryModalOpener = null;
  }, 260);

  if (clearDestination && typeof WelcomeDiscovery !== "undefined") {
    WelcomeDiscovery.consumeDestination(sessionStorage);
  }
}

function openSanctuaryModal(opener = document.activeElement) {
  const modal = getSanctuaryModal();
  if (!modal) return;

  sanctuaryModalOpener = opener;
  updateSanctuaryModalForUser();

  modal.hidden = false;
  document.body.classList.add("sanctuary-modal-open");

  const dialog = modal.querySelector('[role="dialog"]');
  if (dialog && !dialog.hasAttribute("tabindex")) dialog.tabIndex = -1;

  requestAnimationFrame(() => {
    modal.classList.add("is-visible");
    dialog?.focus();
  });
}

function continueToSanctuaryDestination() {
  if (typeof WelcomeDiscovery === "undefined") return false;
  const destination = WelcomeDiscovery.consumeDestination(sessionStorage);
  if (!destination) return false;
  window.location.assign(window.SaltEnvironment.resolvePath(destination));
  return true;
}

function shouldShowSanctuaryModal() {
  const isSanctuaryPage =
    document.body.classList.contains("altar-page") ||
    document.body.classList.contains("grimoire-page-shell");

  return isSanctuaryPage && !currentUser && !hasMadeSanctuaryChoice();
}

document.addEventListener("click", async (event) => {
  const destinationLink = event.target.closest("[data-sanctuary-destination]");
  const guestButton = event.target.closest("[data-sanctuary-guest]");
  const closeButton = event.target.closest("[data-sanctuary-close]");
  const continueButton = event.target.closest("[data-sanctuary-continue]");

  if (destinationLink) {
    event.preventDefault();
    const destination = typeof WelcomeDiscovery !== "undefined"
      ? WelcomeDiscovery.rememberDestination(sessionStorage, destinationLink.dataset.sanctuaryDestination)
      : destinationLink.getAttribute("href");
    if (!destination) return;

    const user = currentUser || (typeof getCurrentUser === "function" ? await getCurrentUser() : null);
    if (user) {
      continueToSanctuaryDestination();
    } else {
      openSanctuaryModal(destinationLink);
    }
    return;
  }

  if (guestButton) {
    rememberSanctuaryChoice();
    closeSanctuaryModal();
    window.setTimeout(() => continueToSanctuaryDestination(), 270);
    return;
  }

  if (continueButton) {
    closeSanctuaryModal();
    window.setTimeout(() => continueToSanctuaryDestination(), 270);
    return;
  }

  if (closeButton || event.target.matches("[data-sanctuary-modal]")) {
    closeSanctuaryModal({ clearDestination: true });
  }
});

document.addEventListener("saltAuthSuccess", () => {
  updateSanctuaryModalForUser();
  closeSanctuaryModal();
  window.setTimeout(() => continueToSanctuaryDestination(), 270);
});

document.addEventListener("keydown", (event) => {
  const modal = getSanctuaryModal();
  if (!modal || modal.hidden) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeSanctuaryModal({ clearDestination: true });
    return;
  }

  if (event.key !== "Tab") return;
  const card = modal.querySelector('[role="dialog"]');
  const focusable = [...card.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
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
