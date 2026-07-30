(function initializeGuestAccountMigrationUI(global) {
  "use strict";
  const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
  const filename = () => `salt-and-sovereignty-before-guest-migration-${new Date().toISOString().slice(0, 10)}.json`;

  async function mount(panel, user) {
    if (!panel || !user?.id || panel.querySelector("[data-guest-migration]") || !global.GuestAccountMigration?.hasGuestData(localStorage)) return null;
    let preview;
    try { preview = await global.GuestAccountMigration.createPreview(localStorage); }
    catch (error) { console.warn("Guest migration preview was rejected.", { code: "invalid_guest_data" }); return null; }
    if (global.getCurrentSaltUser?.()?.id !== user.id) return null;
    if (global.GuestAccountMigration.isDismissed(localStorage, user.id, preview.fingerprint)) return null;

    const section = document.createElement("section");
    section.className = "guest-migration-card";
    section.dataset.guestMigration = "";
    section.innerHTML = `
      <div class="guest-migration-heading"><div><p class="eyebrow">Guest Sanctuary Found</p><h3>This browser still holds guest work</h3></div><button class="button button--ghost button--tiny" type="button" data-dismiss-guest-migration>Dismiss</button></div>
      <p>You can review what is here and deliberately choose what to bring into this account. Nothing moves during preview, and your guest copy stays in this browser after migration.</p>
      <button class="button button--primary button--small" type="button" data-review-guest-migration>Review Guest Data</button>
      <div data-guest-migration-preview hidden>
        <div class="guest-migration-summary" data-guest-migration-summary></div>
        <fieldset class="guest-migration-categories"><legend>Choose what to bring with you</legend>
          <div class="guest-migration-selection-actions"><button class="button button--ghost button--tiny" type="button" data-select-migration-all>Select all</button><button class="button button--ghost button--tiny" type="button" data-select-migration-none>Deselect all</button></div>
          ${preview.categories.map((category) => `<label><input type="checkbox" value="${category.id}" data-migration-category ${category.selected ? "checked" : ""} ${category.supported && preview.counts[category.id] ? "" : "disabled"}><span>${category.label}</span><small>${preview.counts[category.id] || 0} record${preview.counts[category.id] === 1 ? "" : "s"}${category.supported ? "" : " · unsupported in version 1"}</small></label>`).join("")}
        </fieldset>
        <div class="guest-migration-warnings" data-migration-warnings></div>
        <div class="my-sanctuary-actions"><button class="button button--ghost button--small" type="button" data-download-migration-backup>Download Guest Safety Backup</button><button class="button button--ghost button--small" type="button" data-review-migration-plan disabled>Review Migration Plan</button><button class="button button--primary button--small" type="button" data-apply-migration disabled>Bring Selected Data Into My Account</button></div>
        <div class="guest-migration-conflicts" data-migration-conflicts></div>
        <p role="status" aria-live="polite" data-guest-migration-status>Preview only. No cloud writes have occurred.</p>
        <div class="guest-migration-complete" data-migration-complete hidden><h4>Migration Complete</h4><p>Your selected guest records are saved to this account. The guest copy remains in this browser by default.</p><button class="button button--ghost button--small" type="button" data-keep-guest-copy>Keep Guest Copy on This Browser</button><p>Selective cleanup is not safe in this version, so no guest records were removed. Use the full guest-clear tool only after reviewing your backup and all unselected work.</p></div>
      </div>`;
    panel.insertBefore(section, panel.querySelector("[data-sanctuary-backup-controls]") || null);

    const previewBox = section.querySelector("[data-guest-migration-preview]");
    const status = section.querySelector("[data-guest-migration-status]");
    const planButton = section.querySelector("[data-review-migration-plan]");
    const applyButton = section.querySelector("[data-apply-migration]");
    let backupDigest = null; let plan = null;
    const selected = () => [...section.querySelectorAll("[data-migration-category]:checked")].map((input) => input.value);
    const updateSelection = () => { plan = null; applyButton.disabled = true; planButton.disabled = backupDigest !== preview.digest || !selected().length; status.textContent = selected().length ? "Selection updated. Review the plan before migration." : "Choose at least one supported category."; };

    section.querySelector("[data-guest-migration-summary]").innerHTML = `<strong>Your guest copy includes</strong><ul><li>${countLabel(preview.counts.altars, "Altar layout")}</li><li>${countLabel(preview.counts.livingLibrary, "Living Library entry", "Living Library entries")}</li><li>${countLabel(preview.counts.apothecary, "Apothecary item")}</li><li>${countLabel(preview.counts.rituals, "ritual record")}</li><li>${countLabel(preview.counts.custom, "custom Cabinet item")}</li><li>${countLabel(preview.counts.assets, "embedded image")}</li></ul>`;
    const warnings = section.querySelector("[data-migration-warnings]");
    if (preview.unsupported.length) { const details = document.createElement("details"); const summary = document.createElement("summary"); summary.textContent = "Items requiring review"; const list = document.createElement("ul"); preview.unsupported.forEach((warning) => { const item = document.createElement("li"); item.textContent = warning; list.append(item); }); details.append(summary, list); warnings.append(details); }

    section.querySelector("[data-review-guest-migration]").addEventListener("click", () => { previewBox.hidden = false; section.querySelector("[data-migration-category]:checked")?.focus(); });
    section.querySelector("[data-dismiss-guest-migration]").addEventListener("click", () => { global.GuestAccountMigration.dismiss(localStorage, user.id, preview.fingerprint); section.remove(); global.dispatchEvent(new CustomEvent("guestMigrationDismissed", { detail: { fingerprint: preview.fingerprint } })); });
    section.querySelectorAll("[data-migration-category]").forEach((input) => input.addEventListener("change", updateSelection));
    section.querySelector("[data-select-migration-all]").addEventListener("click", () => { section.querySelectorAll("[data-migration-category]:not(:disabled)").forEach((input) => { input.checked = true; }); updateSelection(); });
    section.querySelector("[data-select-migration-none]").addEventListener("click", () => { section.querySelectorAll("[data-migration-category]").forEach((input) => { input.checked = false; }); updateSelection(); });
    section.querySelector("[data-download-migration-backup]").addEventListener("click", async () => { status.textContent = "Preparing your guest safety backup…"; try { const fresh = await global.GuestAccountMigration.createPreview(localStorage); if (fresh.digest !== preview.digest) { preview = fresh; backupDigest = null; planButton.disabled = true; status.textContent = "Guest data changed. Review the updated preview before downloading a new backup."; return; } const backup = await global.GuestAccountMigration.createSafetyBackup(preview, { fetch: global.fetch?.bind(global) }); global.SanctuaryBackup.downloadJson(backup, filename()); backupDigest = preview.digest; planButton.disabled = !selected().length; status.textContent = `Version ${backup.version} guest safety backup downloaded. You may now review the migration plan.`; } catch (error) { status.textContent = "The safety backup could not be completed. Migration remains disabled."; } });
    planButton.addEventListener("click", async () => { if (backupDigest !== preview.digest || !selected().length) return; planButton.disabled = true; status.textContent = "Comparing selected guest records with this account…"; try { if (!await global.GuestAccountMigration.isPreviewCurrent(localStorage, preview)) { backupDigest = null; applyButton.disabled = true; throw new Error("Guest data changed after the backup. Review it and download a new safety backup."); } plan = await global.GuestAccountMigration.buildPlan(preview, selected(), global.db, global.getCurrentSaltUser?.()); const conflicts = section.querySelector("[data-migration-conflicts]"); conflicts.replaceChildren(); const message = document.createElement("p"); message.textContent = plan.conflicts.length ? `${plan.conflicts.length} cloud record${plan.conflicts.length === 1 ? "" : "s"} already exist and will be kept. Those guest records will be skipped.` : "No stable-ID cloud conflicts were found."; conflicts.append(message); if (plan.warnings.length) { const details = document.createElement("details"); details.innerHTML = `<summary>Migration notes (${plan.warnings.length})</summary>`; const list = document.createElement("ul"); plan.warnings.forEach((warning) => { const item = document.createElement("li"); item.textContent = warning; list.append(item); }); details.append(list); conflicts.append(details); } applyButton.disabled = false; status.textContent = "Plan ready. Cloud records are kept by default; review the notes before continuing."; } catch (error) { console.warn("Guest migration planning failed.", { code: "plan_failed" }); const safeMessage = /^(?:Guest data changed|Sign in before|Choose at least|Guest data did not)/.test(error.message || "") ? error.message : "A safe migration plan could not be prepared. Nothing was written."; status.textContent = safeMessage; } finally { planButton.disabled = backupDigest !== preview.digest || !selected().length; } });
    applyButton.addEventListener("click", async () => { if (!plan) return; applyButton.disabled = true; status.textContent = "Preparing your migration…"; const result = await global.GuestAccountMigration.applyPlan(plan, { database: global.db, storage: localStorage, getCurrentUser: global.getCurrentSaltUser, onProgress: (message) => { status.textContent = message; } }).catch((error) => ({ complete: false, message: /^(?:The signed-in account changed|Guest data changed)/.test(error.message || "") ? error.message : "Migration stopped safely. Your guest data is unchanged." })); if (!result.complete) { status.textContent = result.message || "Migration stopped safely. Your guest data is unchanged."; applyButton.disabled = false; return; } status.textContent = `Migration verified. ${result.completedStages.length} cloud stages completed. Your guest copy remains untouched.`; section.querySelector("[data-migration-complete]").hidden = false; applyButton.hidden = true; });
    section.querySelector("[data-keep-guest-copy]").addEventListener("click", () => { section.querySelector("[data-migration-complete]").hidden = true; status.textContent = "Guest copy kept on this browser."; });
    return { section, preview };
  }

  global.GuestAccountMigrationUI = { mount, countLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = global.GuestAccountMigrationUI;
})(typeof window !== "undefined" ? window : globalThis);
