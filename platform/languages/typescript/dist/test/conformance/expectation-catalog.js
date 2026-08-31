import fs from "node:fs";
import path from "node:path";
import { expectationsExecutionDirectory } from "./repository-paths.js";
let catalog;
function load() {
    const result = new Map();
    for (const file of fs.readdirSync(expectationsExecutionDirectory)) {
        if (!file.endsWith(".json"))
            continue;
        const fullPath = path.join(expectationsExecutionDirectory, file);
        const expectation = JSON.parse(fs.readFileSync(fullPath, "utf8"));
        result.set(expectation.expectationId, expectation);
    }
    return result;
}
/**
 * Loads every conformance/expectations/execution/*.json once, keyed by
 * expectationId — the "then" half a fixture's expectationId resolves
 * through, kept independent of the fixture's own file.
 */
export function resolveExpectation(expectationId) {
    if (!catalog) {
        catalog = load();
    }
    const expectation = catalog.get(expectationId);
    if (!expectation) {
        throw new Error(`No expectation found for expectationId '${expectationId}' under ${expectationsExecutionDirectory}.`);
    }
    return expectation;
}
