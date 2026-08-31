// Conformance proof for sda-json-query-cli.v1 (Node projection target).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { runQuery } from "./query-cli.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, "query-cli.mjs");

const catalog = {
  queries: [
    {
      queryId: "count-widgets",
      status: "IMPLEMENTED",
      expression: { op: "length", value: { op: "path", from: "input", path: "profile.widgets" } }
    },
    {
      queryId: "filter-by-owner",
      status: "IMPLEMENTED",
      expression: {
        op: "filter",
        from: { op: "path", from: "input", path: "profile.widgets" },
        as: "widget",
        where: { op: "equals", left: { op: "path", from: "widget", path: "owner" }, right: { op: "path", from: "input", path: "params.owner" } }
      }
    },
    { queryId: "not-yet-built", status: "DECLARED" }
  ]
};
const document = { widgets: [{ id: 1, owner: "a" }, { id: 2, owner: "b" }, { id: 3, owner: "a" }] };

test("runQuery evaluates an implemented query against an admitted document", () => {
  assert.equal(runQuery(catalog, document, "count-widgets", {}), 3);
});

test("runQuery threads params into the query expression", () => {
  const result = runQuery(catalog, document, "filter-by-owner", { owner: "a" });
  assert.deepEqual(result.map((w) => w.id), [1, 3]);
});

test("runQuery rejects a query id absent from the catalog", () => {
  assert.throws(() => runQuery(catalog, document, "does-not-exist", {}), /UNKNOWN_QUERY/);
});

test("runQuery fails closed on a declared-but-unimplemented query", () => {
  assert.throws(() => runQuery(catalog, document, "not-yet-built", {}), /MISSING_SDA_PLATFORM_CAPABILITY/);
});

test("query-cli.mjs runs end-to-end as a real subprocess", () => {
  const catalogPath = path.join(HERE, `.query-cli-test-catalog-${process.pid}.json`);
  const documentPath = path.join(HERE, `.query-cli-test-document-${process.pid}.json`);
  fs.writeFileSync(catalogPath, JSON.stringify(catalog));
  fs.writeFileSync(documentPath, JSON.stringify(document));
  try {
    const stdout = execFileSync(process.execPath, [CLI, catalogPath, documentPath, "count-widgets", "{}"], { encoding: "utf8" });
    assert.equal(stdout.trim(), "3");
    assert.throws(
      () => execFileSync(process.execPath, [CLI, catalogPath, documentPath, "not-yet-built", "{}"], { encoding: "utf8", stdio: "pipe" }),
      /MISSING_SDA_PLATFORM_CAPABILITY/
    );
  } finally {
    fs.rmSync(catalogPath, { force: true });
    fs.rmSync(documentPath, { force: true });
  }
});
