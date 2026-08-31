export class PromoteProvenImplementationProvider {
    responsibilityId = "evaluate-transactional-projection-publication";
    async execute(input) {
        return Object.freeze({ ...input, exactManifest: JSON.stringify([...input.planDigests].sort()) === JSON.stringify([...input.manifestDigests].sort()) });
    }
}
