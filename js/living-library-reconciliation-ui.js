(function initializeLivingLibraryReconciliationUI(global) {
  "use strict";
  const safe = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

  function mount(panel, user) {
    if (!panel || !user?.id || panel.querySelector("[data-library-health]")) return;
    const section = document.createElement("section");
    section.className = "library-health-card";
    section.dataset.libraryHealth = "";
    section.innerHTML = `
      <p class="eyebrow">Living Library Health</p>
      <h3>Review historical duplicate candidates</h3>
      <p>Earlier syncs may have created the same source-backed record more than once. Matching names alone are always kept separate.</p>
      <button class="button button--ghost button--small" type="button" data-scan-library-health>Scan for Duplicate Records</button>
      <p role="status" aria-live="polite" data-library-health-status>No scan has run. Scanning is write-free.</p>
      <div data-library-health-results hidden></div>`;
    panel.insertBefore(section, panel.querySelector("[data-sanctuary-backup-controls]") || null);

    const status = section.querySelector("[data-library-health-status]");
    const results = section.querySelector("[data-library-health-results]");
    section.querySelector("[data-scan-library-health]").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (button.disabled) return;
      button.disabled = true;
      status.textContent = "Scanning Living Library records…";
      try {
        const currentUser = global.getCurrentSaltUser?.();
        if (currentUser?.id !== user.id) throw new Error("The signed-in account changed. Scan cancelled.");
        const audit = await global.LivingLibraryReconciliation.scan(global.db, currentUser);
        const safeGroups = audit.groups.filter((group) => group.classification !== "manual-review-required");
        const review = audit.groups.filter((group) => group.classification === "manual-review-required");
        results.hidden = false;
        results.innerHTML = `
          <div class="library-health-counts"><span><strong>${safeGroups.length}</strong> safe candidate group${safeGroups.length === 1 ? "" : "s"}</span><span><strong>${review.length}</strong> need${review.length === 1 ? "s" : ""} review</span><span><strong>${audit.possible.length}</strong> similar-name group${audit.possible.length === 1 ? "" : "s"} kept separate</span><span><strong>${audit.relationshipDuplicates.length}</strong> relationship duplicate group${audit.relationshipDuplicates.length === 1 ? "" : "s"}</span></div>
          <details><summary>Evidence and technical details</summary><ul>${audit.groups.map((group) => `<li><strong>${safe(group.classification.replaceAll("-", " "))}</strong>: ${group.evidence.map(safe).join("; ")}<br><code>${safe(group.key)}</code></li>`).join("") || "<li>No strong-identity duplicate groups found.</li>"}</ul></details>
          <p><strong>Preview only:</strong> no records were changed. Applying reconciliation remains unavailable until the server-side procedure, fresh backup gate, and disposable-account verification are complete.</p>
          <button class="button button--ghost button--small" type="button" disabled>Reconcile Selected Records — Development Verification Required</button>`;
        status.textContent = `Scan complete. ${audit.groups.length} strong-evidence group${audit.groups.length === 1 ? "" : "s"} reviewed without writes.`;
      } catch (error) {
        console.warn("Living Library health scan failed.", { code: "scan_failed" });
        status.textContent = /^The signed-in account changed/.test(error.message || "") ? error.message : "The Living Library scan could not be completed safely. Nothing was changed.";
      } finally { button.disabled = false; }
    });
  }

  global.LivingLibraryReconciliationUI = { mount };
  if (typeof module !== "undefined" && module.exports) module.exports = global.LivingLibraryReconciliationUI;
})(typeof window !== "undefined" ? window : globalThis);
