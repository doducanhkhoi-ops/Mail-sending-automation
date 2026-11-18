import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const repoRoot = path.resolve(import.meta.dirname, "..");

function loadGasContext(files) {
  const context = {
    Utilities: {
      sleep: () => {},
      formatDate: (date) => {
        const d = date instanceof Date ? date : new Date(date);
        const pad = (n) => String(n).padStart(2, "0");
        return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
      },
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => null,
      flush: () => {},
    },
  };
  vm.createContext(context);
  for (const file of files) {
    const code = fs.readFileSync(path.join(repoRoot, file), "utf8");
    vm.runInContext(code, context, { filename: file });
  }
  return context;
}

test("all .gs files compile cleanly and appsscript.json is valid JSON", () => {
  const gsFiles = fs.readdirSync(repoRoot).filter((f) => f.endsWith(".gs"));
  assert.ok(gsFiles.length >= 8, "expected all core .gs modules");

  for (const file of gsFiles) {
    const code = fs.readFileSync(path.join(repoRoot, file), "utf8");
    assert.doesNotThrow(() => new vm.Script(code, { filename: file }), `syntax error in ${file}`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "appsscript.json"), "utf8"));
  assert.ok(manifest.timeZone);
});

test("isValidEmail validates standard and mailto addresses", () => {
  const ctx = loadGasContext(["Utils.gs"]);
  assert.equal(ctx.isValidEmail("user@example.com"), true);
  assert.equal(ctx.isValidEmail("mailto:user@example.com"), true);
  assert.equal(ctx.isValidEmail("invalid-email"), false);
  assert.equal(ctx.isValidEmail(""), false);
  assert.equal(ctx.isValidEmail(null), false);
});

test("replaceTemplateVars substitutes placeholders and escapes regex chars", () => {
  const ctx = loadGasContext(["Utils.gs"]);
  const out = ctx.replaceTemplateVars("Xin chào {{Tên}}, công ty {{Công ty (VN)}}!", {
    "Tên": "An",
    "Công ty (VN)": "FTU",
  });
  assert.equal(out, "Xin chào An, công ty FTU!");
  assert.equal(ctx.replaceTemplateVars("", { a: "1" }), "");
});

test("normalizeTimeString normalizes Sheets time strings and objects", () => {
  const ctx = loadGasContext(["Utils.gs"]);
  assert.equal(ctx.normalizeTimeString("Sat Dec 30 1899 09:05:00 GMT+0700"), "09:05");
  assert.equal(ctx.normalizeTimeString("7:30"), "07:30");
  assert.equal(ctx.normalizeTimeString(""), "");
});

test("Config.gs defines expected sheet names and defaults", () => {
  const ctx = loadGasContext(["Utils.gs", "Config.gs"]);
  assert.equal(ctx.SHEET_CONFIG, "Cấu hình");
  assert.equal(ctx.SHEET_DATA, "Danh sách");
  assert.equal(ctx.CONFIG_DEFAULTS["Batch size"], "50");
});
