import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import { type ApiOperationGraph, type DeriveApiOperationGraphInput } from "./model.js";
export declare class DeriveApiOperationGraphProvider implements ResponsibilityProvider<DeriveApiOperationGraphInput, ApiOperationGraph> {
    readonly responsibilityId = "resolve-interface-authority-into-target-neutral-operation-graph";
    execute(input: DeriveApiOperationGraphInput): Promise<ApiOperationGraph>;
}
