<script lang="ts">
  import { Plus, Search, Trash2 } from "lucide-svelte";
  import { formatDate } from "#lib/format";

  let { data, form } = $props();
</script>

<svelte:head><title>Research — CareerGroove</title></svelte:head>

<header class="row-between">
  <div>
    <p class="kicker">Research</p>
    <h1>Company and role notes</h1>
    <p class="muted">Global research, attachable to any application.</p>
  </div>
  <details>
    <summary class="btn btn-primary"><Plus size={16} /> Add note</summary>
    <form method="POST" action="?/add" class="panel panel-pad stack mt-2 add-form">
      <label class="field"><span class="label">Title</span><input class="input" name="title" required /></label>
      <label class="field"><span class="label">Company</span><input class="input" name="company" /></label>
      <label class="field"><span class="label">Source URL</span><input class="input" type="url" name="sourceUrl" /></label>
      <label class="field"><span class="label">Notes</span><textarea class="textarea" name="body" rows="6"></textarea></label>
      <button class="btn btn-primary" type="submit">Save research</button>
    </form>
  </details>
</header>

{#if data.notes.length === 0}
  <div class="empty mt-3">
    <Search size={26} />
    <h2 class="mt-1">No research notes yet.</h2>
    <p class="muted">Research a company, role, or team and attach it to applications.</p>
  </div>
{:else}
  <div class="stack mt-3">
    {#each data.notes as note}
      <article class="panel panel-pad research-card">
        <div class="row-between">
          <div>
            <p class="mono research-title">{note.title}</p>
            {#if note.company}<p class="small muted">{note.company}</p>{/if}
            {#if note.sourceUrl}<a class="small" href={note.sourceUrl} target="_blank" rel="noreferrer">Source</a>{/if}
          </div>
          <p class="micro">{formatDate(note.updatedAt)}</p>
        </div>
        {#if note.body}<p class="small mt-1">{note.body}</p>{/if}
      </article>
    {/each}
  </div>
{/if}

<style>
  .add-form {
    width: min(420px, calc(100vw - 64px));
  }
  .research-title {
    font-weight: 800;
    font-size: 15px;
  }
</style>