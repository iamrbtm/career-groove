export function buildInitialExpandedSteps(steps: number[]): number[] {
  return steps.includes(1) ? [1] : [];
}

export function toggleExpandedStep(expandedSteps: number[], step: number): number[] {
  if (expandedSteps.includes(step)) {
    return expandedSteps.filter((value) => value !== step);
  }
  return [...expandedSteps, step].sort((left, right) => left - right);
}
