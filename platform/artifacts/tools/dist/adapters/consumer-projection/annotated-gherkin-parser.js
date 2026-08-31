const tagPattern = /^@([a-z-]+)(?::(\S+))?$/;
const requiredTags = [
    "scenario", "input", "input-contract", "event", "event-authority", "outcome", "outcome-contract"
];
function parseTagLine(line) {
    const tags = {};
    for (const token of line.trim().split(/\s+/)) {
        const match = tagPattern.exec(token);
        const key = match?.[1];
        if (key)
            tags[key] = match[2] ?? true;
    }
    return tags;
}
function admit(scenario) {
    const missing = requiredTags.filter((tag) => scenario.tags[tag] === undefined);
    if (missing.length > 0) {
        throw new Error(`Scenario "${scenario.name}" is missing required tag(s): ${missing.map((tag) => `@${tag}`).join(", ")}`);
    }
    for (const [step, value] of [["given", scenario.given], ["when", scenario.when], ["then", scenario.then]]) {
        if (!value)
            throw new Error(`Scenario "${scenario.name}" (@scenario:${String(scenario.tags.scenario)}) has no ${step} step.`);
    }
    return Object.freeze({
        name: scenario.name,
        tags: scenario.tags,
        given: scenario.given,
        when: scenario.when,
        then: scenario.then
    });
}
export class AnnotatedGherkinParser {
    parse(source) {
        const scenarios = [];
        let pendingTags = {};
        let current = null;
        const flush = () => {
            if (current)
                scenarios.push(current);
            current = null;
        };
        for (const rawLine of source.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#"))
                continue;
            if (line.startsWith("@")) {
                pendingTags = { ...pendingTags, ...parseTagLine(line) };
                continue;
            }
            if (line.startsWith("Feature:")) {
                flush();
                continue;
            }
            if (line.startsWith("Scenario:")) {
                flush();
                current = { name: line.slice("Scenario:".length).trim(), tags: pendingTags, given: null, when: null, then: null };
                pendingTags = {};
                continue;
            }
            if (!current)
                continue;
            if (line.startsWith("Given "))
                current.given = line.slice("Given".length).trim();
            else if (line.startsWith("When "))
                current.when = line.slice("When".length).trim();
            else if (line.startsWith("Then "))
                current.then = line.slice("Then".length).trim();
        }
        flush();
        return Object.freeze(scenarios.map(admit));
    }
}
export function parseAnnotatedGherkin(source) {
    return new AnnotatedGherkinParser().parse(source);
}
