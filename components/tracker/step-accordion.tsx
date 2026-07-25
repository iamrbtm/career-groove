"use client";

import type { ReactNode } from "react";

export function StepAccordion({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
