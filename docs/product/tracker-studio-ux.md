# Tracker Studio Product Contract

Generated: 2026-07-24

Tracker Studio turns saved opportunities into a guided job-search workflow. It must feel like a continuation of CareerGroove, not a separate project-management board.

## Navigation

Use `Applications` as the clear top-level label. `Tracker Studio` can appear as a page eyebrow or product concept, and `Command Session` is the dashboard entry point for daily action.

## Layout: Canvas + Progress

The main page uses a split layout: a slim role list (left) and a stepped accordion workspace (right). Each role shows a small readiness badge. Selecting a role opens its step-by-step progress in the canvas.

## 6-Step Workflow

Each application moves through 6 numbered steps in a vertical accordion. Past steps collapse. The current step is highlighted and auto-expanded. All steps remain expandable to revisit.

| Step | Title | What happens |
| --- | --- | --- |
| 1 | Research | View job description, source URL, key metadata. Skip advances to step 2. |
| 2 | Documents | Score breakdown, document list + generation status. "Mark ready" sets status to `ready_to_apply`. |
| 3 | Follow-up | Set a follow-up reminder date and draft outreach notes via AI. |
| 4 | Interview | Log interviews (round type, scheduled date, prep status). |
| 5 | Decision | Record offer details (salary, bonus, benefits) and negotiation status. |
| 6 | Closed | View rejection intelligence or manually archive. |

Each step handles its own data and API calls. The page orchestrates refresh and advance.

## Capture

A single "Capture Role" button opens a modal accepting a URL (auto-fetched and parsed) or a raw description. One field is required.

## Status Model

| Status | Label | Pipeline column | Allowed next actions |
| --- | --- | --- | --- |
| `saved` | Saved | Saved | research_company, remix_resume, contact_referral, apply, archive_role |
| `researching` | Researching | Preparing | research_company, contact_referral, remix_resume, apply, archive_role |
| `ready_to_apply` | Ready to apply | Preparing | remix_resume, draft_cover_letter, answer_questions, apply, archive_role |
| `applied` | Applied | Applied | follow_up, contact_referral, prep_interview, log_outcome |
| `follow_up` | Follow-up | Applied | follow_up, contact_referral, prep_interview, log_outcome |
| `interviewing` | Interviewing | Interviewing | prep_interview, follow_up, log_outcome, compare_offer |
| `offer` | Offer | Offer | compare_offer, log_outcome |
| `rejected` | Rejected | Closed | review_rejection, archive_role |
| `withdrawn` | Withdrawn | Closed | archive_role |
| `archived` | Archived | Archived | capture_job |

## Career DJ Labels

| Label | Trigger | Copy | Recommended action |
| --- | --- | --- | --- |
| Apply First | Strong fit, enough evidence, low risk | This role looks worth attention now. | apply |
| Research Before Applying | Interesting role with missing company or team context | Learn one concrete thing before spending document time. | research_company |
| Remix Resume First | Fit exists but materials need sharper evidence | Tune the resume toward this role before applying. | remix_resume |
| Network First | Referral or recruiter leverage is likely valuable | A person may improve the odds here. | contact_referral |
| Stretch Role | Higher-scope role with meaningful upside | Treat this as a reach and close the biggest evidence gap. | remix_resume |
| Low-Signal Lead | Sparse description or unclear match | Get more signal before committing time. | research_company |
| Probably Skip | Low fit, high risk, or poor preference match | This may not repay the attention it asks for. | archive_role |
| Follow-Up Now | Applied role has a due or overdue reminder | Send a concise follow-up or log why not. | follow_up |
| Prep Mode | Interview is upcoming or active | Practice with the role context loaded. | prep_interview |

## Command Session Actions

Every action stores `application_id` when relevant, a route target, completion event, and optional skip reason.

Actions: `capture_job`, `research_company`, `remix_resume`, `draft_cover_letter`, `answer_questions`, `apply`, `follow_up`, `contact_referral`, `prep_interview`, `log_outcome`, `review_rejection`, `compare_offer`, `archive_role`.

Session modes:

- Light: 1 to 2 actions.
- Standard: 3 actions.
- Deep: 4 to 5 actions.
- Recovery: 1 low-pressure action focused on logging, archiving, or one next step.
- Interview: role-specific prep and follow-up actions first.

## Natural Flow Rules

- Guide before grid.
- Put one next action on each card.
- Show progressive detail: recommendation first, raw data later.
- Use friendly but clear language.
- Do not force setup before first value.
- Treat skip and snooze as valid choices.
- Keep rejection handling low-pressure and optional.
- Use clear workflow labels first: Applications, Follow-Up, Interviews, Offers, Rejections.
- Use CareerGroove flavor as seasoning: Today's Mix, Setlist, Remix, Soundcheck, Encore Watch.
