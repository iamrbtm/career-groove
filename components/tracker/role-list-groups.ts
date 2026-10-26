type Application = {
  id: string;
  title: string;
  company: string;
  status: string;
  currentStep?: number | null;
  latestScore?: { fit?: number | null } | null;
};

export type RoleGroup = {
  step: number;
  title: string;
  applications: Application[];
};

const stepTitles: Record<number, string> = {
  1: "Research",
  2: "Documents",
  3: "Follow-up",
  4: "Interview",
  5: "Decision",
  6: "Closed",
};

export function stepFromStatus(status: string): number {
  const map: Record<string, number> = {
    saved: 1,
    researching: 1,
    ready_to_apply: 2,
    applied: 3,
    follow_up: 3,
    interviewing: 4,
    offer: 5,
    rejected: 6,
    withdrawn: 6,
    archived: 6,
  };
  return map[status] ?? 1;
}

export function buildRoleGroups(applications: Application[]): RoleGroup[] {
  const grouped = new Map<number, Array<Application & { _index: number }>>();

  applications.forEach((application, index) => {
    const step = application.currentStep ?? stepFromStatus(application.status);
    const items = grouped.get(step) ?? [];
    items.push({ ...application, _index: index });
    grouped.set(step, items);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left - right)
    .map(([step, items]) => ({
      step,
      title: stepTitles[step] ?? "Review",
      applications: items
        .sort((left, right) => {
          const leftFit = left.latestScore?.fit ?? Number.NEGATIVE_INFINITY;
          const rightFit = right.latestScore?.fit ?? Number.NEGATIVE_INFINITY;
          if (rightFit !== leftFit) return rightFit - leftFit;
          return left._index - right._index;
        })
        .map(({ _index, ...application }) => application),
    }));
}
