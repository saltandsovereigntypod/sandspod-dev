(function initializeAccountData(global) {
  "use strict";

  const MIN_PASSWORD_LENGTH = 8;
  const GUEST_CLEAR_CONFIRMATION = "CLEAR MY GUEST DATA";
  const DELETE_CONFIRMATION = "DELETE MY SALT AND SOVEREIGNTY ACCOUNT";
  const PENDING_GUEST_SNAPSHOT_KEY = "saltAndSovereigntyPendingGuestMigrationSnapshot";
  const GUEST_MIGRATION_KEYS = Object.freeze({ settings: "saltAndSovereigntyUserSettings", altars: "saltAndSovereigntySavedAltars", altarDraft: "saltAndSovereigntyWorkingAltarDraft", livingLibrary: "saltAndSovereigntyLibrary", livingLibraryLayouts: "saltAndSovereigntyLibraryPageLayouts", apothecary: "saltAndSovereigntyApothecaryItems", ritualJournals: "saltAndSovereigntyUserRituals", ritualLifecycle: "saltAndSovereigntyRitualLifecycle:guest", customCabinet: "saltAndSovereigntyCustomCabinetItems", mundaneMode: "saltAndSovereigntyMundaneMode" });
  const GUEST_KEYS = Object.freeze([
    "saltAndSovereigntyUserSettings",
    "saltAndSovereigntySavedAltars",
    "saltAndSovereigntyWorkingAltarDraft",
    "saltAndSovereigntyLibrary",
    "saltAndSovereigntyLibraryPageLayouts",
    "saltAndSovereigntyApothecaryItems",
    "saltAndSovereigntyUserRituals",
    "saltAndSovereigntyRitualLifecycle:guest",
    "saltAndSovereigntyActiveRitualSession",
    "saltAndSovereigntyCustomCabinetItems",
    "saltAndSovereigntyMundaneMode",
    "saltAndSovereigntyAltarToGrimoire",
    "saltAndSovereigntyApothecaryToGrimoire",
    PENDING_GUEST_SNAPSHOT_KEY
  ]);

  function authMessage(error, context = "account") {
    const value = String(error?.message || error || "").toLowerCase();
    if (/invalid login|invalid credential/.test(value)) return "That email and password did not match.";
    if (/email not confirmed/.test(value)) return "Please confirm your email before signing in.";
    if (/expired|otp_expired/.test(value)) return "This recovery link has expired. Please request a new one.";
    if (/invalid.*(?:token|link)|otp_disabled/.test(value)) return "This recovery link is invalid or has already been used.";
    if (/password.*(?:short|least)|weak password/.test(value)) return `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
    if (/same password|different from the old/.test(value)) return "Choose a password you have not used for this account.";
    if (/already.*(?:registered|exists)|email.*use/.test(value)) return "That email is already connected to an account.";
    if (/rate|too many|over_email_send_rate_limit/.test(value)) return "Please wait a little while before trying again.";
    if (/session|jwt|signed out|not authenticated/.test(value)) return "Your session has ended. Please sign in again.";
    if (/network|fetch|offline/.test(value)) return "The cloud could not be reached. Check your connection and try again.";
    return context === "recovery" ? "The recovery request could not be completed. Please try again." : "That account change could not be completed. Please try again.";
  }

  function providerSummary(user) {
    const providers = new Set((user?.identities || []).map((identity) => identity.provider).filter(Boolean));
    const primary = user?.app_metadata?.provider;
    if (primary) providers.add(primary);
    const labels = [];
    if (providers.has("email")) labels.push("Email and password");
    if (providers.has("google")) labels.push("Google");
    return labels.length ? labels.join(" and ") : "Account sign-in";
  }

  function hasPasswordIdentity(user) {
    const providers = new Set((user?.identities || []).map((identity) => identity.provider));
    if (!providers.size && user?.app_metadata?.provider === "email") return true;
    return providers.has("email");
  }

  function recoveryRedirect() {
    return global.SaltEnvironment.oauthReturnUrl("/account/reset-password/");
  }

  function validatePasswordPair(password, confirmation) {
    if (String(password || "").length < MIN_PASSWORD_LENGTH) return { valid: false, message: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.` };
    if (password !== confirmation) return { valid: false, message: "The two passwords do not match." };
    return { valid: true, message: "" };
  }

  function validateEmailChange(currentEmail, email, confirmation) {
    const next = String(email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(next)) return { valid: false, message: "Enter a complete email address." };
    if (next !== String(confirmation || "").trim().toLowerCase()) return { valid: false, message: "The two email addresses do not match." };
    if (next === String(currentEmail || "").trim().toLowerCase()) return { valid: false, message: "That is already the email for this account." };
    return { valid: true, email: next, message: "" };
  }

  async function requestRecovery(email) {
    const address = String(email || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) throw new Error("Enter a complete email address.");
    const { error } = await global.db.auth.resetPasswordForEmail(address, { redirectTo: recoveryRedirect() });
    if (error) { console.warn("Password recovery request failed.", { code: error.code || "auth_error" }); throw new Error(authMessage(error, "recovery")); }
    return "If an account exists for that email, a recovery link has been sent.";
  }

  async function updatePassword(password, confirmation) {
    const validation = validatePasswordPair(password, confirmation);
    if (!validation.valid) throw new Error(validation.message);
    const { data, error } = await global.db.auth.updateUser({ password });
    if (error) { console.warn("Password update failed.", { code: error.code || "auth_error" }); throw new Error(authMessage(error)); }
    return data.user;
  }

  async function requestEmailChange(user, email, confirmation) {
    const validation = validateEmailChange(user?.email, email, confirmation);
    if (!validation.valid) throw new Error(validation.message);
    const { data, error } = await global.db.auth.updateUser({ email: validation.email }, { emailRedirectTo: global.SaltEnvironment.oauthReturnUrl("/") });
    if (error) { console.warn("Email update request failed.", { code: error.code || "auth_error" }); throw new Error(authMessage(error)); }
    return data.user;
  }

  function clearGuestData(storage, confirmation, backupCompleted) {
    if (!backupCompleted) throw new Error("Download a fresh guest backup before clearing this browser.");
    if (confirmation !== GUEST_CLEAR_CONFIRMATION) throw new Error("The confirmation phrase did not match.");
    const removed = [];
    GUEST_KEYS.forEach((key) => { if (storage.getItem(key) !== null) removed.push(key); storage.removeItem(key); });
    return { removed, count: removed.length };
  }

  function preserveGuestSnapshotBeforeAuth(storage) {
    const existing = storage.getItem(PENDING_GUEST_SNAPSHOT_KEY);
    if (existing) { try { return JSON.parse(existing); } catch {} }
    if (storage.getItem("saltAndSovereigntyGuestScope") !== "true" && storage.getItem("saltAndSovereigntySanctuaryChoice") !== "true") return null;
    const data = {};
    for (const [section, key] of Object.entries(GUEST_MIGRATION_KEYS)) {
      const raw = storage.getItem(key); if (raw == null) continue;
      try { data[section] = JSON.parse(raw); } catch { data[section] = raw; }
    }
    if (!Object.keys(data).length) return null;
    storage.setItem(PENDING_GUEST_SNAPSHOT_KEY, JSON.stringify(data));
    return data;
  }
  function markGuestDataChanged(storage) {
    if (global.getCurrentSaltUser?.()) return;
    storage.removeItem(PENDING_GUEST_SNAPSHOT_KEY);
    global.dispatchEvent?.(new CustomEvent("saltGuestDataChanged"));
  }

  const SyncStatus = (() => {
    let state = { userId: null, status: "guest", lastSuccess: null };
    const key = (userId) => `saltAndSovereigntyLastCloudSync:${userId}`;
    function publish() { global.dispatchEvent?.(new CustomEvent("saltSyncStatusChanged", { detail: { ...state } })); return { ...state }; }
    function setUser(user) {
      state = user ? { userId: user.id, status: global.navigator?.onLine === false ? "offline" : "connected", lastSuccess: global.localStorage?.getItem(key(user.id)) || null } : { userId: null, status: "guest", lastSuccess: null };
      return publish();
    }
    function saving(userId) { if (userId && state.userId === userId) { state.status = "saving"; publish(); } }
    function success(userId, timestamp = new Date().toISOString()) { if (!userId || state.userId !== userId) return; state.status = "saved"; state.lastSuccess = timestamp; global.localStorage?.setItem(key(userId), timestamp); publish(); }
    function failure(userId) { if (userId && state.userId === userId) { state.status = global.navigator?.onLine === false ? "offline" : "unavailable"; publish(); } }
    function get() { return { ...state }; }
    global.addEventListener?.("online", () => { if (state.userId) { state.status = "connected"; publish(); } });
    global.addEventListener?.("offline", () => { if (state.userId) { state.status = "offline"; publish(); } });
    return { setUser, saving, success, failure, get };
  })();

  global.addEventListener?.("saltSettingsSaveState", (event) => {
    const userId = global.getCurrentSaltUser?.()?.id;
    if (!userId) return;
    if (event.detail?.ok) SyncStatus.success(userId);
    else SyncStatus.failure(userId);
  });
  global.document?.addEventListener("saltAuthChanged", (event) => SyncStatus.setUser(event.detail?.user || null));
  global.document?.addEventListener("saltAuthSignedOut", () => SyncStatus.setUser(null));

  global.SaltAccountData = { MIN_PASSWORD_LENGTH, GUEST_CLEAR_CONFIRMATION, DELETE_CONFIRMATION, PENDING_GUEST_SNAPSHOT_KEY, GUEST_MIGRATION_KEYS, GUEST_KEYS, authMessage, providerSummary, hasPasswordIdentity, recoveryRedirect, validatePasswordPair, validateEmailChange, requestRecovery, updatePassword, requestEmailChange, clearGuestData, preserveGuestSnapshotBeforeAuth, markGuestDataChanged, SyncStatus };
  global.SaltSyncStatus = SyncStatus;
  if (typeof module !== "undefined" && module.exports) module.exports = global.SaltAccountData;
})(typeof window !== "undefined" ? window : globalThis);
