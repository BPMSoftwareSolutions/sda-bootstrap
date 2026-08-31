import { ExperienceClosureObserver } from "../../../consumer-projection/proof/experience-closure-observer.js";
export class ProveExperienceClosureProvider {
    responsibilityId = "evaluate-promised-consumer-experience-conditions";
    async execute(input) { return new ExperienceClosureObserver().observe(input); }
}
