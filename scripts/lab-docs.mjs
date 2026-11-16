// Keeps the learning lab (docs/lab/) in step with the code it teaches.
//
//   node scripts/lab-docs.mjs           refresh documented outputs, estimate tables, and example manifests
//   node scripts/lab-docs.mjs --check   verify them, plus links (including GitHub Pages rules), navigation, commands,
//                                       Mermaid, and private identifiers (CI)
//
// Documented outputs come from running the repository's own commands, and the
// estimate tables come from the estimator. The example manifests come from the
// real Generator and Manifest code with offline test doubles, so they teach the
// schema without being, or claiming to be, a live Google run.
//
// Markers in the lab's Markdown:
//
//   <!-- lab-output cwd="parser" [exit="1"] [copy="course/master-script.md" to="lab-work/x.md" delete-line="387" delete-text="[/ONSET]"] -->
//   followed by a ```bash fence with one `node ...` command, then a ```text fence with its output.
//
//   <!-- lab-estimate options='{"wordsPerMinute": 160}' -->
//   followed by a Markdown table, which is replaced.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bodyFromText, fakeServices, loadAppsScript } from "../apps-script/tests/helpers.js";
import { parseProductionScript } from "../parser/src/index.js";
import { estimateProduction, formatDuration } from "../production/src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const labDir = join(root, "docs", "lab");
const examplesDir = join(labDir, "examples");
const check = process.argv.includes("--check");
const problems = [];

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const rel = (path) => relative(root, path).replace(/\\/g, "/");

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return markdownFiles(path);
    }
    return name.endsWith(".md") ? [path] : [];
  });
}

// Lab pages plus the repository documents they link into.
const labPages = [join(root, "docs", "index.md"), ...markdownFiles(labDir)];
const linkedPages = [
  ...labPages,
  join(root, "README.md"),
  join(root, "docs", "learning-lab.md"),
  join(root, "docs", "architecture.md"),
  join(root, "docs", "roadmap.md"),
];

// ---------------------------------------------------------------------------
// Documented outputs and estimate tables
// ---------------------------------------------------------------------------

function attributes(text) {
  const attrs = {};
  for (const match of text.matchAll(/([\w-]+)=(?:"([^"]*)"|'([^']*)')/g)) {
    attrs[match[1]] = match[2] ?? match[3];
  }
  return attrs;
}

// The fence that opens at or after `from` (indented fences inside lists too).
// `body` has the fence's indentation removed.
function fenceAt(lines, from, info) {
  let i = from;
  while (i < lines.length && lines[i].trim() === "") {
    i += 1;
  }
  const open = /^(\s*)```(\w*)$/.exec(lines[i] ?? "");
  if (!open || open[2] !== info) {
    return null;
  }
  const indent = open[1];
  let end = i + 1;
  while (end < lines.length && lines[end] !== indent + "```") {
    end += 1;
  }
  const body = lines.slice(i + 1, end).map((line) => line.slice(indent.length));
  return { open: i, close: end, indent, body };
}

function prepareCopy(attrs) {
  if (!attrs.copy) {
    return null;
  }
  const source = read(join(root, attrs.copy)).split("\n");
  const index = Number(attrs["delete-line"]) - 1;
  if (source[index] !== attrs["delete-text"]) {
    throw new Error(`line ${attrs["delete-line"]} of ${attrs.copy} is ${JSON.stringify(source[index])}, not ${JSON.stringify(attrs["delete-text"])}`);
  }
  source.splice(index, 1);
  const target = join(root, attrs.to);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source.join("\n"));
  return target;
}

