#!/usr/bin/env node
import type { UiEmbodimentTarget } from "../../ui-parity/model/ui-parity.js";
export declare function promoteUiCandidate(workspaceRoot: string, requestedTarget: UiEmbodimentTarget): {
    readonly claimantTarget: string;
    readonly disposition: "PROMOTED_ADMITTED_EVIDENCE";
    readonly promoted: string[];
};
