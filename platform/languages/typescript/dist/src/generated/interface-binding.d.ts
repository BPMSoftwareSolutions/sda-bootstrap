import type { InterfaceKind } from "./interface-kind.js";
export interface InterfaceBinding {
    interfaceId: string;
    scenarioIds: string[];
    kind?: InterfaceKind;
}
