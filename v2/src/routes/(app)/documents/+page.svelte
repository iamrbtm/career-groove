<script lang="ts">
  import { FileText, Plus, Trash2 } from "lucide-svelte";
  import { formatDate } from "#lib/format";

  let { data } = $props();
</script>

<svelte:head><title>Documents — CareerGroove</title></svelte:head>

<header class="row-between">
  <div>
    <p class="kicker">Documents</p>
    <h1>Library</h1>
    <p class="muted">Base resume, tailored variants, and cover letters.</p>
  </div>
  <details>
    <summary class="btn btn-primary"><Plus size={16} /> New document</summary>
    <form method="POST" action="?/create" class="panel panel-pad stack mt-2 add-form">
      <label class="field">
        <span class="label">Title</span>
        <input class="input" name="title" placeholder="Tailored resume — Acme Corp" required />
      </label>
      <label class="field">
        <span class="label">Kind</span>
        <select class="select" name="kind">
          <option value="resume">Resume</option>
          <option value="cover_letter">Cover letter</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label class="field">
        <span class="label">Link to application</span>
        <select class="select" name="applicationId">
          <option value="">None</option>
          {#each data.applications as app}
            <option value={app.id}>{app.company} — {app.title}</option>
          {/each}
        </select>
      </label>
      <label class="field">
        <span class="label">Content (Markdown)</span>
        <textarea class="textarea" name="bodyMarkdown" rows="10"></textarea>
      </label>
      <button class="btn btn-primary" type="submit">Create document</button>
    </form>
  </details>
</header>

{#if data.documents.length === 0}
  <div class="empty mt-3">
    <FileText size={26} />
    <h2 class="mt-1">No documents yet.</h2>
    <p class="muted">Generate a base resume from your profile or write one by hand.</p>
    <a class="btn btn-primary mt-2" href="/profile">Open profile</a>
  </div>
{:else}
  <div class="table-wrap mt-3">
    <table>
      <thead>
        <tr><th>Title</th><th>Kind</th><th>Application</th><th>Updated</th><th></th></tr>
      </thead>
      <tbody>
        {#each data.documents as doc}
          <tr>
            <td><a class="mono" href={`/documents/${doc.id}`}>{doc.title}</a></td>
            <td><span class="badge">{doc.kind}</span></td>
            <td>{doc.company ? `${doc.company} — ${doc.roleTitle}` : "—"}</td>
            <td>{formatDate(doc.updatedAt)}</td>
            <td>
              <form method="POST" action="?/delete">
                <input type="hidden" name="id" value={doc.id} />
                <button class="icon-btn" type="submit" aria-label="Delete"><Trash2 size={14} /></button>
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .add-form {
    width: min(420px, calc(100vw - 64px));
  }
</style>