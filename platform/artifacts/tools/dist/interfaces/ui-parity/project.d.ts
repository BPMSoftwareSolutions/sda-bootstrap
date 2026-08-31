#!/usr/bin/env node
import { UiParityProjector } from "../../ui-parity/application/ui-parity-projector.js";
import type { UiEmbodimentTarget } from "../../ui-parity/model/ui-parity.js";
export declare function projectUiParity(workspaceRoot: string, targets?: readonly UiEmbodimentTarget[]): ReturnType<UiParityProjector["project"]>;
