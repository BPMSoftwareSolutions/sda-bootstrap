"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const REFERENCE_WORKSPACE_ROOT = path.join(REPO_ROOT, "examples", "generic-capability");

function createReferenceWorkspace() {
  // The checked-in authority intentionally uses repository-relative references
  // such as ../../kernel. A sibling fixture preserves those references without
  // publishing into the live example's projected directory.
  const workspaceRoot = fs.mkdtempSync(path.join(path.dirname(REFERENCE_WORKSPACE_ROOT), ".generic-capability-test-"));
  fs.cpSync(REFERENCE_WORKSPACE_ROOT, workspaceRoot, {
    recursive: true,
    filter(candidate) {
      const relative = path.relative(REFERENCE_WORKSPACE_ROOT, candidate);
      const topLevel = relative.split(path.sep)[0];
      if (!relative) return true;
      return ![
        "artifacts",
        "csharp-projection-build",
        "projected"
      ].includes(topLevel) && !topLevel.startsWith(".projected.");
    }
  });
  process.once("exit", () => {
    try {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    } catch {
      // A failed test must not hide its primary error behind cleanup failure.
    }
  });
  return workspaceRoot;
}

module.exports = { REFERENCE_WORKSPACE_ROOT, REPO_ROOT, createReferenceWorkspace };
