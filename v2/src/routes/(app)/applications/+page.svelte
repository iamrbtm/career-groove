<script lang="ts">
  import { Plus, Search, SlidersHorizontal } from "lucide-svelte";
  import {
    STAGES,
    stageLabels,
    actionLabels,
    type Stage,
  } from "#lib/workflow";
  import { relativeDue, isOverdue, stageBadgeClass } from "#lib/format";

  let { data, form } = $props();

  function filterHref(stage: Stage | null) {
    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (data.q) params.set("q", data.q);
    if (data.due) params.set("due", "1");
    if (data.view === "list") params.set("view", "list");
    const qs = params.toString();
    return `/applications${qs ? `?${qs}` : ""}`;
  }

  function viewHref(view: "board" | "list") {
    const params = new URLSearchParams();
    if (view === "list") params.set("view", "list");
    if (data.stage) params.set("stage", data.stage);
    if (data.q) params.set("q", data.q);
    if (data.due) params.set("due", "1");
    const qs = params.toString();
    return `/applications${qs ? `?${qs}` : ""}`;
  }
</script>

<svelte:head><title>Applications — CareerGroove</title></svelte:head>

<header class="row-between">
  <div>
    <p class="kicker">Applications</p>
    <h1>Pipeline</h1>
    <p class="muted">Every opportunity, one canonical stage.</p>
  </div>
  <a class="btn btn-primary" href="/applications?new=1"><Plus size={16} /> Add a lead</a>
</header>

