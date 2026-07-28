#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const failures = [];

function trackedFiles(pattern) {
  const output = execFileSync("git", ["ls-files", pattern], { cwd: root, encoding: "utf8" });
  return output.split("\n").filter(Boolean);
}

function localPath(pagePath, reference) {
  const clean = String(reference || "").split(/[?#]/, 1)[0].trim();
  if (!clean || /^(?:[a-z]+:|#|\/\/)/i.test(clean) || /[{}]/.test(clean)) return null;
  if (clean.startsWith("/sandspod/")) return path.join(root, clean.slice("/sandspod/".length));
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

console.log(`Validated ${loadedScripts.size} loaded scripts, local HTML references, and ${trackedFiles("*.json").length} JSON files.`);
