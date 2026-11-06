<script lang="ts">
  import { BriefcaseBusiness, CalendarClock, Check, Clock, Plus, Search, Sparkles } from "lucide-svelte";
  import { formatDateTime, relativeDue, isOverdue, stageBadgeClass } from "#lib/format";
  import { stageLabels, type Stage } from "#lib/workflow";

  let { data } = $props();
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  function greeting(name: string) {
    const hour = new Date().getHours();
    const part = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
    return `${part}, ${name.split(" ")[0]}`;
  }
</script>

<svelte:head><title>Home — CareerGroove</title></svelte:head>

<header class="row-between">
  <div>
    <p class="kicker">{today}</p>
    <h1>{greeting(data.user.name)}</h1>
    <p class="muted">Here is what needs your attention.</p>
  </div>
  <a class="btn btn-primary" href="/applications?new=1"><Plus size={16} /> Add a lead</a>
</header>

<section class="grid-3 mt-3">
  <a class="panel panel-pad stat-card" href="/applications">
    <p class="micro">Active applications</p>
    <p class="stat">{data.active}</p>
    <p class="small muted">{data.stageCounts.lead} leads · {data.stageCounts.applied} applied</p>
  </a>
  <a class="panel panel-pad stat-card" href="/home#attention">
    <p class="micro">Actions due</p>
    <p class="stat" class:text-rust={data.due.length > 0}>{data.due.length}</p>
    <p class="small muted">{data.due.length ? "Needs attention now" : "All clear"}</p>
  </a>
  <a class="panel panel-pad stat-card" href="/interview">
    <p class="micro">Interviews this week</p>
    <p class="stat">{data.interviewsThisWeek}</p>
    <p class="small muted">{data.interviews.length} upcoming</p>
  </a>
</section>

