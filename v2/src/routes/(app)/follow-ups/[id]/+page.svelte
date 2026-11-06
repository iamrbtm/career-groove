<script lang="ts">
  import { ArrowLeft, Mail, Paperclip, Send, Trash2 } from "lucide-svelte";
  import { formatDate } from "#lib/format";

  let { data, form }: { data: any; form: any } = $props();
  const f = $derived(data.followUp);
</script>

<svelte:head><title>{f.subject} — Follow-up</title></svelte:head>

<a class="back" href="/follow-ups"><ArrowLeft size={15} /> Follow-ups</a>

{#if form?.error}
  <p class="error mt-2" role="alert">{form.error}</p>
{/if}

<header class="row-between mt-2">
  <div>
    <p class="kicker">Follow-up</p>
    <h1>{f.subject}</h1>
    <p class="small muted">Due {formatDate(f.dueAt)} · {f.status}</p>
  </div>
  <div class="row">
    <form method="POST" action="?/delete">
      <button class="btn btn-sm btn-danger" type="submit"><Trash2 size={14} /> Delete</button>
    </form>
    <a class="btn btn-ghost" href="/follow-ups">List</a>
  </div>
</header>

<form method="POST" action="?/update" class="stack mt-3">
  <label class="field">
    <span class="label">Subject</span>
    <input class="input" name="subject" value={f.subject} />
  </label>
  <label class="field">
    <span class="label">Body</span>
    <textarea class="textarea" name="body" rows="8">{f.body ?? ""}</textarea>
  </label>
  <label class="field">
    <span class="label">Due</span>
    <input class="input" type="date" name="dueAt" value={formatDate(f.dueAt)} />
  </label>
  <button class="btn btn-primary" type="submit"><Paperclip size={15} /> Save draft</button>
</form>

<section class="panel panel-pad mt-3">
  <p class="kicker">Send</p>
  <h2>Send this follow-up</h2>
  <form method="POST" action="/follow-ups?/send" class="stack mt-2">
    <input type="hidden" name="id" value={f.id} />
    <label class="field">
      <span class="label">To</span>
      <input class="input" type="email" name="toEmail" placeholder="name@example.com" />
    </label>
    <label class="field">
      <span class="label">Subject</span>
      <input class="input" name="subject" value={f.subject} />
    </label>
    <label class="field">
      <span class="label">Body</span>
      <textarea class="textarea" name="body" rows="8">{f.body ?? ""}</textarea>
    </label>
    <button class="btn btn-primary" type="submit"><Send size={15} /> Send email</button>
  </form>
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
</style>