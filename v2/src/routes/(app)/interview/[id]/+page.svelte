<script lang="ts">
  import { ArrowLeft, CalendarClock, ExternalLink, MapPin, Save, Trash2, Video } from "lucide-svelte";
  import { formatDateTime, toDateTimeInput } from "#lib/format";

  let { data, form }: { data: any; form: any } = $props();
  const interview = $derived(data.interview);
  const application = $derived(data.application);
  let mockOpen = $state(false);
  let answers = $state<Record<number, string>>({});
</script>

<svelte:head><title>Interview prep — CareerGroove</title></svelte:head>

<a class="back" href="/interview"><ArrowLeft size={15} /> Interviews</a>

{#if form?.error}
  <p class="error mt-2" role="alert">{form.error}</p>
{/if}

<header class="row-between mt-2">
  <div>
    <div class="row">
      <span class="badge badge-soon">{interview.round}</span>
      <span class="badge">{interview.status}</span>
    </div>
    <h1 class="mt-1">{application?.company ?? "Interview"}</h1>
    <p class="mono role">{application?.title ?? "Role"}</p>
  </div>
  {#if application}
    <a class="btn btn-ghost" href={`/applications/${application.id}`}>Open application</a>
  {/if}
</header>

<section class="grid-3 mt-3">
  <div class="panel panel-pad">
    <p class="micro">When</p>
    <p class="mono who">{formatDateTime(interview.scheduledAt)}</p>
    <p class="small muted">Calendar</p>
  </div>
  <div class="panel panel-pad">
    <p class="micro">Where</p>
    <p class="mono who">{interview.location ?? "TBD"}</p>
    {#if interview.meetingUrl}<a class="small" href={interview.meetingUrl} target="_blank" rel="noreferrer"><Video size={12} /> Join meeting</a>{/if}
  </div>
  <div class="panel panel-pad">
    <p class="micro">Who</p>
    <p class="mono who">{interview.interviewerName ?? "Interviewer TBD"}</p>
    {#if interview.interviewerEmail}<p class="small muted">{interview.interviewerEmail}</p>{/if}
  </div>
</section>

<section class="grid-2 mt-3">
  <div class="panel panel-pad">
    <p class="kicker">Prep notes</p>
    <h2>Your working brief</h2>
    <form method="POST" action="?/update" class="stack mt-2">
      <label class="field">
        <span class="label">Prep notes</span>
        <textarea class="textarea" name="prepNotes" rows="10" placeholder="Stories, questions to ask, logistics, gaps to address…">{interview.prepNotes ?? ""}</textarea>
      </label>
      <div class="grid-2">
        <label class="field">
          <span class="label">Round</span>
          <select class="select" name="round">
            <option value="screen" selected={interview.round === "screen"}>Screen</option>
            <option value="hiring_manager" selected={interview.round === "hiring_manager"}>Hiring manager</option>
            <option value="technical" selected={interview.round === "technical"}>Technical</option>
            <option value="panel" selected={interview.round === "panel"}>Panel</option>
            <option value="final" selected={interview.round === "final"}>Final</option>
          </select>
        </label>
        <label class="field">
          <span class="label">Status</span>
          <select class="select" name="status">
            <option value="scheduled" selected={interview.status === "scheduled"}>Scheduled</option>
            <option value="completed" selected={interview.status === "completed"}>Completed</option>
            <option value="cancelled" selected={interview.status === "cancelled"}>Cancelled</option>
          </select>
        </label>
        <label class="field"><span class="label">When</span><input class="input" type="datetime-local" name="scheduledAt" value={toDateTimeInput(interview.scheduledAt)} /></label>
        <label class="field"><span class="label">Location</span><input class="input" name="location" value={interview.location ?? ""} /></label>
        <label class="field"><span class="label">Meeting URL</span><input class="input" type="url" name="meetingUrl" value={interview.meetingUrl ?? ""} /></label>
        <label class="field"><span class="label">Interviewer</span><input class="input" name="interviewerName" value={interview.interviewerName ?? ""} /></label>
        <label class="field"><span class="label">Interviewer email</span><input class="input" type="email" name="interviewerEmail" value={interview.interviewerEmail ?? ""} /></label>
      </div>
      <div class="row">
        <button class="btn btn-primary" type="submit"><Save size={15} /> Save interview</button>
      </div>
    </form>
    <form method="POST" action="?/delete" class="mt-2">
      <button class="btn btn-sm btn-danger" type="submit"><Trash2 size={14} /> Delete interview</button>
    </form>
  </div>

  <div class="stack">
    <div class="panel panel-pad">
      <p class="kicker">Research</p>
      <h2>Company notes</h2>
      {#if data.research.length === 0}
        <p class="small muted mt-1">No research linked yet. Add notes from the application or the research page.</p>
      {:else}
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
      <a class="btn btn-sm mt-2" href="/research">Open research</a>
    </div>

    <div class="panel panel-pad">
      <div class="row-between">
        <div><p class="kicker">Practice</p><h2>Mock questions</h2></div>
        <button class="btn btn-sm btn-primary" onclick={() => (mockOpen = !mockOpen)}>
          {mockOpen ? "Hide" : "Start mock"}
        </button>
      </div>
      {#if mockOpen}
        <div class="stack mt-2">
          {#each data.questions as question, index}
            <div class="card-flat">
              <p class="mono small">{index + 1}. {question}</p>
              <textarea class="textarea mt-1" rows="3" placeholder="Draft your answer…" bind:value={answers[index]}></textarea>
            </div>
          {/each}
          <p class="small muted">Answers stay on this page. Paste the strongest ones into prep notes.</p>
        </div>
      {:else}
        <p class="small muted mt-1">A focused set of questions for a {interview.round.replaceAll("_", " ")} interview.</p>
        <ul class="question-preview mt-2">
          {#each data.questions.slice(0, 3) as question}<li class="small">{question}</li>{/each}
        </ul>
      {/if}
    </div>
  </div>
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

  .role {
    font-size: 17px;
    font-weight: 700;
  }

  .who {
    font-size: 17px;
    font-weight: 800;
    margin-top: 2px;
  }

  .question-preview {
    padding-left: 1.2em;
  }
</style>
