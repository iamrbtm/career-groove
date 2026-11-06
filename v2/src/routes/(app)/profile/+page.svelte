<script lang="ts">
  import { BriefcaseBusiness, FileText, GraduationCap, Home, Plus, Save, Trash2, Wrench } from "lucide-svelte";
  import { formatDate } from "#lib/format";

  let { data, form } = $props();
  const p = $derived(data.profile);
  const skillGroups = $derived(
    data.skills.reduce<Record<string, typeof data.skills>>((groups, skill) => {
      (groups[skill.category] ??= []).push(skill);
      return groups;
    }, {}),
  );
</script>

<svelte:head><title>Profile — CareerGroove</title></svelte:head>

<header class="row-between">
  <div>
    <p class="kicker">Profile</p>
    <h1>{p.name ?? "Your profile"}</h1>
    <p class="muted">The source of truth for applications, documents, and interviews.</p>
  </div>
  <a class="btn btn-ghost" href="/documents"><FileText size={16} /> Documents</a>
</header>

{#if form?.error}
  <p class="error mt-2" role="alert">{form.error}</p>
{/if}

<section class="panel panel-pad mt-3">
  <p class="kicker">Contact</p>
  <h2>Basics and fit preferences</h2>
  <form method="POST" action="?/updateProfile" class="stack mt-2">
    <div class="grid-2">
      <label class="field"><span class="label">Name</span><input class="input" name="name" value={p.name ?? ""} /></label>
      <label class="field"><span class="label">Phone</span><input class="input" name="phone" value={p.phone ?? ""} /></label>
      <label class="field"><span class="label">LinkedIn</span><input class="input" name="linkedin" value={p.linkedin ?? ""} /></label>
      <label class="field"><span class="label">GitHub</span><input class="input" name="github" value={p.github ?? ""} /></label>
      <label class="field"><span class="label">Portfolio</span><input class="input" name="portfolio" value={p.portfolio ?? ""} /></label>
      <label class="field"><span class="label">Website</span><input class="input" name="website" value={p.website ?? ""} /></label>
      <label class="field"><span class="label">Desired titles (comma separated)</span><input class="input" name="desiredTitles" value={(p.desiredTitles ?? []).join(", ")} /></label>
      <label class="field"><span class="label">Work modes (comma separated)</span><input class="input" name="workModes" value={(p.workModes ?? []).join(", ")} placeholder="remote, hybrid" /></label>
      <label class="field"><span class="label">Salary target</span><input class="input" type="number" name="salaryTarget" value={p.salaryTarget ?? ""} min="0" step="1000" /></label>
      <label class="field"><span class="label">Location preference</span><input class="input" name="locationPreference" value={p.locationPreference ?? ""} /></label>
    </div>
    <label class="field"><span class="label">Industries (comma separated)</span><input class="input" name="industries" value={(p.industries ?? []).join(", ")} /></label>
    <button class="btn btn-primary" type="submit"><Save size={15} /> Save profile</button>
  </form>
</section>

<section class="panel panel-pad mt-3">
  <div class="row-between">
    <div><p class="kicker">Work history</p><h2>Where you have worked</h2></div>
    <details>
      <summary class="btn btn-sm btn-primary"><Plus size={14} /> Add role</summary>
      <form method="POST" action="?/addJob" class="stack mt-2 add-form">
        <div class="grid-2">
          <label class="field"><span class="label">Company</span><input class="input" name="company" required /></label>
          <label class="field"><span class="label">Title</span><input class="input" name="title" required /></label>
          <label class="field"><span class="label">Location</span><input class="input" name="location" /></label>
          <label class="field check"><input type="checkbox" name="current" /> Current role</label>
          <label class="field"><span class="label">Started</span><input class="input" type="date" name="startedOn" /></label>
          <label class="field"><span class="label">Ended</span><input class="input" type="date" name="endedOn" /></label>
        </div>
        <label class="field"><span class="label">Description</span><textarea class="textarea" name="description" rows="4"></textarea></label>
        <label class="field"><span class="label">Highlights (one per line)</span><textarea class="textarea" name="highlights" rows="4"></textarea></label>
        <button class="btn btn-primary btn-sm" type="submit">Add role</button>
      </form>
    </details>
  </div>

  {#if data.jobs.length === 0}
    <p class="small muted mt-2">No work history yet. Add your most recent role first.</p>
  {:else}
    <div class="stack mt-2">
      {#each data.jobs as job}
        <article class="card-flat">
          <div class="row-between">
            <div>
              <p class="mono job-title">{job.title}</p>
              <p class="small">{job.company} {job.location ? `· ${job.location}` : ""}</p>
              <p class="micro">{formatDate(job.startedOn)} — {job.current ? "Present" : formatDate(job.endedOn)}</p>
            </div>
            <form method="POST" action="?/deleteJob">
              <input type="hidden" name="id" value={job.id} />
              <button class="icon-btn" type="submit" aria-label="Delete role"><Trash2 size={15} /></button>
            </form>
          </div>
          {#if job.description}<p class="small mt-1">{job.description}</p>{/if}
          {#if job.highlights?.length}
            <ul class="highlights mt-1">
              {#each job.highlights as highlight}<li class="small">{highlight}</li>{/each}
            </ul>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</section>

<section class="grid-2 mt-3">
  <div class="panel panel-pad">
    <div class="row-between">
      <div><p class="kicker">Residences</p><h2>Where you have lived</h2></div>
      <details>
        <summary class="btn btn-sm"><Plus size={14} /> Add</summary>
        <form method="POST" action="?/addResidence" class="stack mt-2">
          <label class="field"><span class="label">Label</span><input class="input" name="label" /></label>
          <label class="field"><span class="label">Street</span><input class="input" name="street" /></label>
          <div class="grid-2">
            <label class="field"><span class="label">City</span><input class="input" name="city" /></label>
            <label class="field"><span class="label">Region</span><input class="input" name="region" /></label>
            <label class="field"><span class="label">Country</span><input class="input" name="country" /></label>
            <label class="field"><span class="label">Postal code</span><input class="input" name="postalCode" /></label>
            <label class="field"><span class="label">Started</span><input class="input" type="date" name="startedOn" /></label>
            <label class="field"><span class="label">Ended</span><input class="input" type="date" name="endedOn" /></label>
          </div>
          <button class="btn btn-sm btn-primary" type="submit">Add residence</button>
        </form>
      </details>
    </div>
    <div class="stack mt-2">
      {#each data.residences as residence}
        <div class="card-flat row-between">
          <div>
            <p class="mono small"><Home size={13} /> {residence.label ?? residence.city ?? "Residence"}</p>
            <p class="small muted">{residence.city ?? ""}{residence.region ? `, ${residence.region}` : ""} · {formatDate(residence.startedOn)} — {formatDate(residence.endedOn)}</p>
          </div>
          <form method="POST" action="?/deleteResidence">
            <input type="hidden" name="id" value={residence.id} />
            <button class="icon-btn" type="submit" aria-label="Delete residence"><Trash2 size={14} /></button>
          </form>
        </div>
      {/each}
    </div>
  </div>

  <div class="panel panel-pad">
    <div class="row-between">
      <div><p class="kicker">Credentials</p><h2>Education and certifications</h2></div>
      <details>
        <summary class="btn btn-sm"><Plus size={14} /> Add</summary>
        <form method="POST" action="?/addCredential" class="stack mt-2">
          <label class="field"><span class="label">Kind</span><select class="select" name="kind"><option value="education">Education</option><option value="certification">Certification</option><option value="license">License</option><option value="award">Award</option></select></label>
          <label class="field"><span class="label">Name</span><input class="input" name="name" required /></label>
          <label class="field"><span class="label">Issuer</span><input class="input" name="issuer" /></label>
          <div class="grid-2">
            <label class="field"><span class="label">Issued</span><input class="input" type="date" name="issuedOn" /></label>
            <label class="field"><span class="label">Expires</span><input class="input" type="date" name="expiresOn" /></label>
          </div>
          <label class="field"><span class="label">URL</span><input class="input" type="url" name="url" /></label>
          <button class="btn btn-sm btn-primary" type="submit">Add credential</button>
        </form>
      </details>
    </div>
    <div class="stack mt-2">
      {#each data.credentials as credential}
        <div class="card-flat row-between">
          <div>
            <p class="mono small"><GraduationCap size={13} /> {credential.name}</p>
            <p class="small muted">{credential.issuer ?? ""} · {formatDate(credential.issuedOn)}</p>
          </div>
          <form method="POST" action="?/deleteCredential">
            <input type="hidden" name="id" value={credential.id} />
            <button class="icon-btn" type="submit" aria-label="Delete credential"><Trash2 size={14} /></button>
          </form>
        </div>
      {/each}
    </div>
  </div>
</section>

<section class="panel panel-pad mt-3">
  <div class="row-between">
    <div><p class="kicker">Skills</p><h2>What you bring</h2></div>
    <details>
      <summary class="btn btn-sm btn-primary"><Plus size={14} /> Add skill</summary>
      <form method="POST" action="?/addSkill" class="stack mt-2 add-form">
        <label class="field"><span class="label">Name</span><input class="input" name="name" required /></label>
        <label class="field"><span class="label">Category</span><input class="input" name="category" placeholder="technical, leadership, domain" /></label>
        <label class="field"><span class="label">Proficiency (1–5)</span><input class="input" type="number" name="proficiency" min="1" max="5" value="3" /></label>
        <button class="btn btn-sm btn-primary" type="submit">Add skill</button>
      </form>
    </details>
  </div>
  {#each Object.entries(skillGroups) as [category, items]}
    <div class="mt-2">
      <p class="micro">{category.replaceAll("_", " ")}</p>
      <div class="skill-list mt-1">
        {#each items as skill}
          <span class="skill-chip">
            <Wrench size={12} /> {skill.name}
            <form method="POST" action="?/deleteSkill" class="inline-form">
              <input type="hidden" name="id" value={skill.id} />
              <button type="submit" aria-label={`Delete ${skill.name}`}><Trash2 size={11} /></button>
            </form>
          </span>
        {/each}
      </div>
    </div>
  {/each}
</section>

<style>
  .add-form {
    width: min(420px, calc(100vw - 64px));
  }

  .job-title {
    font-weight: 800;
  }

  .highlights {
    padding-left: 1.2em;
  }

  .skill-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .skill-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 9px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--panel);
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
  }

  .inline-form {
    display: inline-flex;
  }
</style>
