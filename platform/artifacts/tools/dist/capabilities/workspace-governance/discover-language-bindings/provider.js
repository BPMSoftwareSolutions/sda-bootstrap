export class LanguageBindingDiscoveryProvider {
    responsibilityId = "enumerate-declared-binding-manifests";
    async execute(input) {
        const discovered = input.bindingFiles.map(({ language, fact }) => ({
            language,
            bindingPath: fact.sourceRef,
            binding: fact.value
        }));
        const seen = new Set();
        const duplicates = new Set();
        for (const { bindingPath } of discovered) {
            if (seen.has(bindingPath))
                duplicates.add(bindingPath);
            seen.add(bindingPath);
        }
        return {
            languagesDirectory: input.languagesDirectory,
            expectedBindingFileCount: input.bindingFiles.length,
            discovered,
            duplicateBindingPaths: [...duplicates].sort()
        };
    }
}
