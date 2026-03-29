#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatLocalDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatLocalTimestamp(d) {
  // YYYY-MM-DD HH:MM:SS ±HH:MM
  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? "+" : "-";
  const abs = Math.abs(tzMin);
  const tzh = pad2(Math.floor(abs / 60));
  const tzm = pad2(abs % 60);
  return `${formatLocalDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(
    d.getSeconds(),
  )} ${sign}${tzh}:${tzm}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function appendFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, content, "utf8");
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    if (key === "interactive" || key === "git" || key === "help") {
      out[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      out[key] = "";
      continue;
    }
    out[key] = value;
    i++;
  }
  return out;
}

function usage(exitCode = 0) {
  const txt = `
Usage:
  node scripts/log.mjs <daily|dev|error> [--interactive] [--git]
  node scripts/log.mjs dev --title "..." --note "..."

Options:
  --interactive   Prompt for fields in the terminal
  --git           Include git status + diff stat (best-effort)
  --title         Entry title (dev/error)
  --note          Quick note (dev)
  --steps         Steps (daily/error)
  --logic         Methods/Logic (daily)
  --changes       Code changes (daily)
  --issues        Issues/Errors (daily)
  --validation    Validation (daily)
  --repro         Repro steps (error)
  --expected      Expected result (error)
  --actual        Actual result (error)
  --stack         Stack trace / console output (error)
`;
  // eslint-disable-next-line no-console
  console.log(txt.trim());
  process.exit(exitCode);
}

function startRl() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, q) {
  return new Promise((resolve) => rl.question(q, (ans) => resolve(ans)));
}

async function askMultiline(rl, label) {
  // Collect lines until a single "." or blank line.
  // Use "." to allow intentionally empty fields with follow-up.
  // eslint-disable-next-line no-console
  console.log(`${label} (end with blank line, or a single "." line)`);
  const lines = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const line = await ask(rl, "> ");
    if (line === "." || line === "") break;
    lines.push(line);
  }
  return lines.join("\n").trim();
}

function mdSection(title, body) {
  const trimmed = (body ?? "").trim();
  if (!trimmed) return "";
  return `\n### ${title}\n\n${trimmed}\n`;
}

function mdBulletsFromText(text) {
  const t = (text ?? "").trim();
  if (!t) return "";
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1 && lines[0].startsWith("- ")) return `${t}\n`;
  return lines.map((l) => `- ${l.replace(/^-\\s+/, "")}`).join("\n") + "\n";
}

function gitSnapshot(cwd) {
  const safe = `safe.directory=${cwd.replaceAll("\\", "/")}`;
  const run = (args) =>
    spawnSync("git", ["-c", safe, ...args], { cwd, encoding: "utf8", windowsHide: true });

  const status = run(["status", "--porcelain"]);
  const diffStat = run(["diff", "--stat"]);

  const parts = [];
  if (status.status === 0) {
    const s = (status.stdout ?? "").trim();
    if (s) parts.push(mdSection("Git status", "```text\n" + s + "\n```"));
  }
  if (diffStat.status === 0) {
    const s = (diffStat.stdout ?? "").trim();
    if (s) parts.push(mdSection("Git diff --stat", "```text\n" + s + "\n```"));
  }

  return parts.join("");
}

function logPathFor(type, today) {
  const root = path.resolve(__dirname, "..");
  const date = formatLocalDate(today);
  if (type === "daily") return path.join(root, "logs", "daily", `${date}.md`);
  if (type === "dev") return path.join(root, "logs", "dev", `${date}.md`);
  if (type === "error") return path.join(root, "logs", "errors", `${date}.md`);
  throw new Error(`Unknown log type: ${type}`);
}

function dailyEntry({ now, steps, logic, changes, issues, validation, includeGit, cwd }) {
  const ts = formatLocalTimestamp(now);
  let md = `\n## ${ts}\n`;
  md += mdSection("Steps", mdBulletsFromText(steps).trimEnd());
  md += mdSection("Methods / Logic", logic);
  md += mdSection("Code changes", mdBulletsFromText(changes).trimEnd());
  md += mdSection("Issues / Errors", mdBulletsFromText(issues).trimEnd());
  md += mdSection("Validation", mdBulletsFromText(validation).trimEnd());
  if (includeGit) md += gitSnapshot(cwd);
  md += "\n";
  return md;
}

