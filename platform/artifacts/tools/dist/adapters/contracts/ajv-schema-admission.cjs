"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AjvSchemaAdmission = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const _2020_js_1 = require("ajv/dist/2020.js");
function normalizeError(error) {
    return {
        instancePath: error.instancePath,
        message: error.message ?? "schema constraint was not satisfied"
    };
}
class AjvSchemaAdmission {
    schemasDirectory;
    validator = null;
    constructor(schemasDirectory) {
        this.schemasDirectory = schemasDirectory;
    }
    listSchemaFiles() {
        return node_fs_1.default.readdirSync(this.schemasDirectory)
            .filter((file) => file.endsWith(".schema.json"))
            .sort();
    }
    validate(instance, schemaFilename) {
        const validate = this.createValidator().getSchema(schemaFilename);
        if (!validate)
            throw new Error(`Unknown schema: ${schemaFilename}`);
        const result = validate(instance);
        if (typeof result !== "boolean")
            throw new Error(`Schema '${schemaFilename}' requires asynchronous admission.`);
        const valid = result;
        return {
            valid,
            errors: valid ? [] : (validate.errors ?? []).map(normalizeError)
        };
    }
    unresolvedSchemaFiles() {
        const validator = this.createValidator();
        return this.listSchemaFiles().filter((file) => !validator.getSchema(file));
    }
    createValidator() {
        if (this.validator)
            return this.validator;
        const validator = new _2020_js_1.Ajv2020({ strict: false, allErrors: true });
        for (const file of this.listSchemaFiles()) {
            const schema = JSON.parse(node_fs_1.default.readFileSync(node_path_1.default.join(this.schemasDirectory, file), "utf8"));
            validator.addSchema({ ...schema, $id: file }, file);
        }
        this.validator = validator;
        return validator;
    }
}
exports.AjvSchemaAdmission = AjvSchemaAdmission;
