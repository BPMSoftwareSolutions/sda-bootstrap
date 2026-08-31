import type { CapabilityBackground } from "./capability-background.js";
import type { CapabilityMode } from "./capability-mode.js";
import type { InterfaceBinding } from "./interface-binding.js";
import type { PromisedExperience } from "./promised-experience.js";
import type { ScenarioReference } from "./scenario-reference.js";
import type { ScenarioTransition } from "./scenario-transition.js";
import type { UserStory } from "./user-story.js";
export declare const CAPABILITY_TYPE: "scenario-driven-capability.v1";
export interface Capability {
    capabilityId: string;
    userStory: UserStory;
    scenarios: ScenarioReference[];
    name?: string;
    mode?: CapabilityMode[];
    experience?: PromisedExperience;
    background?: CapabilityBackground;
    interfaces?: InterfaceBinding[];
    transitions?: ScenarioTransition[];
    rootScenarioId?: string;
}
