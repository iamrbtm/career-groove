<script lang="ts">
  import { ArrowLeft, Download, FileText, Save, Trash2 } from "lucide-svelte";

  let { data, form }: { data: any; form: any } = $props();
  const doc = $derived(data.document);
  let body = $state(data.document.bodyMarkdown);
  let title = $state(data.document.title);
  let kind = $state(data.document.kind);
  let applicationId = $state(data.application?.id ?? "");
</script>

<svelte:head><title>{doc.title} — CareerGroove</title></svelte:head>

<a class="back" href="/documents"><ArrowLeft size={15} /> Documents</a>

{#if form?.error}
  <p class="error mt-2" role="alert">{form.error}</p>
{/if}

<header class="row-between mt-2">
  <div>
    <p class="kicker">Document</p>
    <h1>{title}</h1>
  </div>
  <div class="row">
    <a class="btn btn-primary" href={`/documents/${doc.id}/download`}><Download size={16} /> Download PDF</a>
    <a class="btn btn-ghost" href="/documents">Library</a>
  </div>
</header>

<form method="POST" action="?/update" class="stack mt-3">
  <div class="grid-2">
    <label class="field">
      <span class="label">Title</span>
      <input class="input" name="title" bind:value={title} />
    </label>
    <label class="field">
      <span class="label">Kind</span>
      <select class="select" name="kind" bind:value={kind}>
        <option value="resume">Resume</option>
        <option value="cover_letter">Cover letter</option>
        <option value="other">Other</option>
      </select>
    </label>
    <label class="field">
      <span class="label">Application</span>
      <select class="select" name="applicationId" bind:value={applicationId}>
        <option value="">None</option>
        {#each data.applications as app}
          <option value={app.id}>{app.company} — {app.title}</option>
        {/each}
      </select>
    </label>
  </div>
  <label class="field">
    <span class="label">Content (Markdown)</span>
    <textarea class="textarea" name="bodyMarkdown" bind:value={body} rows="24"></textarea>
  </label>
  <div class="row">
    <button class="btn btn-primary" type="submit"><Save size={15} /> Save</button>
    <a class="btn btn-ghost" href="/documents">Cancel</a>
  </div>
</form>

<form method="POST" action="?/delete" class="mt-3">
  <button class="btn btn-sm btn-danger" type="submit"><Trash2 size={14} /> Delete document</button>
</form>

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
</style>