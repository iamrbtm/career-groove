# Tracker Studio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic ApplicationTracker (~2000 lines) with a Canvas + Progress layout: slim role list on the left, stepped accordion workspace on the right, each role remembering where it left off.

**Architecture:** Break the monolith into focused components under `components/tracker/`. Add `current_step` to the applications API for progress tracking. Add URL-based capture endpoint. The step system maps application status to a 6-step sequence.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL (via raw SQL), existing API routes.

## Global Constraints

- Copy style: use the same tone as existing components ("Career DJ", "remix", "soundcheck")
- Follow existing Tailwind patterns (rounded-3xl cards, shadow-pop, ink/coral/mint/sun/plum colors)
- Existing applications without `current_step` should auto-derive from status
- The old `application-tracker.tsx` stays until the new component is fully wired, then gets deleted
- No new external dependencies

---

### Task 1: API — Add current_step + URL parse endpoint

**Files:**
- Create: `db/migrations/XXX_add_current_step.sql`
- Modify: `lib/tracker-studio.ts`
- Modify: `app/api/applications/route.ts`
- Modify: `app/api/applications/[id]/route.ts`
- Create: `app/api/applications/parse-url/route.ts`

**Interfaces:**
- Consumes: existing `PoolClient`, auth session
- Produces: `currentStep` field on Application objects, `PATCH /api/applications/:id/step`, `POST /api/applications/parse-url`

- [ ] **Step 1: Write the SQL migration**

```sql
ALTER TABLE applications ADD COLUMN IF NOT EXISTS current_step integer;
```

- [ ] **Step 2: Update `refreshApplicationScore` to set current_step**

In `lib/tracker-studio.ts`, after the score is computed and inserted, derive `currentStep` from the application status:

```typescript
const stepFromStatus: Record<string, number> = {
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
```

Set it in the UPDATE query and include it in the return value.

- [ ] **Step 3: Update GET /api/applications to return currentStep**

In `app/api/applications/route.ts`, add `current_step AS "currentStep"` to the SELECT query.

- [ ] **Step 4: Add PATCH /api/applications/:id/step endpoint**

In `app/api/applications/[id]/route.ts`, handle a new `step` field:

```typescript
if (body.step !== undefined) {
  await client.query(
    `UPDATE applications SET current_step=$1, updated_at=now() WHERE id=$2 AND user_id=$3`,
    [body.step, applicationId, userId],
  );
}
```

- [ ] **Step 5: Create parse-url API route**

Create `app/api/applications/parse-url/route.ts`:

```typescript
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { url } = await request.json();
  if (!url) return Response.json({ error: "URL is required" }, { status: 400 });
  
  // Fetch the page content, save to temp file
  const response = await fetch(url);
  const html = await response.text();
  const tmpPath = `/tmp/cg-parse-${Date.now()}.html`;
  await fs.writeFile(tmpPath, html);
  
  // Parse with the same AI extractor used for descriptions
  const parsed = await parseJobPosting(html);
  
  // Clean up
  await fs.unlink(tmpPath).catch(() => {});
  
  return Response.json({ parsed });
}
```

