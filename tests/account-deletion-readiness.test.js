const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

global.window = global;
global.addEventListener = () => {};
global.dispatchEvent = () => {};
global.document = { addEventListener() {} };
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
const Account = require("../js/account-data.js");

test("deletion backup gate binds user, backup, source snapshot, and twenty-minute expiry", () => {
  const now = Date.parse("2026-07-30T12:00:00Z");
  const gate = Account.createDeletionBackupGate({ id: "user-a" }, { integrity: { digest: "backup-digest" } }, "snapshot-a", now);
  assert.equal(Account.validateDeletionBackupGate(gate, { id: "user-a" }, "snapshot-a", now + 19 * 60 * 1000), true);
  assert.equal(Account.validateDeletionBackupGate(gate, { id: "user-b" }, "snapshot-a", now), false);
  assert.equal(Account.validateDeletionBackupGate(gate, { id: "user-a" }, "snapshot-b", now), false);
  assert.equal(Account.validateDeletionBackupGate(gate, { id: "user-a" }, "snapshot-a", now + 21 * 60 * 1000), false);
});

test("frontend capability cannot be enabled by URL or browser storage", () => {
  const source = fs.readFileSync("js/account-data.js", "utf8");
  assert.deepEqual(Account.DELETE_CAPABILITY, { functionAvailable: false, inventoryVerified: false, storageVerified: false, communityPolicyVerified: false, recentAuthVerified: false, disposableAccountTestPassed: false, productionEnabled: false, executeEnabled: false });
  assert.doesNotMatch(source, /URLSearchParams|location\.search/);
  assert.doesNotMatch(source, /localStorage.*(?:productionEnabled|executeEnabled)/s);
});

test("Edge Function preview is authenticated, count-only, origin-restricted, and execute fails closed", () => {
  const edge = fs.readFileSync("supabase/functions/delete-account/index.ts", "utf8");
  assert.match(edge, /allowedOrigins\.has\(origin\)/);
  assert.match(edge, /authorization\.startsWith\("Bearer "\)/);
  assert.match(edge, /auth\.getUser\(\)/);
  assert.match(edge, /select\("\*", \{ count: "exact", head: true \}\)/);
  assert.match(edge, /storage\.from\(bucket\)\.list\(userId/);
  assert.match(edge, /writeFree: true/);
  assert.match(edge, /account_deletion_not_verified/);
  assert.doesNotMatch(edge, /deleteUser\(/);
});
