const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createEnvironment } = require("../js/environment.js");
if (!global.CustomEvent) global.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };
if (!global.dispatchEvent) global.dispatchEvent = () => true;
if (!global.addEventListener) global.addEventListener = () => {};
const Account = require("../js/account-data.js");

function location(hostname, pathname = "/", protocol = "https:", port = "") {
  const host = port ? `${hostname}:${port}` : hostname;
  return { hostname, pathname, protocol, host, origin: `${protocol}//${host}` };
}

test("recovery routes remain environment-aware and unknown hosts fail closed", () => {
  const cases = [
    [location("saltandsovereignty.com"), "https://saltandsovereignty.com/account/reset-password/"],
    [location("dev.saltandsovereignty.com"), "https://dev.saltandsovereignty.com/account/reset-password/"],
    [location("saltandsovereigntypod.github.io", "/sandspod-dev/"), "https://saltandsovereigntypod.github.io/sandspod-dev/account/reset-password/"],
    [location("localhost", "/", "http:", "5500"), "http://localhost:5500/account/reset-password/"]
  ];
  cases.forEach(([value, expected]) => assert.equal(createEnvironment(value).oauthReturnUrl("/account/reset-password/"), expected));
  assert.throws(() => createEnvironment(location("unknown.example")).oauthReturnUrl("/account/reset-password/"));
});

test("recovery is neutral and never exposes raw provider errors", async () => {
  global.SaltEnvironment = { oauthReturnUrl: () => "https://example.test/account/reset-password/" };
  let options;
  global.db = { auth: { resetPasswordForEmail: async (_email, supplied) => { options = supplied; return { error: null }; } } };
  assert.equal(await Account.requestRecovery("person@example.test"), "If an account exists for that email, a recovery link has been sent.");
  assert.equal(options.redirectTo, "https://example.test/account/reset-password/");
  global.db.auth.resetPasswordForEmail = async () => ({ error: { message: "AuthApiError database internals", code: "unexpected" } });
  await assert.rejects(Account.requestRecovery("person@example.test"), /recovery request could not be completed/i);
});

test("password and email validation block unsafe updates", () => {
  assert.equal(Account.validatePasswordPair("short", "short").valid, false);
  assert.equal(Account.validatePasswordPair("long-enough", "different").valid, false);
  assert.equal(Account.validatePasswordPair("long-enough", "long-enough").valid, true);
  assert.equal(Account.validateEmailChange("old@example.test", "bad", "bad").valid, false);
  assert.equal(Account.validateEmailChange("old@example.test", "old@example.test", "old@example.test").valid, false);
  assert.equal(Account.validateEmailChange("old@example.test", "new@example.test", "new@example.test").valid, true);
});

test("provider summaries distinguish password and Google identities", () => {
  assert.equal(Account.providerSummary({ identities: [{ provider: "email" }] }), "Email and password");
  assert.equal(Account.providerSummary({ identities: [{ provider: "google" }] }), "Google");
  assert.equal(Account.providerSummary({ identities: [{ provider: "email" }, { provider: "google" }] }), "Email and password and Google");
  assert.equal(Account.hasPasswordIdentity({ identities: [{ provider: "google" }] }), false);
});

test("guest clearing requires backup and confirmation and touches only allow-listed keys", () => {
  const values = new Map([[Account.GUEST_KEYS[0], "guest"], ["unrelatedPreference", "keep"], ["sb-session", "auth-cache"]]);
  const storage = { getItem: (key) => values.get(key) ?? null, removeItem: (key) => values.delete(key) };
  assert.throws(() => Account.clearGuestData(storage, Account.GUEST_CLEAR_CONFIRMATION, false), /backup/i);
  assert.throws(() => Account.clearGuestData(storage, "wrong", true), /phrase/i);
  const result = Account.clearGuestData(storage, Account.GUEST_CLEAR_CONFIRMATION, true);
  assert.equal(result.count, 1);
  assert.equal(values.get("unrelatedPreference"), "keep");
  assert.equal(values.get("sb-session"), "auth-cache");
});

test("sync timestamps are user-scoped and failures do not advance them", () => {
  const values = new Map();
  global.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  Account.SyncStatus.setUser({ id: "user-a" });
  Account.SyncStatus.success("user-a", "2026-07-29T16:03:00.000Z");
  assert.equal(Account.SyncStatus.get().lastSuccess, "2026-07-29T16:03:00.000Z");
  Account.SyncStatus.failure("user-a");
  assert.equal(Account.SyncStatus.get().lastSuccess, "2026-07-29T16:03:00.000Z");
  Account.SyncStatus.setUser({ id: "user-b" });
  assert.equal(Account.SyncStatus.get().lastSuccess, null);
  Account.SyncStatus.success("user-a", "2027-01-01T00:00:00.000Z");
  assert.equal(Account.SyncStatus.get().lastSuccess, null);
  Account.SyncStatus.setUser(null);
  assert.equal(Account.SyncStatus.get().status, "guest");
});

test("reset page and account UI preserve accessible security controls", () => {
  const page = fs.readFileSync("account/reset-password/index.html", "utf8");
  const reset = fs.readFileSync("js/reset-password.js", "utf8");
  const ui = fs.readFileSync("js/account-data-ui.js", "utf8");
  assert.ok(page.indexOf("environment.js") < page.indexOf("supabase-config.js"));
  assert.match(page, /autocomplete="new-password"/);
  assert.match(page, /aria-live="polite"/);
  assert.match(reset, /PASSWORD_RECOVERY/);
  assert.match(ui, /This account currently uses Google sign-in/);
  assert.match(ui, /Delete Account — Development Verification Required/);
  assert.match(ui, /data-prepare-guest-clear/);
});

test("account deletion remains server-side, current-user scoped, and fail-closed", () => {
  const frontend = ["js/account-data.js", "js/account-data-ui.js", "js/auth.js"].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const edge = fs.readFileSync("supabase/functions/delete-account/index.ts", "utf8");
  assert.doesNotMatch(frontend, /SUPABASE_SERVICE_ROLE_KEY|service_role/);
  assert.match(edge, /auth\.getUser\(\)/);
  assert.match(edge, /const userId = authData\.user\.id/);
  assert.match(edge, /\.eq\("user_id", userId\)/);
  assert.match(edge, /recentAuthVerified: false/);
  assert.match(edge, /productionEnabled: false/);
  assert.match(edge, /account_deletion_not_verified/);
  assert.doesNotMatch(edge, /body\.userId|body\.user_id/);
});
