<script lang="ts">
  import { ArrowLeft, Archive, CalendarPlus, Check, ExternalLink, FilePlus, Plus, Save, Users } from "lucide-svelte";
  import {
    ACTION_TYPES,
    OUTCOMES,
    STAGES,
    actionLabels,
    outcomeLabels,
    stageBadgeClass,
    stageLabels,
    type ActionType,
    type Outcome,
    type Stage,
  } from "#lib/workflow";
  import { formatDate, formatDateTime, isOverdue, relativeDue, toDateInput } from "#lib/format";

  let { data, form } = $props();
  const app = $derived(data.application);
  const currentStage = $derived(app.stage as Stage);
</script>

<svelte:head><title>{app.company} — CareerGroove</title></svelte:head>

<a class="back" href="/applications"><ArrowLeft size={15} /> Applications</a>

{#if form?.error}
  <p class="error mt-2" role="alert">{form.error}</p>
{/if}

<header class="detail-head mt-2">
  <div>
    <div class="row">
      <span class={stageBadgeClass(app.stage)}>{stageLabels[currentStage]}</span>
      {#if app.outcome}
        <span class="badge">{outcomeLabels[app.outcome as Outcome] ?? app.outcome}</span>
      {/if}
      {#if app.workMode}<span class="badge">{app.workMode}</span>{/if}
    </div>
    <h1 class="mt-1">{app.company}</h1>
    <p class="role-title">{app.title}</p>
    <div class="row small muted mt-1">
      {#if app.location}<span>{app.location}</span>{/if}
      {#if app.salaryMin || app.salaryMax}
        <span>{app.salaryCurrency} {app.salaryMin?.toLocaleString() ?? "?"}–{app.salaryMax?.toLocaleString() ?? "?"}</span>
      {/if}
      {#if app.sourceUrl}
        <a href={app.sourceUrl} target="_blank" rel="noreferrer">Source <ExternalLink size={12} /></a>
      {/if}
    </div>
  </div>
  <div class="next-box panel panel-pad">
    <p class="micro">Next action</p>
    {#if app.nextActionType}
      <p class="mono next-action">{actionLabels[app.nextActionType as ActionType] ?? app.nextActionType}</p>
      <p class="small" class:text-rust={isOverdue(app.nextActionDueAt)}>{relativeDue(app.nextActionDueAt)} · {formatDate(app.nextActionDueAt)}</p>
      {#if app.nextActionNote}<p class="small muted mt-1">{app.nextActionNote}</p>{/if}
    {:else}
      <p class="mono next-action">Not set</p>
      <p class="small muted">Set one below so this does not stall.</p>
    {/if}
  </div>
</header>

<section class="grid-2 mt-3">
  <div class="panel panel-pad">
    <p class="kicker">Stage</p>
    <h2>Move the application</h2>
    <form method="POST" action="?/stage" class="stack mt-2">
      <label class="field">
        <span class="label">Stage</span>
        <select class="select" name="stage" value={app.stage}>
          {#each STAGES as stage}
            <option value={stage}>{stageLabels[stage]}</option>
          {/each}
        </select>
      </label>
      <label class="field">
        <span class="label">Outcome (decision stage only)</span>
        <select class="select" name="outcome">
          <option value="">None</option>
          {#each OUTCOMES as outcome}
            <option value={outcome} selected={app.outcome === outcome}>{outcomeLabels[outcome]}</option>
          {/each}
        </select>
      </label>
      <button class="btn btn-primary" type="submit"><Save size={15} /> Update stage</button>
    </form>
  </div>

  <div class="panel panel-pad">
    <p class="kicker">Next action</p>
    <h2>Set the next step</h2>
    <form method="POST" action="?/next" class="stack mt-2">
      <label class="field">
        <span class="label">Action</span>
        <select class="select" name="nextType">
          <option value="">No next action</option>
          {#each ACTION_TYPES as type}
            <option value={type} selected={app.nextActionType === type}>{actionLabels[type]}</option>
          {/each}
        </select>
      </label>
      <label class="field">
        <span class="label">Due</span>
        <input class="input" type="date" name="nextDue" value={toDateInput(app.nextActionDueAt)} />
      </label>
      <label class="field">
        <span class="label">Note</span>
        <input class="input" name="nextNote" value={app.nextActionNote ?? ""} placeholder="What exactly needs to happen?" />
      </label>
      <button class="btn" type="submit"><Save size={15} /> Save next action</button>
    </form>

    {#if app.nextActionType}
      <details class="mt-2">
        <summary class="btn btn-sm btn-primary"><Check size={14} /> Complete this action</summary>
        <form method="POST" action="?/complete" class="stack mt-2">
          <label class="field">
            <span class="label">Then do next</span>
            <select class="select" name="nextType">
              <option value="">No next action yet</option>
              {#each ACTION_TYPES as type}
                <option value={type}>{actionLabels[type]}</option>
              {/each}
            </select>
          </label>
          <label class="field">
            <span class="label">Due</span>
            <input class="input" type="date" name="nextDue" />
          </label>
          <label class="field">
            <span class="label">Note</span>
            <input class="input" name="nextNote" />
          </label>
          <button class="btn btn-primary btn-sm" type="submit">Complete action</button>
        </form>
      </details>
    {/if}
  </div>
</section>

<section class="panel panel-pad mt-3">
  <div class="row-between">
    <div>
      <p class="kicker">Overview</p>
      <h2>Details and fit</h2>
    </div>
  </div>
  <dl class="meta-grid mt-2">
    <div><dt>Location</dt><dd>{app.location ?? "—"}</dd></div>
    <div><dt>Work mode</dt><dd>{app.workMode ?? "—"}</dd></div>
    <div><dt>Salary</dt><dd>{app.salaryMin || app.salaryMax ? `${app.salaryCurrency} ${app.salaryMin?.toLocaleString() ?? "?"}–${app.salaryMax?.toLocaleString() ?? "?"}` : "—"}</dd></div>
    <div><dt>Updated</dt><dd>{formatDate(app.updatedAt)}</dd></div>
  </dl>

  {#if app.fitSummary}
    <h3 class="mt-3">Fit summary</h3>
    <p class="prose">{app.fitSummary}</p>
  {/if}

  {#if app.jobDescription}
    <h3 class="mt-3">Job description</h3>
    <div class="prose jd">{app.jobDescription}</div>
  {/if}

  <details class="mt-3">
    <summary class="btn btn-sm">Edit details</summary>
    <form method="POST" action="?/update" class="stack mt-2">
      <div class="grid-2">
        <label class="field"><span class="label">Company</span><input class="input" name="company" value={app.company} required /></label>
        <label class="field"><span class="label">Role title</span><input class="input" name="title" value={app.title} required /></label>
        <label class="field"><span class="label">Location</span><input class="input" name="location" value={app.location ?? ""} /></label>
        <label class="field">
          <span class="label">Work mode</span>
          <select class="select" name="workMode">
            <option value="">Not set</option>
            <option value="remote" selected={app.workMode === "remote"}>Remote</option>
            <option value="hybrid" selected={app.workMode === "hybrid"}>Hybrid</option>
            <option value="onsite" selected={app.workMode === "onsite"}>On-site</option>
          </select>
        </label>
        <label class="field"><span class="label">Salary min</span><input class="input" type="number" name="salaryMin" value={app.salaryMin ?? ""} /></label>
        <label class="field"><span class="label">Salary max</span><input class="input" type="number" name="salaryMax" value={app.salaryMax ?? ""} /></label>
        <label class="field"><span class="label">Source URL</span><input class="input" type="url" name="sourceUrl" value={app.sourceUrl ?? ""} /></label>
      </div>
      <label class="field"><span class="label">Fit summary</span><textarea class="textarea" name="fitSummary">{app.fitSummary ?? ""}</textarea></label>
      <label class="field"><span class="label">Job description</span><textarea class="textarea" name="jobDescription" rows="8">{app.jobDescription ?? ""}</textarea></label>
      <button class="btn btn-primary" type="submit"><Save size={15} /> Save details</button>
    </form>
  </details>
</section>

<section class="panel panel-pad mt-3">
  <div class="row-between">
    <div><p class="kicker">Documents</p><h2>Tailored files</h2></div>
    <a class="btn btn-sm btn-primary" href={`/documents/new?applicationId=${app.id}`}><FilePlus size={14} /> New document</a>
  </div>
  {#if data.documents.length === 0}
    <p class="small muted mt-2">No documents linked yet. Generate a tailored resume or cover letter.</p>
  {:else}
    <div class="stack mt-2">
      {#each data.documents as doc}
        <a class="card-flat row-between" href={`/documents/${doc.id}`}>
          <span class="mono small">{doc.title}</span>
          <span class="badge">{doc.kind}</span>
        </a>
      {/each}
    </div>
  {/if}
</section>

<section class="panel panel-pad mt-3">
  <div class="row-between">
    <div><p class="kicker">Timeline</p><h2>What happened</h2></div>
  </div>
  <form method="POST" action="?/note" class="row mt-2">
    <input class="input flex-1" name="body" placeholder="Add a note to the timeline" required />
    <button class="btn btn-sm" type="submit"><Plus size={14} /> Add note</button>
  </form>
  <div class="timeline mt-3">
    {#each data.events as event}
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div>
          <p class="mono small">{event.title}</p>
          {#if event.body}<p class="small muted">{event.body}</p>{/if}
          <p class="micro">{formatDateTime(event.occurredAt)}</p>
        </div>
      </div>
    {/each}
  </div>
</section>

<section class="panel panel-pad mt-3">
  <div class="row-between">
    <div><p class="kicker">Interviews</p><h2>Conversations</h2></div>
  </div>
  {#if data.interviews.length > 0}
    <div class="stack mt-2">
      {#each data.interviews as interview}
        <a class="card-flat row-between" href={`/interview/${interview.id}`}>
          <div>
            <p class="mono small">{interview.round} · {formatDateTime(interview.scheduledAt)}</p>
            <p class="small muted">{interview.interviewerName ?? "Interviewer TBD"} · {interview.location ?? interview.meetingUrl ?? "Location TBD"}</p>
          </div>
          <span class="badge">{interview.status}</span>
        </a>
      {/each}
    </div>
  {/if}
  <details class="mt-2">
    <summary class="btn btn-sm"><CalendarPlus size={14} /> Add interview</summary>
    <form method="POST" action="?/addInterview" class="stack mt-2">
      <div class="grid-2">
        <label class="field"><span class="label">Round</span><select class="select" name="round"><option value="screen">Screen</option><option value="hiring_manager">Hiring manager</option><option value="technical">Technical</option><option value="panel">Panel</option><option value="final">Final</option></select></label>
        <label class="field"><span class="label">When</span><input class="input" type="datetime-local" name="scheduledAt" /></label>
        <label class="field"><span class="label">Location</span><input class="input" name="location" placeholder="Video, office, phone" /></label>
        <label class="field"><span class="label">Meeting URL</span><input class="input" type="url" name="meetingUrl" /></label>
        <label class="field"><span class="label">Interviewer</span><input class="input" name="interviewerName" /></label>
        <label class="field"><span class="label">Interviewer email</span><input class="input" type="email" name="interviewerEmail" /></label>
      </div>
      <label class="field"><span class="label">Prep notes</span><textarea class="textarea" name="prepNotes"></textarea></label>
      <button class="btn btn-primary" type="submit">Add interview</button>
    </form>
  </details>
</section>

<section class="panel panel-pad mt-3">
  <div class="row-between">
    <div><p class="kicker">People</p><h2>Contacts on this role</h2></div>
    <a class="btn btn-sm" href="/tools/network"><Users size={14} /> Network</a>
  </div>
  {#if data.people.length > 0}
    <div class="stack mt-2">
      {#each data.people as person}
        <div class="card-flat row-between">
          <div>
            <p class="mono small">{person.contact.name}</p>
            <p class="small muted">{person.contact.role ?? "Contact"} {person.contact.company ? `· ${person.contact.company}` : ""}</p>
          </div>
          <span class="badge">{person.relationship ?? "linked"}</span>
        </div>
      {/each}
    </div>
  {/if}
  <div class="grid-2 mt-2">
    <details>
      <summary class="btn btn-sm">Link existing contact</summary>
      <form method="POST" action="?/linkContact" class="stack mt-2">
        <label class="field">
          <span class="label">Contact</span>
          <select class="select" name="contactId">
            {#each data.allContacts as contact}
              <option value={contact.id}>{contact.name}{contact.company ? ` — ${contact.company}` : ""}</option>
            {/each}
          </select>
        </label>
        <label class="field"><span class="label">Relationship</span><input class="input" name="relationship" placeholder="Recruiter, referral, hiring manager" /></label>
        <button class="btn btn-sm" type="submit">Link contact</button>
      </form>
    </details>
    <details>
      <summary class="btn btn-sm">Add new contact</summary>
      <form method="POST" action="?/addContact" class="stack mt-2">
        <label class="field"><span class="label">Name</span><input class="input" name="name" required /></label>
        <label class="field"><span class="label">Email</span><input class="input" type="email" name="email" /></label>
        <label class="field"><span class="label">Role</span><input class="input" name="role" /></label>
        <label class="field"><span class="label">Company</span><input class="input" name="company" /></label>
        <label class="field"><span class="label">Relationship</span><input class="input" name="relationship" /></label>
        <button class="btn btn-sm btn-primary" type="submit">Add and link</button>
      </form>
    </details>
  </div>
</section>

<section class="panel panel-pad mt-3">
  <div class="row-between">
    <div><p class="kicker">Research</p><h2>Company and role notes</h2></div>
  </div>
  {#if data.research.length > 0}
    <div class="stack mt-2">
      {#each data.research as note}
        <div class="card-flat">
          <p class="mono small">{note.title}</p>
          {#if note.body}<p class="small mt-1">{note.body}</p>{/if}
          {#if note.sourceUrl}<a class="small" href={note.sourceUrl} target="_blank" rel="noreferrer">Source <ExternalLink size={11} /></a>{/if}
        </div>
      {/each}
    </div>
  {/if}
  <details class="mt-2">
    <summary class="btn btn-sm"><Plus size={14} /> Add research note</summary>
    <form method="POST" action="?/addResearch" class="stack mt-2">
      <label class="field"><span class="label">Title</span><input class="input" name="title" required /></label>
      <label class="field"><span class="label">Company</span><input class="input" name="company" value={app.company} /></label>
      <label class="field"><span class="label">Notes</span><textarea class="textarea" name="body" rows="5"></textarea></label>
      <label class="field"><span class="label">Source URL</span><input class="input" type="url" name="sourceUrl" /></label>
      <button class="btn btn-primary btn-sm" type="submit">Save research</button>
    </form>
  </details>
</section>

<section class="mt-4 danger-zone">
  <details>
    <summary class="btn btn-sm btn-danger"><Archive size={14} /> Archive application</summary>
    <form method="POST" action="?/archive" class="mt-2">
      <button class="btn btn-danger" type="submit">Archive this application</button>
    </form>
  </details>
</section>

<style>
  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .detail-head {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .role-title {
    font-family: var(--mono);
    font-size: 17px;
    font-weight: 700;
  }

  .next-box {
    background: var(--panel);
  }

  .next-action {
    font-size: 18px;
    font-weight: 800;
    margin-top: 2px;
  }

  .meta-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .meta-grid dt {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
  }

  .meta-grid dd {
    font-size: 14px;
  }

  .jd {
    max-height: 420px;
    overflow: auto;
    padding: 12px;
    border: 2px solid var(--ink);
    background: var(--paper-2);
    white-space: pre-wrap;
  }

  .timeline {
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-left: 3px solid var(--ink);
    padding-left: 16px;
  }

  .timeline-item {
    display: flex;
    gap: 12px;
    position: relative;
  }

  .timeline-dot {
    position: absolute;
    left: -24px;
    top: 4px;
    width: 12px;
    height: 12px;
    border: 3px solid var(--ink);
    border-radius: 50%;
    background: var(--green);
  }

  .danger-zone {
    opacity: 0.8;
  }

  @media (min-width: 720px) {
    .detail-head {
      flex-direction: row;
      justify-content: space-between;
      align-items: flex-start;
    }

    .next-box {
      width: 320px;
      flex: 0 0 auto;
    }

    .meta-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
</style>