function devEntry({ now, title, note, includeGit, cwd }) {
  const ts = formatLocalTimestamp(now);
  const t = (title ?? "").trim();
  const n = (note ?? "").trim();
  let md = `\n## ${ts}${t ? ` — ${t}` : ""}\n`;
  if (n) md += `\n${n}\n`;
  if (includeGit) md += gitSnapshot(cwd);
  md += "\n";
  return md;
}

function errorEntry({
  now,
  title,
  repro,
  expected,
  actual,
  stack,
  steps,
  includeGit,
  cwd,
}) {
  const ts = formatLocalTimestamp(now);
  const t = (title ?? "").trim();
  let md = `\n## ${ts}${t ? ` — ${t}` : ""}\n`;
  md += mdSection("Repro steps", mdBulletsFromText(repro).trimEnd());
  md += mdSection("Expected", expected);
  md += mdSection("Actual", actual);
  md += mdSection("Notes / Investigation", mdBulletsFromText(steps).trimEnd());
  if ((stack ?? "").trim()) md += mdSection("Console / stack", "```text\n" + stack.trim() + "\n```");
  if (includeGit) md += gitSnapshot(cwd);
  md += "\n";
  return md;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) usage(0);

  const type = args._[0];
  if (!type || !["daily", "dev", "error"].includes(type)) usage(1);

  const now = new Date();
  const cwd = process.cwd();
  const filePath = logPathFor(type, now);

  if (type === "daily") {
    let steps = args.steps ?? "";
    let logic = args.logic ?? "";
    let changes = args.changes ?? "";
    let issues = args.issues ?? "";
    let validation = args.validation ?? "";

    if (args.interactive) {
      const rl = startRl();
      try {
        steps = await askMultiline(rl, "Steps");
        logic = await askMultiline(rl, "Methods / Logic");
        changes = await askMultiline(rl, "Code changes (files/functions)");
        issues = await askMultiline(rl, "Issues / Errors");
        validation = await askMultiline(rl, "Validation (tests/checks)");
      } finally {
        rl.close();
      }
    }

    const entry = dailyEntry({
      now,
      steps,
      logic,
      changes,
      issues,
      validation,
      includeGit: Boolean(args.git),
      cwd,
    });

    if (!fs.existsSync(filePath)) {
      appendFile(filePath, `# Daily log (${formatLocalDate(now)})\n`);
    }
    appendFile(filePath, entry);
  }

  if (type === "dev") {
    let title = args.title ?? "";
    let note = args.note ?? "";
    if (args.interactive) {
      const rl = startRl();
      try {
        title = (await ask(rl, "Title (optional): ")).trim();
        note = await askMultiline(rl, "Note");
      } finally {
        rl.close();
      }
    }

    const entry = devEntry({ now, title, note, includeGit: Boolean(args.git), cwd });
    if (!fs.existsSync(filePath)) {
      appendFile(filePath, `# Dev log (${formatLocalDate(now)})\n`);
    }
    appendFile(filePath, entry);
  }

  if (type === "error") {
    let title = args.title ?? "";
    let repro = args.repro ?? "";
    let expected = args.expected ?? "";
    let actual = args.actual ?? "";
    let stack = args.stack ?? "";
    let steps = args.steps ?? "";

    if (args.interactive) {
      const rl = startRl();
      try {
        title = (await ask(rl, "Title (optional): ")).trim();
        repro = await askMultiline(rl, "Repro steps");
        expected = await askMultiline(rl, "Expected");
        actual = await askMultiline(rl, "Actual");
        steps = await askMultiline(rl, "Notes / Investigation");
        stack = await askMultiline(rl, "Console / stack");
      } finally {
        rl.close();
      }
    }

    const entry = errorEntry({
      now,
      title,
      repro,
      expected,
      actual,
      stack,
      steps,
      includeGit: Boolean(args.git),
      cwd,
    });

    if (!fs.existsSync(filePath)) {
      appendFile(filePath, `# Error log (${formatLocalDate(now)})\n`);
    }
    appendFile(filePath, entry);
  }

  // eslint-disable-next-line no-console
  console.log(`Logged to ${path.relative(process.cwd(), filePath)}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

