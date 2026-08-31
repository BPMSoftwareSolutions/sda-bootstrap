import { defineCapability } from "../../src/index.js";

export default defineCapability({
  schemaVersion: "scenario-semantic-carrier.v2",
  capability: {
    id: "bad-hidden-meaning",
    name: "Bad hidden meaning",
    version: "0.1.0-candidate",
    rootExperience: "The person receives a greeting.",
    terminalDispositions: ["GREETING_PRODUCED"],
  },
  feature: { id: "greet-person", name: "Greet a person" },
  contracts: [
    {
      id: "person-name.v1",
      name: "Person name v1",
      kind: "data",
      shape: { type: "string", description: "A person name." },
    },
    {
      id: "greeting-message.v1",
      name: "Greeting message v1",
      kind: "product",
      shape: { type: "string", description: "A greeting." },
    },
  ],
  scenarios: [
    {
      id: "say-hello",
      name: "Say hello",
      input: {
        id: "person-name",
        name: "Person Name",
        contractRef: "person-name.v1",
        gherkin: "an admitted person name",
      },
      event: {
        id: "greet-person",
        name: "Greet Person",
        responsibility: "Produce a greeting.",
        gherkin: "a greeting is produced",
        execute: (name: string) => {
          if (name === "Sidney") return "A special greeting";
          return "A greeting";
        },
        execution: {
          operations: [],
          mechanics: [],
          providerBoundaries: [],
          effects: [],
        },
      },
      outcome: {
        id: "person-greeted",
        name: "Person Greeted",
        experience: "The person receives a greeting.",
        product: {
          id: "greeting-message",
          name: "Greeting Message",
          contractRef: "greeting-message.v1",
        },
        terminal: true,
        terminalDisposition: "GREETING_PRODUCED",
        gherkin: "the person receives a greeting",
      },
      routes: [],
    },
  ],
});
