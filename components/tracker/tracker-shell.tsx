"use client";

import type { ReactNode } from "react";

export function TrackerShell({ roleList, canvas }: { roleList: ReactNode; canvas: ReactNode }) {
  return (
    <div className="mt-7 grid gap-5 xl:grid-cols-[320px_1fr]">
      <div className="space-y-4">{roleList}</div>
      <div>{canvas}</div>
    </div>
  );
}
