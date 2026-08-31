import type { SourceFact } from "../../model/semantic-model.js";
import type { SchemaAdmissionResult } from "../../ports/conformance/schema-admission.js";
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function isNonEmptyString(value: unknown): value is string;
export declare function isStringArray(value: unknown): value is readonly string[];
export declare function isSourceFact<T>(value: unknown, valuePredicate: (candidate: unknown) => candidate is T): value is SourceFact<T>;
export declare function isSchemaAdmissionResult(value: unknown): value is SchemaAdmissionResult;
export declare function isBooleanField(value: unknown, field: string): boolean;
