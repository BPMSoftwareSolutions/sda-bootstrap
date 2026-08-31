export function compareNamedShapes(admitted, projected) {
    const names = new Set([...admitted.keys(), ...projected.keys()]);
    const results = [];
    let matchCount = 0;
    for (const typeName of [...names].sort()) {
        const expected = admitted.get(typeName);
        const actual = projected.get(typeName);
        if (!expected) {
            results.push({ typeName, status: "GENERATED_ONLY" });
        }
        else if (!actual) {
            results.push({ typeName, status: "HAND_WRITTEN_ONLY" });
        }
        else if (expected.description === actual.description) {
            matchCount += 1;
            results.push({ typeName, status: "MATCH" });
        }
        else {
            results.push({
                typeName,
                status: "MISMATCH",
                detail: `admitted: ${expected.description} | projected: ${actual.description}`
            });
        }
    }
    return { results, matchCount, totalCount: results.length };
}
