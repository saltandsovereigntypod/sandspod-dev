(function initializeSanctuaryBackupUI(global) {
  "use strict";
  const LAST_EXPORT_KEY = "saltAndSovereigntyLastBackupAt";
  let preview = null;
  let preparedPlan = null;
  let safetyBackupDownloaded = false;

  const dateName = (prefix = "salt-and-sovereignty-backup") => `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;
  const countSummary = (backup) => Object.entries(backup.manifest.recordCounts).map(([name, count]) => `${count} ${name}`).join(" · ");

  function renderValidationReport(container, validation) {
    container.replaceChildren();
    const errors = validation.errors || [];
    const warnings = validation.warnings || [];
    if (!errors.length && !warnings.length) return;
    const heading = document.createElement("h4");
    heading.textContent = "Backup Checked";
    container.append(heading);
    const addGroup = (title, items, className) => {
      if (!items.length) return;
      const group = document.createElement("section");
      group.className = `backup-validation-group ${className}`;
      const label = document.createElement("h5");
      label.textContent = `${title} · ${items.length}`;
      const summary = document.createElement("p");
      summary.textContent = title === "Blocking Issues" ? "These issues must be resolved before restore." : "These items do not prevent a merge.";
      const details = document.createElement("details");
      const toggle = document.createElement("summary");
      toggle.textContent = "Technical Details";
      const list = document.createElement("ul");
      items.forEach((message) => { const item = document.createElement("li"); item.textContent = message; list.append(item); });
      details.append(toggle, list); group.append(label, summary, details); container.append(group);
    };
    addGroup("Blocking Issues", errors, "has-errors");
    addGroup("Warnings", warnings, "has-warnings");
  }

  async function gather(scope, onProgress, bookOnly = false) {
    const user = global.getCurrentSaltUser?.() || null;
    let result;
    if (!user) result = { data: global.SanctuaryBackup.collectGuest(localStorage), complete: true, failures: [] };
    else result = await global.SanctuaryBackup.collectCloud(global.db, user, { onProgress, getCurrentUser: global.getCurrentSaltUser, onTechnicalError: (table, error) => console.error(`Backup collection failed for ${table}`, error) });
    let data = result.data;
    if (bookOnly) data = user
      ? { grimoire: data.grimoire || {}, rituals: { user_rituals: data.rituals?.user_rituals || [], ritual_links: data.rituals?.ritual_links || [] } }
      : { ritualJournals: data.ritualJournals || [], mundaneMode: data.mundaneMode ?? false };
    onProgress("Preparing uploaded images…");
    const assetResult = await global.SanctuaryBackup.collectAssets(data, { fetch: global.fetch?.bind(global) });
    if (user && global.getCurrentSaltUser?.()?.id !== user.id) throw new Error("The signed-in user changed during export.");
    const warnings = [...assetResult.warnings, ...result.failures.map((failure) => `${failure.table} could not be collected.`)];
    return global.SanctuaryBackup.createBackup(data, { scope: user ? "authenticated-user" : "guest-browser", environment: global.SaltEnvironment?.name, assets: assetResult.assets, warnings, complete: result.complete });
  }

  async function exportBackup(status, bookOnly = false, prefix) {
    try {
      status.textContent = bookOnly ? "Gathering Book of Shadows pages…" : "Gathering your Sanctuary…";
      const backup = await gather(bookOnly ? "book-of-shadows" : "complete", (message) => { status.textContent = message; }, bookOnly);
      if (!backup.manifest.complete) { status.textContent = `The backup is partial and was not downloaded. ${backup.manifest.warnings.join(" ")}`; return null; }
      status.textContent = `Your backup includes: ${countSummary(backup)}. ${backup.manifest.assetCount} embedded assets.`;
      global.SanctuaryBackup.downloadJson(backup, dateName(prefix || (bookOnly ? "salt-and-sovereignty-book-of-shadows" : "salt-and-sovereignty-backup")));
      localStorage.setItem(LAST_EXPORT_KEY, backup.createdAt);
      return backup;
    } catch (error) { console.error("Sanctuary backup failed", error); status.textContent = "Your backup could not be completed. Nothing was changed."; return null; }
  }

  async function readBackupFile(file, status, summary, restoreButton, safetyButton) {
    preview = null; preparedPlan = null; safetyBackupDownloaded = false; restoreButton.disabled = true; safetyButton.disabled = true;
    if (!file) return;
    if (file.size > global.SanctuaryBackup.MAX_FILE_BYTES) { status.textContent = "That backup is larger than the supported 25 MB JSON limit."; return; }
    status.textContent = "Validating backup…";
    const validation = await global.SanctuaryBackup.validateBackup(await file.text());
    renderValidationReport(summary, validation);
    if (!validation.valid) { status.textContent = `${validation.errors.length} blocking issue${validation.errors.length === 1 ? "" : "s"} must be resolved before restore. Nothing was changed.`; return; }
    preview = validation.backup;
    const card = document.createElement("p"); card.className = "backup-summary-card"; card.textContent = `Ready to merge: ${countSummary(preview)}. ${preview.manifest.assetCount} embedded assets. Existing records with matching IDs will be kept.`; summary.prepend(card);
    status.textContent = "Backup validated. Download a safety backup before restoring.";
    safetyButton.disabled = false;
  }

  async function mount(accountPanel, user) {
    if (!accountPanel || accountPanel.querySelector("[data-sanctuary-backup-controls]")) return;
    const section = document.createElement("section"); section.className = "sanctuary-backup-controls"; section.dataset.sanctuaryBackupControls = "";
    section.innerHTML = `
      <h3>Back Up Your Sanctuary</h3>
      <p>${user ? "Download the Sanctuary records owned by this account." : "Guest work lives only in this browser unless you take a backup with you."}</p>
      <div class="my-sanctuary-actions"><button class="button button--primary button--small" type="button" data-backup-complete>${user ? "Download Complete Backup" : "Download Guest Backup"}</button><button class="button button--ghost button--small" type="button" data-backup-book>Export Book of Shadows</button></div>
      <p class="my-sanctuary-soft-note">Backup files may contain names, spiritual writing, ritual records, reflections, and images. Keep them somewhere private. Human-readable exports are not yet included.</p>
      <h3>Restore a Backup</h3>
      <p>Merge adds records that are not already here. Matching IDs keep the current record. Replace is intentionally unavailable because browser restores cannot be fully transactional.</p>
      <label>Choose a Sanctuary JSON backup<input type="file" accept="application/json,.json" data-backup-file></label>
      <div class="backup-validation-report" data-backup-summary></div>
      <div class="my-sanctuary-actions"><button class="button button--ghost button--small" type="button" data-backup-safety disabled>Download Pre-Restore Backup</button><button class="button button--primary button--small" type="button" data-backup-restore disabled>Merge With Existing Sanctuary</button></div>
      <p class="settings-save-status" role="status" aria-live="polite" data-backup-status>Nothing is uploaded until you choose and confirm a valid backup.</p>`;
    if (!user && global.RitualLegacyCleanup) {
      section.insertAdjacentHTML("beforeend", `
        <details class="ritual-test-cleanup" data-ritual-test-cleanup>
          <summary>Remove My Ritual Test Data</summary>
          <p>This removes ritual sessions, completed ritual records, templates, and ritual-only Library links from this guest browser. Altars, Apothecary items, and unrelated pages remain.</p>
          <label>Type ${global.RitualLegacyCleanup.CONFIRMATION}<input type="text" autocomplete="off" data-ritual-cleanup-confirm></label>
          <button class="button button--ghost button--small" type="button" data-ritual-cleanup-run>Remove My Ritual Test Data</button>
          <p role="status" aria-live="polite" data-ritual-cleanup-status></p>
        </details>`);
      const cleanupStatus = section.querySelector("[data-ritual-cleanup-status]");
      section.querySelector("[data-ritual-cleanup-run]").addEventListener("click", () => {
        try {
          const counts = global.RitualLegacyCleanup.clearGuest(localStorage, section.querySelector("[data-ritual-cleanup-confirm]").value);
          cleanupStatus.textContent = `Guest ritual cleanup complete. ${Object.values(counts).reduce((sum, count) => sum + count, 0)} ritual records or caches were removed. Your Altars and Apothecary were preserved.`;
        } catch (error) { cleanupStatus.textContent = error.message; }
      });
    }
    accountPanel.append(section);
    const status = section.querySelector("[data-backup-status]"); const summary = section.querySelector("[data-backup-summary]"); const restore = section.querySelector("[data-backup-restore]"); const safety = section.querySelector("[data-backup-safety]");
    section.querySelector("[data-backup-complete]").addEventListener("click", () => exportBackup(status));
    section.querySelector("[data-backup-book]").addEventListener("click", () => exportBackup(status, true));
    section.querySelector("[data-backup-file]").addEventListener("change", (event) => readBackupFile(event.target.files?.[0], status, summary, restore, safety).catch((error) => { console.error("Backup validation failed", error); status.textContent = "That backup could not be validated."; }));
    safety.addEventListener("click", async () => {
      const backup = await exportBackup(status, false, "salt-and-sovereignty-before-restore");
      if (!backup) return;
      try {
        const currentUser = global.getCurrentSaltUser?.() || null;
        preparedPlan = currentUser
          ? await global.SanctuaryBackup.buildCloudMergePlan(preview, global.db, currentUser.id)
          : global.SanctuaryBackup.buildGuestMergePlan(preview, localStorage);
        safetyBackupDownloaded = true; restore.disabled = false;
        summary.textContent = `${summary.textContent} ${preparedPlan.conflicts.length} matching IDs will keep the current record; ${preparedPlan.operations.reduce((sum, operation) => sum + (operation.rows?.length ?? 1), 0)} staged operations are ready.`;
        status.textContent = "Safety backup downloaded and merge plan prepared. Review the conflicts, then restore when ready.";
      } catch (error) { console.error("Restore planning failed", error); status.textContent = "The safety backup downloaded, but a safe merge plan could not be prepared. Nothing was changed."; }
    });
    restore.addEventListener("click", async () => {
      if (!preview || !preparedPlan || !safetyBackupDownloaded) return;
      restore.disabled = true; status.textContent = "Building a safe merge plan…";
      try {
        const restoreUser = global.getCurrentSaltUser?.() || null;
        if (!restoreUser) {
          const result = global.SanctuaryBackup.applyGuestMergePlan(preparedPlan, localStorage);
          status.textContent = `Restore complete. ${result.completedStages.length} sections merged; ${result.conflicts.length} matching records were kept.`;
        } else {
          if (preparedPlan.userId !== restoreUser.id) throw new Error("The signed-in user changed after restore planning.");
          const checkpointKey = `saltAndSovereigntyRestore:${preview.integrity.digest}:${restoreUser.id}`;
          let completedStages = []; try { completedStages = JSON.parse(localStorage.getItem(checkpointKey)) || []; } catch {}
          const result = await global.SanctuaryBackup.applyCloudMergePlan(preparedPlan, global.db, { completedStages, onProgress: (message) => { status.textContent = message; }, onStageComplete: (_table, stages) => localStorage.setItem(checkpointKey, JSON.stringify(stages)) });
          if (result.error) status.textContent = `${result.error} Retry this same backup to resume after ${result.completedStages.length} completed stages.`;
          else { localStorage.removeItem(checkpointKey); status.textContent = `Restore complete. ${result.completedStages.length} stages merged; ${result.conflicts.length} matching records were kept.`; }
        }
      } catch (error) { console.error("Sanctuary restore failed", error); status.textContent = "Restore stopped safely. Existing work was not deleted; you can try again."; }
      finally { restore.disabled = false; }
    });
  }

  global.SanctuaryBackupUI = { mount, gather, exportBackup, readBackupFile };
})(typeof window !== "undefined" ? window : globalThis);
