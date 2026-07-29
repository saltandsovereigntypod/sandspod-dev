(function initializeAccountDataUI(global) {
  "use strict";
  const safe = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const formatSync = (value) => value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "No successful cloud save recorded on this device";
  const statusLabel = (status) => ({ connected: "Connected", saving: "Saving…", saved: "Saved", offline: "Offline", unavailable: "Cloud unavailable", guest: "Guest data only" }[status] || "Sign in to sync");

  function mount(panel, user) {
    if (!panel || panel.querySelector("[data-account-data-controls]")) return;
    const section = document.createElement("section");
    section.className = "account-data-controls";
    section.dataset.accountDataControls = "";
    const passwordIdentity = global.SaltAccountData.hasPasswordIdentity(user);
    section.innerHTML = user ? `
      <section class="account-summary-card" aria-labelledby="account-summary-title">
        <h3 id="account-summary-title">Account</h3>
        <dl><div><dt>Signed in as</dt><dd>${safe(user.email || "Current account")}</dd></div><div><dt>Sign-in method</dt><dd>${safe(global.SaltAccountData.providerSummary(user))}</dd></div><div><dt>Cloud status</dt><dd role="status" aria-live="polite" data-cloud-status>Connected</dd></div><div><dt>Last successful sync</dt><dd data-last-sync>No successful cloud save recorded on this device</dd></div></dl>
        <p>Signed-in Sanctuary data is saved to your cloud account. Temporary drafts and cached copies may still live in this browser, so complete backups remain a gentle safeguard. Signing out does not delete cloud records.</p>
        <details><summary>Technical details</summary><p>Deployment: ${safe(global.SaltEnvironment?.name || "unknown")}. Account records remain owned by your internal account ID, not your email address.</p></details>
      </section>
      <section class="account-security"><h3>Security</h3>
        ${passwordIdentity ? `<form data-change-password><h4>Change Password</h4><label>New password<input type="password" name="password" minlength="${global.SaltAccountData.MIN_PASSWORD_LENGTH}" autocomplete="new-password" required></label><label>Confirm new password<input type="password" name="confirmation" minlength="${global.SaltAccountData.MIN_PASSWORD_LENGTH}" autocomplete="new-password" required></label><button class="button button--primary button--small" type="submit">Change Password</button><p role="status" aria-live="polite" data-change-password-status></p></form>` : `<p>This account currently uses Google sign-in. No email/password identity is linked, so there is no password to change here.</p>`}
        <form data-change-email><h4>Change Email</h4><p>Current email: <strong>${safe(user.email || "Unavailable")}</strong></p><label>New email<input type="email" name="email" autocomplete="email" required></label><label>Confirm new email<input type="email" name="confirmation" autocomplete="email" required></label><button class="button button--primary button--small" type="submit">Request Email Change</button><p>Confirmation may be required at your old and new addresses. This display changes only after Supabase confirms the new email.</p><p role="status" aria-live="polite" data-change-email-status></p></form>
        <form data-recovery-form><h4>Send Password Recovery Link</h4><input type="hidden" name="email" value="${safe(user.email || "")}"><button class="button button--ghost button--small" type="submit">Send Recovery Link</button><p role="status" aria-live="polite" data-recovery-status></p></form>
      </section>
      <section class="account-device"><h3>This Device</h3><p>Local cache clearing is not offered because this version cannot reliably separate rebuildable cloud caches from unsynchronized drafts. A complete backup is the safe option.</p></section>
      <section class="account-danger-zone"><h3>Danger Zone</h3><p>Account deletion requires the secure server-side deletion function. It is unavailable until that function and its retention policy are deployed and verified.</p><details><summary>Safeguards required before deletion can be enabled</summary><p>A fresh complete backup, a recent sign-in, and the typed phrase <strong>${global.SaltAccountData.DELETE_CONFIRMATION}</strong> will be required. Published community work may remain only in anonymized form.</p></details><button class="button button--ghost button--small" type="button" disabled>Delete Account — Not Yet Configured</button></section>
    ` : `
      <section class="account-summary-card"><h3>Guest Sanctuary</h3><p>Your work is stored only in this browser. Clearing browser storage can remove it, and guest data does not automatically move into an account. Download a complete guest backup before clearing anything.</p></section>
      <section class="account-guest-clear"><h3>This Browser</h3><p>Clear known guest settings, Altars, drafts, Book of Shadows data, Living Library records, Apothecary items, and rituals from this browser only. Cloud records and unrelated website data are not touched.</p><button class="button button--ghost button--small" type="button" data-prepare-guest-clear>Download Required Guest Backup</button><div data-guest-clear-confirmation hidden><label>Type ${global.SaltAccountData.GUEST_CLEAR_CONFIRMATION}<input type="text" autocomplete="off" data-guest-clear-phrase></label><button class="button button--ghost button--small" type="button" data-clear-guest-data>Clear This Browser’s Guest Data</button></div><p role="status" aria-live="polite" data-guest-clear-status></p></section>`;
    panel.prepend(section);
    if (!panel.dataset.accountStateBound) {
      panel.dataset.accountStateBound = "true";
      document.addEventListener("saltAuthChanged", (event) => {
        const nextUser = event.detail?.user || null;
        panel.querySelector("[data-account-data-controls]")?.remove();
        panel.querySelector("[data-sanctuary-backup-controls]")?.remove();
        const actions = panel.querySelector("[data-account-auth-actions]");
        if (actions) actions.innerHTML = nextUser ? '<button type="button" class="button button--ghost" data-my-sanctuary-signout>Sign Out</button>' : '<button type="button" class="button button--ghost" data-my-sanctuary-show-auth>Sign In or Create Account</button>';
        mount(panel, nextUser);
        global.SanctuaryBackupUI?.mount?.(panel, nextUser);
      });
    }

    function renderSync() {
      const sync = global.SaltSyncStatus.get();
      section.querySelector("[data-cloud-status]")?.replaceChildren(statusLabel(sync.status));
      section.querySelector("[data-last-sync]")?.replaceChildren(formatSync(sync.lastSuccess));
    }
    if (user) { global.SaltSyncStatus.setUser(user); renderSync(); global.addEventListener("saltSyncStatusChanged", renderSync); }

    const passwordForm = section.querySelector("[data-change-password]");
    passwordForm?.addEventListener("submit", async (event) => { event.preventDefault(); const status = passwordForm.querySelector("[data-change-password-status]"); status.textContent = "Updating your password…"; const data = new FormData(passwordForm); try { await global.SaltAccountData.updatePassword(data.get("password"), data.get("confirmation")); passwordForm.reset(); status.textContent = "Your password has been changed."; } catch (error) { passwordForm.querySelectorAll('input[type="password"]').forEach((input) => { input.value = ""; }); status.textContent = error.message; } });
    const emailForm = section.querySelector("[data-change-email]");
    emailForm?.addEventListener("submit", async (event) => { event.preventDefault(); const status = emailForm.querySelector("[data-change-email-status]"); status.textContent = "Requesting your email change…"; const data = new FormData(emailForm); try { await global.SaltAccountData.requestEmailChange(global.getCurrentSaltUser?.(), data.get("email"), data.get("confirmation")); emailForm.reset(); status.textContent = "Your request was sent. The account email will update after the required confirmations."; } catch (error) { status.textContent = error.message; } });
    const recoveryForm = section.querySelector("[data-recovery-form]");
    recoveryForm?.addEventListener("submit", async (event) => { event.preventDefault(); const status = recoveryForm.querySelector("[data-recovery-status]"); status.textContent = "Sending a recovery link…"; try { status.textContent = await global.SaltAccountData.requestRecovery(new FormData(recoveryForm).get("email")); } catch (error) { status.textContent = error.message; } });

    let guestBackupReady = false;
    const guestStatus = section.querySelector("[data-guest-clear-status]");
    section.querySelector("[data-prepare-guest-clear]")?.addEventListener("click", async () => { guestStatus.textContent = "Preparing your guest backup…"; const backup = await global.SanctuaryBackupUI.exportBackup(guestStatus); if (backup) { guestBackupReady = true; section.querySelector("[data-guest-clear-confirmation]").hidden = false; section.querySelector("[data-guest-clear-phrase]").focus(); guestStatus.textContent = "Backup downloaded. Review the confirmation before clearing this browser."; } });
    section.querySelector("[data-clear-guest-data]")?.addEventListener("click", () => { try { const result = global.SaltAccountData.clearGuestData(localStorage, section.querySelector("[data-guest-clear-phrase]").value, guestBackupReady); guestStatus.textContent = `${result.count} guest data groups were removed. Reloading the Sanctuary…`; window.setTimeout(() => window.location.reload(), 500); } catch (error) { guestStatus.textContent = error.message; } });
  }

  global.SaltAccountDataUI = { mount, formatSync, statusLabel };
})(typeof window !== "undefined" ? window : globalThis);
