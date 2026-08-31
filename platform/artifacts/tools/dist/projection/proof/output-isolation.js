function normalize(directory) {
    return directory.replace(/[\\/]+$/, "").replaceAll("\\", "/");
}
export function outputsOverlap(a, b) {
    const left = normalize(a);
    const right = normalize(b);
    return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}
export function validateOutputIsolation(profile) {
    const execution = profile.executionMechanics?.kernelOutputDirectory;
    if (typeof execution !== "string")
        return Object.freeze([]);
    if (!outputsOverlap(profile.outputDirectory, execution))
        return Object.freeze([]);
    return Object.freeze([{
            a: profile.outputDirectory,
            b: execution,
            reason: "structural and execution outputs are identical or nested"
        }]);
}