{#if form?.error}
  <p class="error mt-2" role="alert">{form.error}</p>
{/if}

{#if data.newLead}
  <section class="panel panel-pad mt-3">
    <div class="row-between">
      <div>
        <p class="kicker">New lead</p>
        <h2>Add an opportunity</h2>
      </div>
      <a class="btn btn-ghost btn-sm" href={filterHref(data.stage as Stage | null)}>Close</a>
    </div>
    <form method="POST" action="?/create" class="stack mt-2">
      <div class="grid-2">
        <label class="field">
          <span class="label">Company *</span>
          <input class="input" name="company" required placeholder="Acme Corp" />
        </label>
        <label class="field">
          <span class="label">Role title *</span>
          <input class="input" name="title" required placeholder="Senior Product Designer" />
        </label>
        <label class="field">
          <span class="label">Location</span>
          <input class="input" name="location" placeholder="Portland, OR or Remote" />
        </label>
        <label class="field">
          <span class="label">Work mode</span>
          <select class="select" name="workMode">
            <option value="">Not set</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
        </label>
        <label class="field">
          <span class="label">Salary min</span>
          <input class="input" name="salaryMin" type="number" min="0" step="1000" placeholder="90000" />
        </label>
        <label class="field">
          <span class="label">Salary max</span>
          <input class="input" name="salaryMax" type="number" min="0" step="1000" placeholder="120000" />
        </label>
        <label class="field">
          <span class="label">Source URL</span>
          <input class="input" name="sourceUrl" type="url" placeholder="https://…" />
        </label>
        <label class="field">
          <span class="label">Starting stage</span>
          <select class="select" name="stage">
            {#each STAGES as stage}
              <option value={stage}>{stageLabels[stage]}</option>
            {/each}
          </select>
        </label>
      </div>
      <label class="field">
        <span class="label">Job description</span>
        <textarea class="textarea" name="jobDescription" rows="5" placeholder="Paste the job description here"></textarea>
      </label>
      <div class="row">
        <button class="btn btn-primary" type="submit">Create lead</button>
        <a class="btn btn-ghost" href="/applications/import">Import from email or URL</a>
      </div>
    </form>
  </section>
{/if}

<section class="mt-3">
  <form method="GET" class="row">
    <label class="field flex-1">
      <span class="label">Search</span>
      <input class="input" type="search" name="q" value={data.q} placeholder="Company, role, location" />
    </label>
    {#if data.stage}<input type="hidden" name="stage" value={data.stage} />{/if}
    {#if data.due}<input type="hidden" name="due" value="1" />{/if}
    {#if data.view === "list"}<input type="hidden" name="view" value="list" />{/if}
    <button class="btn" type="submit"><Search size={16} /> Search</button>
  </form>

  <div class="row-between mt-2">
    <div class="row">
      <a class="badge" class:badge-ok={!data.stage && !data.due} href={filterHref(null)}>All</a>
      {#each STAGES as stage}
        <a class={stageBadgeClass(stage)} class:active-filter={data.stage === stage} href={filterHref(stage)}>
          {stageLabels[stage]} {data.counts[stage]}
        </a>
      {/each}
      <a class="badge" class:badge-due={data.due} href={`/applications?${new URLSearchParams({ ...(data.stage ? { stage: data.stage } : {}), due: data.due ? "" : "1", ...(data.q ? { q: data.q } : {}) }).toString()}`}>
        Needs attention
      </a>
    </div>
    <div class="row">
      <a class="btn btn-sm" class:btn-primary={data.view === "board"} href={viewHref("board")}>Board</a>
      <a class="btn btn-sm" class:btn-primary={data.view === "list"} href={viewHref("list")}>List</a>
    </div>
  </div>
</section>

{#if data.apps.length === 0}
  <div class="empty mt-3">
    <SlidersHorizontal size={26} />
    <h3 class="mt-1">No applications match.</h3>
    <p class="muted">Try clearing filters or add a lead.</p>
    <a class="btn btn-primary mt-2" href="/applications?new=1"><Plus size={16} /> Add a lead</a>
  </div>
{:else if data.view === "board"}
  <div class="board mt-3">
    {#each STAGES as stage}
      {@const items = data.apps.filter((app) => app.stage === stage)}
      <section class="board-col">
        <div class="board-head">
          <span class={stageBadgeClass(stage)}>{stageLabels[stage]}</span>
          <span class="mono small muted">{items.length}</span>
        </div>
        <div class="stack">
          {#each items as app}
            <a class="card app-card" href={`/applications/${app.id}`}>
              <p class="micro">{app.company}</p>
              <p class="mono app-title">{app.title}</p>
              {#if app.location}<p class="small muted">{app.location}</p>{/if}
              {#if app.nextActionType}
                <div class="row-between mt-1">
                  <span class="small">{actionLabels[app.nextActionType as keyof typeof actionLabels] ?? app.nextActionType}</span>
                  <span class="small" class:text-rust={isOverdue(app.nextActionDueAt)}>{relativeDue(app.nextActionDueAt)}</span>
                </div>
              {:else}
                <p class="small muted mt-1">No next action</p>
              {/if}
            </a>
          {/each}
          {#if items.length === 0}
            <p class="small muted board-empty">Nothing here.</p>
          {/if}
        </div>
      </section>
    {/each}
  </div>
{:else}
  <div class="table-wrap mt-3">
    <table>
      <thead>
        <tr><th>Company</th><th>Role</th><th>Stage</th><th>Next action</th><th>Due</th></tr>
      </thead>
      <tbody>
        {#each data.apps as app}
          <tr>
            <td><a class="mono" href={`/applications/${app.id}`}>{app.company}</a></td>
            <td>{app.title}</td>
            <td><span class={stageBadgeClass(app.stage)}>{stageLabels[app.stage]}</span></td>
            <td>{app.nextActionType ? actionLabels[app.nextActionType as keyof typeof actionLabels] ?? app.nextActionType : "—"}</td>
            <td class:text-rust={isOverdue(app.nextActionDueAt)}>{relativeDue(app.nextActionDueAt)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .active-filter {
    outline: 3px solid var(--rust);
    outline-offset: 2px;
  }

  .board {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(250px, 1fr);
    gap: 14px;
    overflow-x: auto;
    padding-bottom: 8px;
    align-items: start;
  }

  .board-col {
    min-width: 250px;
  }

  .board-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .app-card {
    padding: 12px;
  }

  .app-title {
    font-weight: 800;
    font-size: 14px;
    margin-top: 2px;
  }

  .board-empty {
    border: 2px dashed rgba(16, 16, 13, 0.25);
    padding: 14px;
    text-align: center;
  }
</style>