function runCommand(command, attrs) {
  const args = (command.match(/'[^']*'|\S+/g) ?? []).map((arg) => arg.replace(/^'(.*)'$/, "$1"));
  if (args[0] !== "node") {
    throw new Error(`only node commands can be checked: ${command}`);
  }
  const copy = prepareCopy(attrs);
  try {
    const result = spawnSync(process.execPath, args.slice(1), { cwd: join(root, attrs.cwd ?? "."), encoding: "utf8" });
    const expectedExit = Number(attrs.exit ?? 0);
    if (result.status !== expectedExit) {
      throw new Error(`exit status ${result.status}, documented ${expectedExit}: ${command}`);
    }
    return (result.stdout + result.stderr).replace(/\r\n/g, "\n").trimEnd().split("\n");
  } finally {
    if (copy) {
      rmSync(copy);
    }
  }
}

const masterDocument = parseProductionScript(read(join(root, "course", "master-script.md"))).document;

function seconds(value) {
  return String(Number(value.toFixed(2)));
}

function estimateTable(options) {
  const estimate = estimateProduction(masterDocument, options);
  const threshold = formatDuration(estimate.config.longVideoThresholdMinutes * 60);
  const rows = [
    `| Video | Spoken words | Estimate (seconds) | Shown as | Over ${threshold}? |`,
    "|---|---:|---:|---|---|",
  ];
  for (const video of estimate.videos) {
    const over = video.warnings.length > 0 ? "**Yes**" : "No";
    rows.push(
      `| Stage ${video.stageNumber}, Video ${video.videoNumber}: ${video.title} | ${video.spokenWordCount} | ` +
        `${seconds(video.estimatedDurationSeconds)} | ${formatDuration(video.estimatedDurationSeconds)} | ${over} |`,
    );
  }
  const totals = estimate.totals;
  const flagged = `${totals.videosOverThreshold} ${totals.videosOverThreshold === 1 ? "video" : "videos"}`;
  rows.push(
    `| **Course** | **${totals.spokenWordCount}** | **${seconds(totals.estimatedDurationSeconds)}** | ` +
      `**${formatDuration(totals.estimatedDurationSeconds)}** | ${flagged} |`,
  );
  return rows;
}

function refreshPage(path) {
  const lines = read(path).split("\n");
  const where = (i) => `${rel(path)}:${i + 1}`;
  for (let i = 0; i < lines.length; i += 1) {
    const output = /^\s*<!-- lab-output (.*)-->$/.exec(lines[i]);
    const table = /^\s*<!-- lab-estimate (.*)-->$/.exec(lines[i]);
    try {
      if (output) {
        const attrs = attributes(output[1]);
        const command = fenceAt(lines, i + 1, "bash");
        const shown = command && fenceAt(lines, command.close + 1, "text");
        if (!shown || command.body.length !== 1) {
          throw new Error("expected a one-line ```bash fence followed by a ```text fence");
        }
        const actual = runCommand(command.body[0], attrs);
        if (check && shown.body.join("\n") !== actual.join("\n")) {
          problems.push(`${where(i)}: documented output differs from \`${command.body[0]}\`. Run node scripts/lab-docs.mjs and review the diff.`);
        }
        const indented = actual.map((line) => (line === "" ? "" : shown.indent + line));
        lines.splice(shown.open + 1, shown.close - shown.open - 1, ...indented);
      } else if (table) {
        const attrs = attributes(table[1]);
        const options = attrs.options === undefined ? undefined : JSON.parse(attrs.options);
        let start = i + 1;
        while (lines[start].trim() === "") {
          start += 1;
        }
        let end = start;
        const indent = /^\s*/.exec(lines[start])[0];
        while (end < lines.length && lines[end].trimStart().startsWith("|")) {
          end += 1;
        }
        const actual = estimateTable(options).map((row) => indent + row);
        if (check && lines.slice(start, end).join("\n") !== actual.join("\n")) {
          problems.push(`${where(i)}: estimate table differs from the estimator's result. Run node scripts/lab-docs.mjs and review the diff.`);
        }
        lines.splice(start, end - start, ...actual);
      }
    } catch (error) {
      problems.push(`${where(i)}: ${error.message}`);
    }
  }
  if (!check) {
    writeFileSync(path, lines.join("\n"));
  }
}

// ---------------------------------------------------------------------------
// Example manifests: the real generator with test doubles, two runs
// ---------------------------------------------------------------------------

const EXAMPLE_RUNS = [
  { file: "example-manifest-run-1.json", runId: "example1", at: "2026-01-15T10:00:00.000Z", options: undefined },
  { file: "example-manifest-run-2.json", runId: "example2", at: "2026-01-15T10:05:00.000Z", options: { wordsPerMinute: 160 } },
];

function exampleManifests() {
  const { DocumentReader, GeneratedData, Generator, Validation } = loadAppsScript();
  const services = fakeServices();
  const extraction = DocumentReader.readBody(bodyFromText(read(join(root, "course", "master-script.md"))));
  const expectedStructure = JSON.parse(read(join(root, "course", "fixtures", "expected-structure.json")));
  return EXAMPLE_RUNS.map((example) => {
    services.now = () => new Date(example.at);
    services.newRunId = () => example.runId;
    const result = Generator.generate(services, {
      source: {
        documentId: "example-source-document-id",
        url: "https://docs.test/example-source-document-id",
        title: "Digital Cellar - Master Production Script",
        lastUpdated: "2026-01-15T09:30:00.000Z",
      },
      extraction,
      run: Validation.prepareRun(extraction, { requireExpectedStructure: true, expectedStructure }),
      outputFolderId: "example-parent-folder-id",
      parser: { version: GeneratedData.parserVersion, coreSha256: GeneratedData.parserCoreSha256 },
      estimator: { version: GeneratedData.estimatorVersion, coreSha256: GeneratedData.estimatorCoreSha256 },
      estimateOptions: example.options,
    });
    return { file: example.file, content: services.store.files[result.manifestFile.id].content + "\n" };
  });
}

// The claims Exercise 5 makes about the two example runs.
function checkExampleClaims([first, second]) {
  const same = (label, a, b) => a !== b && problems.push(`example manifests: ${label} should be the same in both runs`);
  const differ = (label, a, b) => a === b && problems.push(`example manifests: ${label} should differ between runs`);
  same("source.extractedTextSha256", first.source.extractedTextSha256, second.source.extractedTextSha256);
  same("parser.coreSha256", first.parser.coreSha256, second.parser.coreSha256);
  same("estimator.coreSha256", first.estimator.coreSha256, second.estimator.coreSha256);
  same("counts", JSON.stringify(first.counts), JSON.stringify(second.counts));
  same("estimate.totals.spokenWordCount", first.estimate.totals.spokenWordCount, second.estimate.totals.spokenWordCount);
  differ("runId", first.runId, second.runId);
  differ("generatedAt", first.generatedAt, second.generatedAt);
  differ("output.folderId", first.output.folderId, second.output.folderId);
  differ("estimator.config.wordsPerMinute", first.estimator.config.wordsPerMinute, second.estimator.config.wordsPerMinute);
  differ("estimate.totals.estimatedDurationSeconds", first.estimate.totals.estimatedDurationSeconds, second.estimate.totals.estimatedDurationSeconds);
  const fileHash = createHash("sha256").update(read(join(root, "course", "master-script.md")), "utf8").digest("hex");
  same("source.extractedTextSha256 and the SHA-256 of course/master-script.md", first.source.extractedTextSha256, fileHash);
}

function refreshExamples() {
  const examples = exampleManifests();
  checkExampleClaims(examples.map(({ content }) => JSON.parse(content)));
  for (const { file, content } of examples) {
    const path = join(examplesDir, file);
    if (check) {
      if (!existsSync(path) || read(path) !== content) {
        problems.push(`${rel(path)}: differs from what the generator produces now. Run node scripts/lab-docs.mjs and review the diff.`);
      }
    } else {
      mkdirSync(examplesDir, { recursive: true });
      writeFileSync(path, content);
    }
  }
}

// ---------------------------------------------------------------------------
// Static checks
// ---------------------------------------------------------------------------

// GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens.
function anchorsOf(path) {
  const seen = new Map();
  const anchors = new Set();
  let inFence = false;
  for (const line of read(path).split("\n")) {
    if (line.startsWith("```")) {
      inFence = !inFence;
    }
    const heading = !inFence && /^#{1,6} (.+)$/.exec(line);
    if (heading) {
      const base = heading[1]
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .replace(/ /g, "-");
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      anchors.add(count === 0 ? base : `${base}-${count}`);
    }
  }
  return anchors;
}

function withoutFences(text) {
  return text.replace(/^\s*```[\s\S]*?^\s*```/gm, "");
}

// ---------------------------------------------------------------------------
// GitHub Pages: what Jekyll publishes, and links that survive the build
// ---------------------------------------------------------------------------

const REPOSITORY = "https://github.com/kenwalger/cellar-api";
const SITE_HOME = "docs/index.md";

// The exclude list in _config.yml (a plain YAML list, read without a parser).
const pagesExclude = (() => {
  const lines = read(join(root, "_config.yml")).split("\n");
  const start = lines.indexOf("exclude:");
  const entries = [];
  for (const line of lines.slice(start + 1)) {
    const item = /^ {2}- "?([^"]+?)"?\s*$/.exec(line);
    if (!item) {
      break;
    }
    entries.push(item[1]);
  }
  return entries;
})();

