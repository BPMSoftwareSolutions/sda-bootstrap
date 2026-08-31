import fs from "node:fs";
import path from "node:path";
import { canonicalDigest } from "../proof/canonical-ui-authority.js";
const PACKAGE_ROOT = "capabilities/sda-platform/ui-presentation-protocol";
export function generateUiProtocolLanguageModels(repositoryRoot) {
    const packageRoot = path.join(repositoryRoot, PACKAGE_ROOT);
    const identity = JSON.parse(fs.readFileSync(path.join(packageRoot, "protocol.identity.json"), "utf8"));
    const definition = JSON.parse(fs.readFileSync(path.join(packageRoot, "language-model-definition.json"), "utf8"));
    if (canonicalDigest(definition) !== identity.languageModelDefinitionDigest) {
        throw new Error("UI_PRESENTATION_LANGUAGE_MODEL_DEFINITION_DIVERGENCE");
    }
    const languages = Array.isArray(definition.languages) ? definition.languages : [];
    const fields = Array.isArray(definition.rootFields) ? definition.rootFields : [];
    return Object.freeze(languages.map((language) => {
        const model = Object.freeze({
            languageModelType: "sda-ui-presentation-ir-language-model.v1",
            language: language.language,
            representation: language.representation,
            protocolType: identity.protocolType,
            protocolSchemaDigest: identity.schemaDigest,
            sourceDefinitionDigest: identity.languageModelDefinitionDigest,
            rootType: definition.rootType,
            fields: Object.freeze(fields.map((field) => Object.freeze(structuredClone(field))))
        });
        return Object.freeze({
            relativePath: `${PACKAGE_ROOT}/generated-models/sda-ui-presentation-ir.${String(language.language)}.model.json`,
            content: `${JSON.stringify(model, null, 2)}\n`
        });
    }));
}
