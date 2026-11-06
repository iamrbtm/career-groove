<script lang="ts">
  import { ArrowLeft, FileText, Plus, Sparkles } from "lucide-svelte";

  let { data, form }: { data: any; form: any } = $props();
  let mode = $state("url");
  const parsed = $derived(Array.isArray(form?.parsed) ? form.parsed[0] : form?.parsed);
</script>

<svelte:head><title>Import — CareerGroove</title></svelte:head>

<a class="back" href="/applications"><ArrowLeft size={15} /> Applications</a>

<header class="row-between mt-2">
  <div>
    <p class="kicker">Import</p>
    <h1>Add a lead</h1>
    <p class="muted">Paste a URL, job description, or email. AI fills in the details.</p>
  </div>
</header>

{#if form?.error}
  <p class="error mt-2" role="alert">{form.error}</p>
{/if}

{#if form?.parsed}
  <section class="panel panel-pad mt-3">
    <div class="row-between">
      <div>
        <p class="kicker">Parsed</p>
        <h2>Confirm the details</h2>
      </div>
      <button class="btn btn-sm" onclick={() => (form = undefined)}>Edit manually</button>
    </div>
    <form method="POST" action="?/create" class="stack mt-2">
      <div class="grid-2">
        <label class="field"><span class="label">Company</span><input class="input" name="company" value={parsed?.company ?? ""} required /></label>
        <label class="field"><span class="label">Role</span><input class="input" name="title" value={parsed?.title ?? ""} required /></label>
        <label class="field"><span class="label">Location</span><input class="input" name="location" value={parsed?.location ?? ""} /></label>
        <label class="field"><span class="label">Work mode</span><input class="input" name="workMode" value={parsed?.workMode ?? ""} /></label>
        <label class="field"><span class="label">Salary min</span><input class="input" type="number" name="salaryMin" value={parsed?.salaryMin ?? ""} /></label>
        <label class="field"><span class="label">Salary max</span><input class="input" type="number" name="salaryMax" value={parsed?.salaryMax ?? ""} /></label>
      </div>
      <label class="field"><span class="label">Job description</span><textarea class="textarea" name="jobDescription" rows="6">{parsed?.jobDescription ?? ""}</textarea></label>
      <div class="row">
        <button class="btn btn-primary" type="submit"><Plus size={15} /> Create lead</button>
        <a class="btn btn-ghost" href="/applications">Cancel</a>
      </div>
    </form>
  </section>
{:else}
  <div class="row mt-3">
    <button class="btn" class:btn-primary={mode === "url"} onclick={() => (mode = "url")}>URL / JD</button>
    <button class="btn" class:btn-primary={mode === "email"} onclick={() => (mode = "email")}>Job email</button>
  </div>

  {#if mode === "url"}
    <form method="POST" action="?/parse" class="stack mt-3">
      <label class="field">
        <span class="label">Paste a URL or job description</span>
        <textarea class="textarea" name="text" rows="8" placeholder="https://example.com/job or paste the full JD"></textarea>
      </label>
      <button class="btn btn-primary" type="submit"><Sparkles size={15} /> Parse with AI</button>
    </form>
  {:else}
    <form method="POST" action="?/parseEmail" class="stack mt-3">
      <label class="field">
        <span class="label">Paste the job email</span>
        <textarea class="textarea" name="text" rows="10" placeholder="Paste the email text here"></textarea>
      </label>
      <button class="btn btn-primary" type="submit"><Sparkles size={15} /> Parse roles</button>
    </form>
  {/if}

  <details class="mt-4">
    <summary class="btn btn-sm">Or create manually</summary>
    <form method="POST" action="?/create" class="panel panel-pad stack mt-2 add-form">
      <div class="grid-2">
        <label class="field"><span class="label">Company</span><input class="input" name="company" required /></label>
        <label class="field"><span class="label">Role</span><input class="input" name="title" required /></label>
        <label class="field"><span class="label">Location</span><input class="input" name="location" /></label>
        <label class="field"><span class="label">Work mode</span><input class="input" name="workMode" /></label>
        <label class="field"><span class="label">Salary min</span><input class="input" type="number" name="salaryMin" /></label>
        <label class="field"><span class="label">Salary max</span><input class="input" type="number" name="salaryMax" /></label>
      </div>
      <label class="field"><span class="label">Job description</span><textarea class="textarea" name="jobDescription" rows="6"></textarea></label>
      <button class="btn btn-primary" type="submit"><FileText size={15} /> Create lead</button>
    </form>
  </details>
{/if}

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
  .add-form {
    width: min(420px, calc(100vw - 64px));
  }
</style>