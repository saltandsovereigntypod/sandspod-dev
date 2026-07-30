const test = require("node:test");
const assert = require("node:assert/strict");
const { createEnvironment } = require("../js/environment.js");

function environment(url) {
  return createEnvironment(new URL(url));
}

test("production apex and www select the production project and root", () => {
  for (const host of ["saltandsovereignty.com", "www.saltandsovereignty.com"]) {
    const value = environment(`https://${host}/altar/`);
    assert.equal(value.name, "production");
    assert.equal(value.supabaseProjectRef, "outksqvhusvvtjgiveoh");
    assert.equal(value.basePath, "/");
    assert.equal(value.oauthReturnUrl("/"), `https://${host}/`);
  }
});

test("development custom domain selects development project and moderator", () => {
  const value = environment("https://dev.saltandsovereignty.com/");
  assert.equal(value.supabaseProjectRef, "aiiqyesczxrrujznwoke");
  assert.deepEqual(value.moderatorIds, ["a0bd79fd-ad6d-472a-b38b-69526651e76b"]);
  assert.equal(value.oauthReturnUrl("/"), "https://dev.saltandsovereignty.com/");
});

test("GitHub Pages preserves the development repository prefix", () => {
  const value = environment("https://saltandsovereigntypod.github.io/sandspod-dev/altar/");
  assert.equal(value.basePath, "/sandspod-dev/");
  assert.equal(value.resolvePath("/grimoire/?page=1"), "/sandspod-dev/grimoire/?page=1");
  assert.equal(value.oauthReturnUrl("/"), "https://saltandsovereigntypod.github.io/sandspod-dev/");
});

test("localhost and loopback select development with their current origin", () => {
  for (const host of ["localhost", "127.0.0.1"]) {
    const value = environment(`http://${host}:5500/`);
    assert.equal(value.isLocal, true);
    assert.equal(value.supabaseProjectRef, "aiiqyesczxrrujznwoke");
    assert.equal(value.oauthReturnUrl("/"), `http://${host}:5500/`);
  }
});

test("unknown public hosts fail closed without project configuration", () => {
  const value = environment("https://preview.example.com/");
  assert.equal(value.isRecognized, false);
  assert.equal(value.supabaseProjectRef, null);
  assert.throws(() => value.getSupabaseConfig(), /not configured/);
  assert.throws(() => value.oauthReturnUrl("/"), /disabled/);
});

test("moderator identities remain project-scoped", () => {
  const production = environment("https://saltandsovereignty.com/");
  const development = environment("https://dev.saltandsovereignty.com/");
  assert.deepEqual(production.moderatorIds, ["ddc5463e-1551-498b-b5af-79ce52ac591c", "5c63e3ac-920c-4980-9aa7-f6f322a67a2e"]);
  assert.equal(development.moderatorIds.some((id) => production.moderatorIds.includes(id)), false);
});