// Whether Jekyll copies or renders this repository path into the site.
function isPublished(relPath) {
  if (relPath.split("/").some((part) => part.startsWith("_") || part.startsWith("."))) {
    return false;
  }
  return !pagesExclude.some((entry) => relPath === entry || relPath.startsWith(`${entry}/`));
}

// The URL Jekyll gives a published Markdown page, without the base path.
function pageUrl(relPath) {
  if (relPath === SITE_HOME) {
    return "/";
  }
  const index = /^(.*\/)?(README|index)\.md$/.exec(relPath);
  return index ? `/${index[1] ?? ""}` : `/${relPath.replace(/\.md$/, ".html")}`;
}

// A link to a file in this repository on GitHub: the file and heading must exist.
function checkGithubLink(path, target) {
  const match = /^https:\/\/github\.com\/kenwalger\/cellar-api\/(blob|tree)\/main\/([^#]*)(?:#(.*))?$/.exec(target);
  if (!match) {
    return;
  }
  const [, kind, repoPath, anchor] = match;
  const resolved = join(root, decodeURIComponent(repoPath));
  if (!existsSync(resolved)) {
    problems.push(`${rel(path)}: GitHub link to a missing path: ${target}`);
  } else if ((kind === "tree") !== statSync(resolved).isDirectory()) {
    problems.push(`${rel(path)}: GitHub link should use /${kind === "tree" ? "blob" : "tree"}/ for ${repoPath}`);
  } else if (anchor && resolved.endsWith(".md") && !anchorsOf(resolved).has(anchor)) {
    problems.push(`${rel(path)}: GitHub link to a missing heading: ${target}`);
  }
}

function checkLinks(path) {
  const published = labPages.includes(path);
  for (const match of withoutFences(read(path)).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^https?:/.test(target)) {
      checkGithubLink(path, target);
      continue;
    }
    if (/^mailto:/.test(target)) {
      continue;
    }
    const [file, anchor] = target.split("#");
    const resolved = file === "" ? path : resolve(dirname(path), decodeURIComponent(file));
    if (!existsSync(resolved)) {
      problems.push(`${rel(path)}: link to a missing file: ${target}`);
      continue;
    }
    if (anchor && resolved.endsWith(".md") && !anchorsOf(resolved).has(anchor)) {
      problems.push(`${rel(path)}: link to a missing heading: ${target}`);
    }
    if (!published || file === "") {
      continue;
    }
    // On the Pages site, a relative link must reach something Jekyll publishes.
    const targetPath = rel(resolved);
    const onGithub = `${REPOSITORY}/${statSync(resolved).isDirectory() ? "tree" : "blob"}/main/${targetPath}`;
    if (!isPublished(targetPath)) {
      problems.push(`${rel(path)}: ${target} isn't published on the Pages site. Link to ${onGithub} instead.`);
    } else if (statSync(resolved).isDirectory()) {
      problems.push(`${rel(path)}: ${target} is a folder. Link to a page in it, or to ${onGithub}.`);
    } else if (rel(path) === SITE_HOME && !resolved.endsWith(".md")) {
      // The home page is served at the site root, so a relative file path from it
      // would resolve against the wrong folder. Only .md links are rewritten.
      problems.push(`${rel(path)}: ${target} is relative to docs/, but this page is served at the site root.`);
    }
  }
}

// _data/lab.yml drives the site navigation. Every published page must be in it,
// once, with the URL Jekyll gives it.
function checkNavigation() {
  const entries = [];
  for (const line of read(join(root, "_data", "lab.yml")).split("\n")) {
    const field = /^ {2}(- )?(title|path|url): "?(.*?)"?\s*$/.exec(line) ?? /^ {4}(path|url): "?(.*?)"?\s*$/.exec(line);
    if (!field) {
      continue;
    }
    const [name, value] = field.length === 4 ? [field[2], field[3]] : [field[1], field[2]];
    if (name === "title") {
      entries.push({});
    }
    entries.at(-1)[name] = value;
  }
  const listed = new Set();
  for (const entry of entries) {
    if (!entry.path || !existsSync(join(root, entry.path))) {
      problems.push(`_data/lab.yml: "${entry.title}" points to a missing page: ${entry.path}`);
      continue;
    }
    if (entry.url !== pageUrl(entry.path)) {
      problems.push(`_data/lab.yml: "${entry.title}" has url ${entry.url}, but Jekyll publishes ${entry.path} at ${pageUrl(entry.path)}`);
    }
    if (listed.has(entry.path)) {
      problems.push(`_data/lab.yml: ${entry.path} is listed twice`);
    }
    listed.add(entry.path);
  }
  for (const page of labPages.map(rel)) {
    if (!listed.has(page)) {
      problems.push(`_data/lab.yml: published page ${page} is missing from the lab navigation`);
    }
  }
  const docsPages = markdownFiles(join(root, "docs")).map(rel).filter(isPublished);
  for (const page of docsPages) {
    if (!labPages.map(rel).includes(page)) {
      problems.push(`${page}: published on the Pages site but not checked as a lab page`);
    }
  }
  if (!/path: "docs\/index\.md"\n\s+values:\n\s+permalink: \//.test(read(join(root, "_config.yml")))) {
    problems.push("_config.yml: docs/index.md must be published at permalink / (the site's entry point)");
  }
}

const packageScripts = new Set(
  ["parser", "production", "apps-script"].flatMap((dir) =>
    Object.keys(JSON.parse(read(join(root, dir, "package.json"))).scripts),
  ),
);

function checkCommands(path) {
  const text = read(path);
  for (const fence of text.matchAll(/^[ \t]*```bash\n([\s\S]*?)^[ \t]*```/gm)) {
    for (const line of fence[1].split("\n")) {
      const npmRun = /^npm run ([\w-]+)/.exec(line.trim());
      const node = /^node (\S+\.m?js)/.exec(line.trim());
      if (npmRun && !packageScripts.has(npmRun[1])) {
        problems.push(`${rel(path)}: unknown npm script: ${line.trim()}`);
      }
      if (node && !["", "parser", "production", "apps-script"].some((dir) => existsSync(join(root, dir, node[1])))) {
        problems.push(`${rel(path)}: node script not found: ${line.trim()}`);
      }
    }
  }
}

// The Pages site draws Mermaid with _includes/lab-mermaid.html. GitHub Pages
// emits a ```mermaid fence as <pre><code class="language-mermaid"> (Rouge has
// no Mermaid lexer, as seen on the live site), or as Rouge's wrapped
// <div class="language-mermaid ..."> form. The loader must find both, and it
// must be included on pages that have a diagram.
function checkMermaidLoader() {
  if (!labPages.some((path) => /^\s*```mermaid$/m.test(read(path)))) {
    return;
  }
  const layout = read(join(root, "_layouts", "lab.html"));
  const loader = read(join(root, "_includes", "lab-mermaid.html"));
  if (!/\{%-?\s*if content contains "language-mermaid"\s*-?%\}\s*\{%-?\s*include lab-mermaid\.html\s*-?%\}/.test(layout)) {
    problems.push('_layouts/lab.html: must include lab-mermaid.html when the content contains "language-mermaid"');
  }
  for (const selector of ["code.language-mermaid", "div.language-mermaid code"]) {
    if (!loader.includes(selector)) {
      problems.push(`_includes/lab-mermaid.html: must select "${selector}", one of the shapes GitHub Pages emits for a mermaid block`);
    }
  }
  for (const call of ["import(", "mermaid.initialize("]) {
    if (loader.split(call).length !== 2) {
      problems.push(`_includes/lab-mermaid.html: ${call} must appear exactly once (load and initialize Mermaid once)`);
    }
  }
}

function checkMermaid(path) {
  for (const fence of read(path).matchAll(/^```mermaid\n([\s\S]*?)^```/gm)) {
    const body = fence[1].split("\n").filter((line) => line.trim() !== "" && !line.trim().startsWith("%%"));
    if (!/^(flowchart|graph) (TD|TB|BT|LR|RL)$/.test(body[0]?.trim() ?? "")) {
      problems.push(`${rel(path)}: Mermaid block must start with "flowchart TD" (or another direction)`);
    }
    let depth = 0;
    for (const line of body.slice(1)) {
      const trimmed = line.trim();
      const unquoted = trimmed.replace(/"[^"]*"/g, '""');
      if ((trimmed.match(/"/g) ?? []).length % 2 !== 0) {
        problems.push(`${rel(path)}: Mermaid line has an unmatched quote: ${trimmed}`);
      }
      for (const [open, close] of [["[", "]"], ["(", ")"], ["{", "}"]]) {
        if (unquoted.split(open).length !== unquoted.split(close).length) {
          problems.push(`${rel(path)}: Mermaid line has unbalanced ${open}${close}: ${trimmed}`);
        }
      }
      if (/^subgraph\b/.test(trimmed)) {
        depth += 1;
      } else if (trimmed === "end") {
        depth -= 1;
      } else if (!/(-->|-\.->|==>)/.test(unquoted) && !/^\w+[[({]/.test(unquoted) && !/^(classDef|class|style|direction)\b/.test(trimmed)) {
        problems.push(`${rel(path)}: Mermaid line is neither a node nor an edge: ${trimmed}`);
      }
    }
    if (depth !== 0) {
      problems.push(`${rel(path)}: Mermaid subgraph and end lines don't match`);
    }
  }
}

const PRIVATE_PATTERNS = [
  [/docs\.google\.com\/\w+\/d\/[A-Za-z0-9_-]{10,}/, "a Google Docs URL with an ID"],
  [/drive\.google\.com\/(drive\/folders|file\/d)\/[A-Za-z0-9_-]{10,}/, "a Google Drive URL with an ID"],
  [/script\.google\.com\/\S*\/d\/[A-Za-z0-9_-]{10,}/, "an Apps Script URL with an ID"],
  [/ya29\.[A-Za-z0-9_-]+|AIza[0-9A-Za-z_-]{35}/, "a Google access token or API key"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]*[A-Za-z]{2,}/, "an email address"],
];

