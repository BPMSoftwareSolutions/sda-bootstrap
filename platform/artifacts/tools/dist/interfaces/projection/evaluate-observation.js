import fs from "node:fs";
import path from "node:path";
import { EXECUTION_OBSERVATION_PATH } from "./observe-execution.js";
import { STRUCTURAL_OBSERVATION_PATH } from "./observe-structural.js";
function evaluate(repositoryRoot, relativePath, language) {
    const observationPath = path.join(repositoryRoot, relativePath);
    if (!fs.existsSync(observationPath)) {
        return { language, observed: false, conforming: false, reason: `no projection observation exists at ${relativePath}` };
    }
    const parsed = JSON.parse(fs.readFileSync(observationPath, "utf8"));
    const observed = parsed.results?.[language];
    if (!observed)
        return { language, observed: false, conforming: false, reason: `no projection observation exists for '${language}'` };
    return { language, observed: true, conforming: observed.conforming, result: observed };
}
export function evaluateStructuralProjection(repositoryRoot, language) {
    return evaluate(repositoryRoot, STRUCTURAL_OBSERVATION_PATH, language);
}
export function evaluateExecutionProjection(repositoryRoot, language) {
    return evaluate(repositoryRoot, EXECUTION_OBSERVATION_PATH, language);
}