<section class="mt-4">
  <div class="row-between">
    <div>
      <p class="kicker">Pipeline</p>
      <h2>Stage snapshot</h2>
    </div>
    <a class="btn btn-ghost btn-sm" href="/applications">Open pipeline</a>
  </div>
  <div class="stage-strip mt-2">
    {#each Object.entries(data.stageCounts) as [stage, total]}
      <a class={stageBadgeClass(stage)} href={`/applications?stage=${stage}`}>
        {stageLabels[stage as Stage]} <span class="count">{total}</span>
      </a>
    {/each}
  </div>
</section>

<section id="attention" class="mt-4">
  <div class="row-between">
    <div>
      <p class="kicker">Needs attention</p>
      <h2>Due now</h2>
    </div>
  </div>

  {#if data.due.length === 0}
    <div class="empty mt-2">
      <Sparkles size={26} />
      <h3 class="mt-1">Nothing is due.</h3>
      <p class="muted">Your pipeline is caught up. Add a lead or check research.</p>
      <div class="row mt-2" style="justify-content:center">
        <a class="btn btn-primary" href="/applications?new=1"><Plus size={16} /> Add a lead</a>
        <a class="btn btn-ghost" href="/research"><Search size={16} /> Research</a>
      </div>
    </div>
  {:else}
    <div class="stack mt-2">
      {#each data.due as item}
        <article class="panel panel-pad due-card" class:overdue={isOverdue(item.nextActionDueAt)}>
          <div class="row-between">
            <div>
              <div class="row">
                <span class={stageBadgeClass(item.stage)}>{stageLabels[item.stage as Stage] ?? item.stage}</span>
                <span class="badge badge-due">{data.actionLabels[item.nextActionType as keyof typeof data.actionLabels] ?? "Action"}</span>
              </div>
              <h3 class="mt-1"><a href={`/applications/${item.id}`}>{item.company}</a></h3>
              <p class="small muted">{item.title}</p>
              {#if item.nextActionNote}<p class="small mt-1">{item.nextActionNote}</p>{/if}
            </div>
            <div class="due-side">
              <p class="micro">Due</p>
              <p class="mono due-date" class:text-rust={isOverdue(item.nextActionDueAt)}>
                {relativeDue(item.nextActionDueAt)}
              </p>
              <p class="small muted">{formatDateTime(item.nextActionDueAt)}</p>
            </div>
          </div>

          <div class="row mt-2">
            <a class="btn btn-sm" href={`/applications/${item.id}`}>Open</a>
            <form method="POST" action="?/snooze">
              <input type="hidden" name="id" value={item.id} />
              <button class="btn btn-sm btn-ghost" type="submit"><Clock size={14} /> Snooze 2 days</button>
            </form>
            <details class="complete-options">
              <summary class="btn btn-sm btn-primary"><Check size={14} /> Complete</summary>
              <div class="card-flat mt-2 complete-panel">
                <form method="POST" action="?/complete" class="stack">
                  <input type="hidden" name="id" value={item.id} />
                  <label class="field">
                    <span class="label">Next action</span>
                    <select class="select" name="nextType">
                      <option value="">No next action yet</option>
                      {#each Object.entries(data.actionLabels) as [value, label]}
                        <option value={value}>{label}</option>
                      {/each}
                    </select>
                  </label>
                  <label class="field">
                    <span class="label">Due date</span>
                    <input class="input" type="date" name="nextDue" />
                  </label>
                  <label class="field">
                    <span class="label">Note</span>
                    <input class="input" name="nextNote" placeholder="Optional context" />
                  </label>
                  <button class="btn btn-primary btn-sm" type="submit">Complete action</button>
                </form>
              </div>
            </details>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>

{#if data.upcoming.length > 0}
  <section class="mt-4">
    <p class="kicker">Coming up</p>
    <h2>Next 7 days</h2>
    <div class="stack mt-2">
      {#each data.upcoming as item}
        <a class="card row-between" href={`/applications/${item.id}`}>
          <div class="row">
            <CalendarClock size={18} />
            <div>
              <p class="mono small">{item.company} — {item.title}</p>
              <p class="small muted">{data.actionLabels[item.nextActionType as keyof typeof data.actionLabels] ?? "Action"} · {relativeDue(item.nextActionDueAt)}</p>
            </div>
          </div>
          <span class="badge">{stageLabels[item.stage as Stage] ?? item.stage}</span>
        </a>
      {/each}
    </div>
  </section>
{/if}

{#if data.interviews.length > 0}
  <section class="mt-4">
    <div class="row-between">
      <div>
        <p class="kicker">Interview</p>
        <h2>Upcoming interviews</h2>
      </div>
      <a class="btn btn-ghost btn-sm" href="/interview">All interviews</a>
    </div>
    <div class="stack mt-2">
      {#each data.interviews as interview}
        <a class="card row-between" href={`/interview/${interview.id}`}>
          <div>
            <p class="mono small">{interview.company ?? "Interview"} — {interview.title ?? interview.round}</p>
            <p class="small muted">{formatDateTime(interview.scheduledAt)} · {interview.location ?? interview.meetingUrl ?? "Location TBD"}</p>
          </div>
          <span class="badge badge-soon">{interview.round}</span>
        </a>
      {/each}
    </div>
  </section>
{/if}

<section class="mt-4">
  <p class="kicker">Quick capture</p>
  <h2>Start something</h2>
  <div class="grid-2 mt-2">
    <a class="card" href="/applications?new=1">
      <div class="row"><BriefcaseBusiness size={20} /><span class="mono">Add a lead from a URL or job description</span></div>
    </a>
    <a class="card" href="/research">
      <div class="row"><Search size={20} /><span class="mono">Research a company or role</span></div>
    </a>
  </div>
</section>

<style>
  .stat-card {
    display: block;
    transition: transform 0.16s ease, box-shadow 0.16s ease;
  }

  .stat-card:hover {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0 var(--ink);
    color: inherit;
  }

  .stat {
    font-family: var(--mono);
    font-size: 40px;
    font-weight: 800;
    line-height: 1;
    margin-top: 6px;
  }

  .text-rust {
    color: var(--rust);
  }

  .stage-strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .stage-strip .badge {
    padding: 6px 12px;
  }

  .count {
    font-size: 11px;
    opacity: 0.8;
    margin-left: 3px;
  }

  .due-card {
    border-left: 8px solid var(--ink);
  }

  .due-card.overdue {
    border-left-color: var(--rust);
  }

  .due-side {
    text-align: right;
    flex: 0 0 auto;
  }

  .due-date {
    font-weight: 800;
    font-size: 13px;
  }

  .complete-options summary {
    list-style: none;
    cursor: pointer;
  }

  .complete-options summary::-webkit-details-marker {
    display: none;
  }

  .complete-panel {
    width: min(320px, calc(100vw - 64px));
  }
</style>