Use the existing `parseJobPosting` function from the application parsing logic. If the URL fetch fails, return a clear error. If parsing yields low confidence, indicate that in the response.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add current_step tracking and URL-based job parsing"
```

---

### Task 2: Shared component infrastructure

**Files:**
- Create: `components/tracker/tracker-shell.tsx`
- Create: `components/tracker/role-list.tsx`
- Create: `components/tracker/role-list-item.tsx`
- Create: `components/tracker/canvas-workspace.tsx`
- Create: `components/tracker/canvas-header.tsx`
- Create: `components/tracker/step-accordion.tsx`
- Create: `components/tracker/step-card.tsx`
- Create: `components/tracker/index.ts`

**Interfaces:**
- Consumes: Application types from `@/components/application-tracker`
- Produces: Reusable layout components used by all step cards

- [ ] **Step 1: Create tracker-shell.tsx**

The shell component. Two-column grid layout matching the existing app shell patterns:

```typescript
export function TrackerShell({ roleList, canvas }: { roleList: ReactNode; canvas: ReactNode }) {
  return (
    <div className="mt-7 grid gap-5 xl:grid-cols-[320px_1fr]">
      <div className="space-y-4">{roleList}</div>
      <div>{canvas}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create role-list.tsx + role-list-item.tsx**

RoleList receives the applications array and renders a scrollable list. Each item shows:
- Title + company (truncated)
- Step badge (e.g., "Step 2")
- Readiness dot (green/amber)
- Click handler to select

RoleListItem is a single row. Selected state uses `bg-mint/30 border-ink` like the current design.

- [ ] **Step 3: Create canvas-header.tsx**

Shows role title, company, step label, and a thin progress bar. Compact status dropdown for changing status directly:

```typescript
export function CanvasHeader({
  title, company, currentStep, totalSteps, status, onStatusChange
}: { ... }) {
  return (
    <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-[0_5px_0_#26312c]">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-[var(--font-display)] text-3xl font-black">{title}</h2>
          <p className="text-sm font-bold text-ink/55">{company}</p>
        </div>
        <select value={status} onChange={...} className="rounded-2xl border-2 border-ink bg-cream px-3 py-2 text-sm font-black">
          {...statusOptions}
        </select>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs font-black text-plum uppercase tracking-wider">Step {currentStep} of {totalSteps}</span>
        <div className="h-2 flex-1 rounded-full bg-cream">
          <div className="h-full rounded-full bg-plum" style={{ width: `${(currentStep / totalSteps) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create step-accordion.tsx + step-card.tsx**

StepAccordion wraps a list of StepCards. StepCard is a collapsible container:

```typescript
export function StepCard({
  stepNumber, title, isComplete, isCurrent, isExpanded, onToggle, children
}: { ... }) {
  return (
    <section className={`rounded-3xl border-2 ${isCurrent ? 'border-ink bg-white shadow-[0_5px_0_#26312c]' : 'border-ink/15 bg-white/70'}`}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-5 text-left">
        <div className={`grid size-8 place-items-center rounded-full border-2 border-ink text-xs font-black ${isComplete ? 'bg-mint' : isCurrent ? 'bg-sun' : 'bg-white'}`}>
          {isComplete ? <Check size={16} /> : stepNumber}
        </div>
        <div className="flex-1">
          <p className="font-black">{title}</p>
          {isCurrent && <p className="text-xs font-bold text-plum uppercase tracking-wider">Current step</p>}
        </div>
      </button>
      {isExpanded && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}
```

- [ ] **Step 5: Create index.ts re-export**

```typescript
export { TrackerShell } from './tracker-shell';
export { RoleList } from './role-list';
export { RoleListItem } from './role-list-item';
export { CanvasWorkspace } from './canvas-workspace';
export { CanvasHeader } from './canvas-header';
export { StepAccordion } from './step-accordion';
export { StepCard } from './step-card';
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add tracker shared components (shell, list, canvas, step cards)"
```

---

### Task 3: Capture modal

**Files:**
- Create: `components/tracker/capture-modal.tsx`

- [ ] **Step 1: Build capture-modal.tsx**

A modal overlay with:
- URL input (optional)
- Job description textarea (optional, but one of the two must be filled)
- "Parse & Save" button
- Loading state during parsing
- Edit details expandable section (title, company, location, salary, work mode — all pre-filled from parse result)

```typescript
export function CaptureModal({ open, onClose, onSaved }: {
  open: boolean;
  onClose: () => void;
  onSaved: (application: Application) => void;
}) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<any>(null);
  const [showEdit, setShowEdit] = useState(false);
  // ... form state for manual fields
  // ... submit handler that POSTs to /api/applications
  // ... parse handler that calls /api/applications/parse-url or parse from description
  
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4">
      <div className="w-full max-w-2xl rounded-3xl border-2 border-ink bg-white p-6 shadow-soft">
        {/* URL input */}
        {/* Description textarea */}
        {/* Parse button */}
        {/* Parse result preview */}
        {/* Edit details expandable */}
        {/* Save button */}
      </div>
    </div>
  );
}
```

URL parsing calls `/api/applications/parse-url`. Description-only parsing calls the existing `/api/applications/parse` endpoint. After parsing, the modal shows a preview of what was extracted. The user edits if needed, then clicks Save which POSTs to `/api/applications`. On success, calls `onSaved` and closes.

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add capture modal with URL+description parsing"
```

---

### Task 4: Step cards — Research + Documents

**Files:**
- Create: `components/tracker/steps/research-step.tsx`
- Create: `components/tracker/steps/documents-step.tsx`

- [ ] **Step 1: Create research-step.tsx**

Company research form. Matches the existing research fields from the current ApplicationWorkspaceContent but simplified to just the essentials. Fields: mission/company angle, product/market notes, reasons for interest, red flags, questions. "Save Research" button. "Skip Research" link to advance.

- [ ] **Step 2: Create documents-step.tsx**

Document generation card. Shows:
- Application remix summary (with "Refresh" button)
- "Generate Resume" / "Generate Cover Letter" buttons
- List of linked drafts with status badges
- Career DJ score summary (fit, readiness, timing — small display)
- "Mark Ready" button to advance

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add research and documents step cards"
```

---

### Task 5: Step cards — Follow-up + Interview

**Files:**
- Create: `components/tracker/steps/followup-step.tsx`
- Create: `components/tracker/steps/interview-step.tsx`

- [ ] **Step 1: Create followup-step.tsx**

Follow-up management card:
- Follow-up due date picker (datetime-local)
- Outreach type selector + "Draft" button (calls `/api/ai` with purpose `outreach-draft`)
- Editable outreach draft textarea
- "Log Follow-up" button (PATCH status and save)

- [ ] **Step 2: Create interview-step.tsx**

Interview tracking card:
- Add interview round form (round type, scheduled at, interviewer, meeting link, notes)
- List of upcoming/past rounds
- "Open Soundcheck" link
- "Log Interview" button

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add follow-up and interview step cards"
```

---

### Task 6: Step cards — Decision + Closed + Pipeline Signals

**Files:**
- Create: `components/tracker/steps/decision-step.tsx`
- Create: `components/tracker/steps/closed-step.tsx`
- Create: `components/tracker/pipeline-signals.tsx`

- [ ] **Step 1: Create decision-step.tsx**

Offer decision card:
- Offer details form (salary, bonus, benefits, location, schedule, remote policy, start date, decision deadline, negotiation status)
- Quick "Accept" / "Decline" buttons
- "Stage Journey Chapter" button
- "Save Decision" button

- [ ] **Step 2: Create closed-step.tsx**

Closed/archived role card:
- Outcome log form (outcome type, stage, reason, source, role fit reflection)
- Rejection Intelligence display (if applicable)
- "Archive Role" button

- [ ] **Step 3: Create pipeline-signals.tsx**

Collapsed analytics accordion that lives at the bottom of the canvas:

```typescript
export function PipelineSignals({ analytics }: { analytics: Analytics | null }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-3xl border-2 border-ink/15 bg-white/70">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-5">
        <span className="font-[var(--font-display)] text-xl font-black">Pipeline Signals</span>
        {/* chevron icon */}
      </button>
      {open && (
        <div className="px-5 pb-5">
          {/* Read-only analytics metrics */}
          {/* Source health, response rate, resume performance */}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add decision, closed step cards and pipeline signals"
```

---

### Task 7: Wire it up — replace ApplicationTracker

**Files:**
- Modify: `app/applications/page.tsx`
- Create: `components/tracker/tracker-page.tsx`
- Delete (after): `components/application-tracker.tsx`

- [ ] **Step 1: Create tracker-page.tsx**

The new main page component. Orchestrates all the pieces:

```typescript
export function TrackerPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [session, setSession] = useState<CommandSession | null>(null);
  // ... loading, error state
  
  const selected = applications.find(a => a.id === selectedId);
  const currentStep = selected?.currentStep ?? stepFromStatus(selected?.status);
  
  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <PageHeading eyebrow="Tracker Studio" title="Applications" copy="..." />
        <MotionButton onClick={openCapture} className="...">Capture Role</MotionButton>
      </div>
      
      <TrackerShell
        roleList={
          <RoleList
            applications={applications}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        }
        canvas={
          selected ? (
            <div className="space-y-5">
              <CanvasHeader ... />
              <StepAccordion currentStep={currentStep}>
                <StepCard stepNumber={1} title="Research" ...>
                  <ResearchStep application={selected} onAdvance={...} />
                </StepCard>
                <StepCard stepNumber={2} title="Documents" ...>
                  <DocumentsStep application={selected} ... />
                </StepCard>
                {/* ... more steps */}
              </StepAccordion>
              <PipelineSignals analytics={analytics} />
            </div>
          ) : (
            <EmptyState />
          )
        }
      />
      
      <CaptureModal open={captureOpen} onClose={...} onSaved={handleSaved} />
    </AppShell>
  );
}
```

Fetch applications from `/api/applications`, session from `/api/command-sessions`, supporting data from their respective endpoints — same as the current `ApplicationTracker` but with the new rendering.

- [ ] **Step 2: Update app/applications/page.tsx**

```typescript
import { TrackerPage } from "@/components/tracker/tracker-page";
export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/applications");
  return <TrackerPage />;
}
```

- [ ] **Step 3: Verify the build compiles**

```bash
npm run build
```

Fix any type errors or import issues. Ensure all the step cards, capture modal, and shared components export properly from the index.

- [ ] **Step 4: Delete old application-tracker.tsx**

Remove the monolithic file. Confirm nothing else imports it:

```bash
git grep "application-tracker"
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: wire up new tracker page, replace ApplicationTracker monolith"
```

---

### Task 8: Final cleanup — remove old docs, verify

- [ ] **Step 1: Update the Tracker Studio UX doc**

Update `docs/product/tracker-studio-ux.md` to reflect the new step-based system. The status model, Career DJ labels, and command session actions sections remain relevant. Add a section describing the step system.

- [ ] **Step 2: Run the build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "docs: update tracker studio UX doc for step-based flow"
```
