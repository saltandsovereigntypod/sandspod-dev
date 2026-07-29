#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const failures = [];
const mode = (process.argv.find((argument) => argument.startsWith("--environment=")) || "").split("=")[1];
if (!new Set(["development", "production"]).has(mode)) {
  console.error("Use --environment=development or --environment=production.");
  process.exit(2);
}

function trackedFiles(pattern) {
  const output = execFileSync("git", pattern ? ["ls-files", pattern] : ["ls-files"], { cwd: root, encoding: "utf8" });
  return output.split("\n").filter(Boolean);
}

function localPath(pagePath, reference) {
  const clean = String(reference || "").split(/[?#]/, 1)[0].trim();
  if (!clean || /^(?:[a-z]+:|#|\/\/)/i.test(clean) || /[{}]/.test(clean)) return null;
  if (clean.startsWith("/sandspod-dev/")) return path.join(root, clean.slice("/sandspod-dev/".length));
  if (clean.startsWith("/")) return path.join(root, clean.slice(1));
  return path.resolve(root, path.dirname(pagePath), clean);
}

const loadedScripts = new Set();
for (const page of trackedFiles("*.html")) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const references = [];
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const styles = [...html.matchAll(/<link\b[^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const links = [...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const media = [...html.matchAll(/<(?:img|source)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  references.push(...scripts, ...links, ...media);

  for (const [kind, values] of [["script", scripts], ["stylesheet", styles]]) {
    const seen = new Set();
    for (const value of values) {
      const resolved = localPath(page, value);
      if (!resolved) continue;
      const key = path.normalize(resolved);
      if (seen.has(key)) failures.push(`${page}: duplicate local ${kind} reference: ${value}`);
      seen.add(key);
    }
  }

  for (const reference of references) {
    const resolved = localPath(page, reference);
    if (!resolved) continue;
    if (!fs.existsSync(resolved)) failures.push(`${page}: missing local reference: ${reference}`);
  }

  for (const reference of scripts) {
    const resolved = localPath(page, reference);
    if (resolved && fs.existsSync(resolved) && resolved.endsWith(".js")) loadedScripts.add(resolved);
  }
}

for (const script of [...loadedScripts].sort()) {
  try {
    execFileSync(process.execPath, ["--check", script], { cwd: root, stdio: "pipe" });
  } catch (error) {
    failures.push(`${path.relative(root, script)}: JavaScript syntax check failed\n${error.stderr || error.message}`);
  }
}

for (const jsonFile of trackedFiles("*.json")) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, jsonFile), "utf8"));
  } catch (error) {
    failures.push(`${jsonFile}: invalid JSON (${error.message})`);
  }
}

const runtimeFiles = trackedFiles().filter((file) => /^(?:js|altar|grimoire|admin|submit)\//.test(file) || file === "index.html" || file === "script.js");
const runtimeSource = runtimeFiles.map((file) => `${file}\n${fs.readFileSync(path.join(root, file), "utf8")}`).join("\n");
for (const pattern of [/\bservice_role\b/i, /\bsb_secret_[A-Za-z0-9_-]+/, /\/sandspod\//]) {
  if (pattern.test(runtimeSource)) failures.push(`runtime source contains forbidden pattern ${pattern}`);
}
if (!runtimeSource.includes('start_url": "./"') || !runtimeSource.includes('scope": "./"')) failures.push("manifest must use deployment-relative start_url and scope");
for (const asset of ["assets/icons/icon-192.png", "assets/icons/icon-512.png"]) {
  if (!fs.existsSync(path.join(root, asset))) failures.push(`missing PWA asset: ${asset}`);
}

const { createEnvironment } = require(path.join(root, "js/environment.js"));
if (mode === "production") {
  for (const hostname of ["saltandsovereignty.com", "www.saltandsovereignty.com"]) {
    const deployment = createEnvironment(new URL(`https://${hostname}/`));
    if (deployment.supabaseProjectRef !== "outksqvhusvvtjgiveoh") failures.push(`${hostname} does not select the production project`);
    if (deployment.basePath !== "/" || deployment.oauthReturnUrl("/") !== `https://${hostname}/`) failures.push(`${hostname} has invalid production paths`);
  }
} else {
  const custom = createEnvironment(new URL("https://dev.saltandsovereignty.com/"));
  const pages = createEnvironment(new URL("https://saltandsovereigntypod.github.io/sandspod-dev/"));
  if (custom.supabaseProjectRef !== "aiiqyesczxrrujznwoke" || pages.supabaseProjectRef !== "aiiqyesczxrrujznwoke") failures.push("development hosts do not select the development project");
  if (custom.basePath !== "/" || pages.basePath !== "/sandspod-dev/" || pages.oauthReturnUrl("/") !== "https://saltandsovereigntypod.github.io/sandspod-dev/") failures.push("development deployment paths are invalid");
}

try {
  execFileSync("git", ["diff", "--check"], { cwd: root, stdio: "pipe" });
} catch (error) {
  failures.push(`git diff --check failed\n${error.stdout || error.message}`);
}

if (failures.length) {
  console.error(`Static validation failed with ${failures.length} issue(s):\n`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Validated ${mode} deployment: ${loadedScripts.size} loaded scripts, local HTML references, and ${trackedFiles("*.json").length} JSON files.`);
