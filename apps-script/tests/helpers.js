// Node-only test helpers. Nothing here is pushed to Apps Script (see .claspignore).

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import vm from "node:vm";

const appsScriptDir = new URL("../", import.meta.url);
const repoRoot = new URL("../../", import.meta.url);

export function readRepoFile(relativePath) {
  return readFileSync(new URL(relativePath, repoRoot), "utf8");
}

export function scriptFileNames() {
  return readdirSync(appsScriptDir)
    .filter((name) => name.endsWith(".js"))
    .sort();
}

// Loads every Apps Script file into one shared global context, the way Apps
// Script does. `order` can reverse the load order to prove it doesn't matter.
export function loadAppsScript({ order = "alphabetical" } = {}) {
  const names = scriptFileNames();
  if (order === "reverse") {
    names.reverse();
  }
  const context = vm.createContext({});
  for (const name of names) {
    vm.runInContext(readFileSync(new URL(name, appsScriptDir), "utf8"), context, {
      filename: name,
    });
  }
  return context;
}

// Objects from the vm realm have different prototypes; compare as plain JSON.
export function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

export function lines(...textLines) {
  return textLines.join("\n");
}

// ---------------------------------------------------------------------------
// Test doubles for DocumentApp's Body and its child elements
// ---------------------------------------------------------------------------

export function paragraph(text, inline) {
  return { type: "PARAGRAPH", text: text, inline: inline };
}

export function listItem(text) {
  return { type: "LIST_ITEM", text: text };
}

export function element(type) {
  return { type: type, text: "" };
}

function fakeElement(spec) {
  const inline = spec.inline ?? (spec.text ? ["TEXT"] : []);
  return {
    getType: () => spec.type,
    getText: () => spec.text,
    getNumChildren: () => inline.length,
    getChild: (index) => ({ getType: () => inline[index] }),
  };
}

export function fakeBody(specs) {
  return {
    getNumChildren: () => specs.length,
    getChild: (index) => fakeElement(specs[index]),
  };
}

// One paragraph per line, the way a plain-text paste into Google Docs behaves.
export function bodyFromText(text) {
  return fakeBody(text.split("\n").map((line) => paragraph(line)));
}

// ---------------------------------------------------------------------------
// Test double for the Drive/Docs services used by Generator
// ---------------------------------------------------------------------------

export function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function fakeServices({ failOn } = {}) {
  const calls = [];
  const store = { folders: {}, documents: {}, files: {} };
  let nextId = 0;
  let clock = Date.UTC(2026, 10, 13, 23, 16, 4);
  let runCounter = 0;
  const methodCounts = {};

  function record(method, args) {
    calls.push([method].concat(args));
    methodCounts[method] = (methodCounts[method] ?? 0) + 1;
    if (failOn && failOn.method === method && (failOn.always || failOn.nth === methodCounts[method])) {
      throw new Error(`Simulated ${method} failure`);
    }
  }

  return {
    calls,
    store,
    now() {
      clock += 1000;
      return new Date(clock);
    },
    newRunId() {
      runCounter += 1;
      return `run${String(runCounter).padStart(5, "0")}`;
    },
    sha256Hex,
    createFolder(name, parentId) {
      record("createFolder", [name, parentId]);
      const id = `folder-${++nextId}`;
      store.folders[id] = { name, parentId };
      return { id, url: `https://drive.test/${id}`, name };
    },
    createDocument(folderId, title) {
      record("createDocument", [folderId, title]);
      const id = `doc-${++nextId}`;
      store.documents[id] = { folderId, title, paragraphs: null };
      return { id, url: `https://docs.test/${id}`, title };
    },
    writeDocument(documentId, paragraphs) {
      record("writeDocument", [documentId]);
      store.documents[documentId].paragraphs = paragraphs;
    },
    createJsonFile(folderId, name, content) {
      record("createJsonFile", [folderId, name]);
      const id = `file-${++nextId}`;
      store.files[id] = { folderId, name, content };
      return { id, url: `https://drive.test/${id}` };
    },
    renameFolder(folderId, name) {
      record("renameFolder", [folderId, name]);
      store.folders[folderId].name = name;
    },
  };
}
