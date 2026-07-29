(function initializePasswordReset(global) {
  "use strict";
  const form = document.querySelector("[data-reset-password-form]");
  const status = document.querySelector("[data-reset-password-status]");
  const returnLink = document.querySelector("[data-return-to-sign-in]");
  if (!form || !status || !global.db || !global.SaltAccountData) return;
  returnLink.href = global.SaltEnvironment.resolvePath("/");
  let recoveryReady = false;

  function showInvalid() {
    recoveryReady = false;
    form.hidden = true;
    status.textContent = "This recovery link is invalid, expired, or has already been used. Request a new link from the sign-in form.";
  }

  async function inspectRecovery() {
    const { data, error } = await global.db.auth.getSession();
    if (error || !data?.session?.user) { showInvalid(); return; }
    recoveryReady = true;
    form.hidden = false;
    status.textContent = "Recovery link accepted. Choose your new password.";
    form.elements.password.focus();
  }

  global.db.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session?.user) {
      recoveryReady = true; form.hidden = false; status.textContent = "Recovery link accepted. Choose your new password.";
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!recoveryReady) { showInvalid(); return; }
    const submit = form.querySelector('button[type="submit"]');
    const values = new FormData(form);
    const validation = global.SaltAccountData.validatePasswordPair(values.get("password"), values.get("confirmation"));
    if (!validation.valid) { status.textContent = validation.message; return; }
    submit.disabled = true; status.textContent = "Saving your new password…";
    try {
      await global.SaltAccountData.updatePassword(values.get("password"), values.get("confirmation"));
      form.reset(); form.hidden = true; recoveryReady = false;
      status.textContent = "Your password has been updated. You may return to the Sanctuary.";
    } catch (error) { form.querySelectorAll('input[type="password"]').forEach((input) => { input.value = ""; }); status.textContent = error.message; }
    finally { submit.disabled = false; }
  });

  inspectRecovery().catch(() => showInvalid());
})(window);
