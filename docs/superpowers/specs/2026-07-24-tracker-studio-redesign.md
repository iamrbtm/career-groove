# Tracker Studio Redesign: Canvas + Progress

Date: 2026-07-24
Status: Approved Design

## Problem

The Tracker Studio at `/applications` is a single ~2000-line component that mixes capture, browse, detail workspace, analytics, and import/export on one page. The left sidebar stacks 5 unrelated cards (readiness, command session, analytics/ops, quick capture, saved roles). The right workspace shows 9 tab sections with deep forms, overwhelming the user with decisions.

Users need a guided step-by-step flow per role that "picks up where they left off," while still allowing flexible access to any step.

## Approach: Canvas + Progress

Keep a slim role list on the left and a stepped card workspace on the right. Each role tracks its current step automatically. Past steps collapse; the current step is prominent and actionable. All steps are expandable for flexibility.

## Layout

### Top Bar
- "Tracker Studio" heading
- A single "Capture Role" button (prominent, primary action)
- No other chrome or tabs

### Left Sidebar (Role List)
- Just the list of saved roles. No readiness card, no analytics, no import/export, no command session card.
- Each role row shows:
  - Title + company
  - Step badge (e.g., "Step 2: Research" or a dot indicator)
  - Readiness: a small colored dot (green = ready to progress, amber = needs something like profile/journey data)
- The list is scrollable. Click a role to open it in the canvas.

### Right Canvas (Workspace)
- **Header**: role title, company, current step label, progress bar (showing steps completed / total)
- **Readiness**: a small health badge next to the title (NOT a full card)
- **Step Accordion**: a vertical stack of step cards:
  - **Completed steps**: collapsed, show checkmark + step name (clickable to expand/review)
  - **Current step**: expanded by default, fully actionable
  - **Future steps**: collapsed, show step name and number (clickable to expand if user needs to jump ahead)
  - All cards are independently expandable/collapsible — the user has full flexibility
- **Analytics ("Pipeline Signals")**: a collapsed accordion at the bottom of the canvas, below all step cards. Default closed. When expanded, shows role-level stats (source health, response rate for similar roles, resume performance). Read-only insights, no forms.

### What Moves Off This Page
- Full analytics dashboard → already at `/analytics` (Analytics Studio)
- Import/Export → behind a gear menu or Settings page
- Command Session → integrated into the step flow (the step cards ARE the session actions)

## Progress System

Each application has a defined step sequence. The "current step" is determined automatically by what's been completed + the application status.

### Step Mapping

| Status(es) | Current Step | What the Card Does |
|---|---|---|
| `saved`, `researching` | **1. Research** | Company research fields (mission, product, red flags, questions). Link to source posting. "Save research" button. |
| `ready_to_apply` | **2. Documents** | Remix summary. Generate resume / cover letter buttons. List of linked drafts with status. Career DJ score relevance. |
| `applied`, `follow_up` | **3. Follow-up** | Follow-up due date picker. Outreach draft generator. Link to send follow-up. |
| `interviewing` | **4. Interview** | Add interview round (type, date, interviewer, link). List of upcoming/past rounds. Link to Soundcheck. |
| `offer` | **5. Decision** | Offer details (salary, deadline, schedule, remote policy). Quick Accept / Decline buttons. Convert to Journey chapter. |
| `rejected`, `withdrawn` | **6. Closed** | Outcome log. Rejection review (if applicable). Archive button. |

### Step Transitions
- A "Mark Complete" / "Save & Advance" button at the bottom of each step card
- Completing a step updates the application status and moves the current step forward
- The user can also change the status directly (via a compact dropdown in the header), which recalculates the current step
- Skipping a step is valid (e.g., go straight from saved → applied if no research needed)

## The Step Cards

Each card has a consistent structure:
1. Step number + title (always visible, even when collapsed)
2. Status indicators (completed checkmark, "current" badge, or future dim)
3. Action content (expanded form)
4. Footer with "Save & Advance" or "Mark Complete" button

### Step 1: Research
- Research fields: mission/company angle, product/market notes, reasons for interest, red flags, questions to ask
- "Save Research" button
- Link to original posting
- "Skip Research" option that advances to Documents