function checkPrivate(path) {
  const text = read(path);
  for (const [pattern, label] of PRIVATE_PATTERNS) {
    if (pattern.test(text)) {
      problems.push(`${rel(path)}: contains ${label}: ${pattern.exec(text)[0]}`);
    }
  }
  // Drive file and folder IDs: long tokens that aren't SHA-256 hex.
  for (const token of text.match(/\b[A-Za-z0-9_-]{28,}\b/g) ?? []) {
    if (!/^[0-9a-f]{64}$/.test(token) && /[0-9]/.test(token) && /[A-Z]/.test(token)) {
      problems.push(`${rel(path)}: contains something that looks like a Drive ID: ${token}`);
    }
  }
}

// GitHub Pages runs Liquid on Markdown, so {{ and {% would be swallowed.
function checkLiquid(path) {
  if (/\{\{|\{%/.test(read(path))) {
    problems.push(`${rel(path)}: contains {{ or {%, which GitHub Pages (Liquid) would not show as written`);
  }
}

// ---------------------------------------------------------------------------

labPages.forEach(refreshPage);
refreshExamples();

if (check) {
  linkedPages.forEach(checkLinks);
  checkNavigation();
  checkMermaidLoader();
  labPages.forEach((path) => {
    checkCommands(path);
    checkMermaid(path);
    checkLiquid(path);
  });
  [...labPages, ...readdirSync(examplesDir).map((name) => join(examplesDir, name))].forEach(checkPrivate);
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(check ? `Learning lab is up to date (${labPages.length} pages).` : "Refreshed the learning lab's documented outputs and examples.");
