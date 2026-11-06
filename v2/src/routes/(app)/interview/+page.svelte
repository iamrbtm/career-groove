<script lang="ts">
  import { CalendarPlus, MapPin, Plus, Trash2, Video } from "lucide-svelte";
  import { formatDateTime } from "#lib/format";

  let { data } = $props();
  const upcoming = $derived(
    data.interviews.filter((i) => i.scheduledAt && new Date(i.scheduledAt) >= new Date()),
  );
  const past = $derived(
    data.interviews.filter((i) => !i.scheduledAt || new Date(i.scheduledAt) < new Date()),
  );
</script>

<svelte:head><title>Interview — CareerGroove</title></svelte:head>

<header class="row-between">
  <div>
    <p class="kicker">Interview</p>
    <h1>Conversations</h1>
    <p class="muted">Who, what, when, and where — then prep.</p>
  </div>
  <a class="btn btn-primary" href="/interview?new=1"><CalendarPlus size={16} /> Add interview</a>
</header>

{#if upcoming.length === 0 && past.length === 0}
  <div class="empty mt-3">
    <CalendarPlus size={26} />
    <h2 class="mt-1">No interviews scheduled.</h2>
    <p class="muted">Add one from an application or right here.</p>
  </div>
{/if}

<section class="stack mt-3">
  {#if upcoming.length > 0}
    <h2>Upcoming</h2>
    {#each upcoming as interview}
      <article class="panel interview-card">
        <div class="when">
          <p class="day">{formatDateTime(interview.scheduledAt)}</p>
        </div>
        <div class="what">
          <div class="row">
            <span class="badge badge-soon">{interview.round}</span>
            <span class="badge">{interview.status}</span>
          </div>
          <h3 class="mt-1"><a href={`/interview/${interview.id}`}>{interview.company ?? "Interview"}</a></h3>
          <p class="small">{interview.title ?? "Role"}</p>
          <div class="row small muted mt-1">
            {#if interview.scheduledAt}<span>{formatDateTime(interview.scheduledAt)}</span>{/if}
            {#if interview.location}<span><MapPin size={12} /> {interview.location}</span>{/if}
            {#if interview.meetingUrl}<a href={interview.meetingUrl} target="_blank" rel="noreferrer"><Video size={12} /> Join</a>{/if}
          </div>
          {#if interview.interviewerName}<p class="small mt-1">With {interview.interviewerName}</p>{/if}
        </div>
        <div class="actions">
          <a class="btn btn-sm" href={`/interview/${interview.id}`}>Prep</a>
          <form method="POST" action="?/delete">
            <input type="hidden" name="id" value={interview.id} />
            <button class="icon-btn" type="submit" aria-label="Delete interview"><Trash2 size={14} /></button>
          </form>
        </div>
      </article>
    {/each}
  {/if}

  {#if past.length > 0}
    <h2 class="mt-2">Past / unscheduled</h2>
    {#each past as interview}
      <a class="card row-between" href={`/interview/${interview.id}`}>
        <div>
          <p class="mono small">{interview.company ?? "Interview"} — {interview.title ?? interview.round}</p>
          <p class="small muted">{formatDateTime(interview.scheduledAt)} · {interview.interviewerName ?? "Interviewer TBD"}</p>
        </div>
        <span class="badge">{interview.status}</span>
      </a>
    {/each}
  {/if}
</section>

<details class="mt-4">
  <summary class="btn btn-primary"><Plus size={15} /> Add interview</summary>
  <form method="POST" action="?/add" class="panel panel-pad stack mt-2">
    <div class="grid-2">
      <label class="field">
        <span class="label">Application</span>
        <select class="select" name="applicationId">
          <option value="">Not linked</option>
          {#each data.applications as app}
            <option value={app.id}>{app.company} — {app.title}</option>
          {/each}
        </select>
      </label>
      <label class="field">
        <span class="label">Round</span>
        <select class="select" name="round">
          <option value="screen">Screen</option>
          <option value="hiring_manager">Hiring manager</option>
          <option value="technical">Technical</option>
          <option value="panel">Panel</option>
          <option value="final">Final</option>
        </select>
      </label>
      <label class="field"><span class="label">When</span><input class="input" type="datetime-local" name="scheduledAt" /></label>
      <label class="field"><span class="label">Location</span><input class="input" name="location" placeholder="Video, office, phone" /></label>
      <label class="field"><span class="label">Meeting URL</span><input class="input" type="url" name="meetingUrl" /></label>
      <label class="field"><span class="label">Interviewer</span><input class="input" name="interviewerName" /></label>
      <label class="field"><span class="label">Interviewer email</span><input class="input" type="email" name="interviewerEmail" /></label>
    </div>
    <label class="field"><span class="label">Prep notes</span><textarea class="textarea" name="prepNotes" rows="4"></textarea></label>
    <button class="btn btn-primary" type="submit">Add interview</button>
  </form>
</details>

<style>
  .interview-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
  }

  .when {
    display: flex;
    align-items: baseline;
    gap: 6px;
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    padding: 8px 12px;
    background: var(--panel);
    width: fit-content;
  }

  .day {
    font-family: var(--mono);
    font-size: 28px;
    font-weight: 800;
    line-height: 1;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  @media (min-width: 720px) {
    .interview-card {
      flex-direction: row;
      align-items: center;
    }

    .what {
      flex: 1;
    }
  }
</style>