### Step 2: Documents
- Remix summary (call / refresh button)
- "Generate Resume" / "Generate Cover Letter" buttons
- List of linked drafts with status badges
- Career DJ score display (fit, readiness, timing)
- "Mark Documents Ready" advances to next step

### Step 3: Follow-up
- Follow-up due date picker
- Outreach draft generator (type selector + "Draft" button)
- Outreach draft textarea (editable after generation)
- "Log Follow-up" button

### Step 4: Interview
- Add interview round form (type, scheduled at, interviewer, meeting link, notes)
- List of upcoming/past interview rounds
- Link to Soundcheck (mock interview)
- "Log Interview" / "Move to Decision" buttons

### Step 5: Decision
- Offer details form (salary, bonus, benefits, location, schedule, remote policy, start date, decision deadline, negotiation status)
- Quick "Accept" / "Decline" buttons
- Stage conversion to Journey chapter
- "Save Decision" button

### Step 6: Closed
- Outcome log form (outcome type, stage, reason, source, role fit reflection)
- Rejection review card (if applicable)
- "Archive Role" button

## Capture Flow

### The "Capture Role" Button
- Located in the top bar
- Opens a modal (or inline slide-over)

### The Modal
- **Two inputs**: URL (optional) and Job Description (optional) — at least one must be filled
- **"Parse & Save" button** — triggers server-side parsing

### Parsing Priority
1. If URL is provided: server fetches the page content, saves HTML to a temp file, parses it with the AI extractor, then deletes the temp file. The description field, if also provided, is used as supplemental context.
2. If only description: parses directly from the text
3. If both: URL takes priority for fetching, description supplements

### After Save
- The role appears in the sidebar
- The canvas opens to Step 1 showing the parsed result + Career DJ score
- If the user wants to edit parsed fields (title, company, location, salary, etc.), there's an "Edit details" expandable section within Step 1

## Data Model Changes

### Applications table
- Add column: `current_step` (integer, nullable — 1-6 or null for auto-calculated)
- If null, the step is derived from status (backward compatible)
- If set, it overrides the auto-calculation (user can manually set their step)

### API Changes
- `GET /api/applications` — include `currentStep` in response
- `POST /api/applications` — accept URL-based capture, return parsed result
- `POST /api/applications/parse-from-url` — new endpoint: fetch URL, parse, return extracted fields without saving
- `PATCH /api/applications/:id/step` — new endpoint: update current_step

## Component Architecture

Break the monolithic `application-tracker.tsx` (~2000 lines) into focused components:

```
components/tracker/
  tracker-shell.tsx          # Top bar + layout shell
  role-list.tsx              # Left sidebar role list with progress badges
  role-list-item.tsx         # Single role row in the list
  canvas-workspace.tsx       # Right canvas container
  canvas-header.tsx          # Role header + progress bar
  step-accordion.tsx         # Accordion wrapper for step cards
  step-card.tsx              # Reusable step card (collapsible)
  steps/
    research-step.tsx        # Step 1: Research
    documents-step.tsx       # Step 2: Documents
    followup-step.tsx        # Step 3: Follow-up
    interview-step.tsx       # Step 4: Interview
    decision-step.tsx        # Step 5: Decision
    closed-step.tsx          # Step 6: Closed
  capture-modal.tsx          # Capture role modal
  pipeline-signals.tsx       # Collapsed analytics accordion
```

## Migration

- The existing `application-tracker.tsx` is replaced by the new component structure
- Existing applications without `current_step` default to auto-calculation from status
- No database migration needed (nullable column add is optional; step can be derived)
- The old quick-capture form, readiness card, command session card, and ops card are removed from this page

## Edge Cases

- **No roles yet**: The canvas shows an empty state with a prompt to capture the first role
- **All steps complete**: The canvas shows a "Completed" state with option to archive or keep tracking
- **Status changed externally** (e.g., from API or another session): step recalculates on next load
- **URL fetch fails**: fall back to description-only parsing with a clear error message about the URL
- **Step skipped**: user can change status directly, which recalculates the step; no data is lost
