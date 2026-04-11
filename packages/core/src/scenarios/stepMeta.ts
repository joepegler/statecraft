import type { ScenarioStep } from "./types.js";

const STEP_NAME_FIELD = "__statecraftStepName";

export function labelScenarioStep(step: ScenarioStep<any, any>, name: string): ScenarioStep<any, any> {
  (step as any)[STEP_NAME_FIELD] = name;
  return step;
}

export function getScenarioStepLabel(step: ScenarioStep<any, any>): string | undefined {
  return (step as any)[STEP_NAME_FIELD];
}
