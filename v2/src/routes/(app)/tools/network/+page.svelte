<script lang="ts">
  import { Plus, Trash2, Users } from "lucide-svelte";

  let { data, form } = $props();
</script>

<svelte:head><title>Network — CareerGroove</title></svelte:head>

<header class="row-between">
  <div>
    <p class="kicker">Tools</p>
    <h1>Network</h1>
    <p class="muted">Your contacts and where they connect to opportunities.</p>
  </div>
  <details>
    <summary class="btn btn-primary"><Plus size={16} /> Add contact</summary>
    <form method="POST" action="?/add" class="panel panel-pad stack mt-2 add-form">
      <label class="field"><span class="label">Name</span><input class="input" name="name" required /></label>
      <label class="field"><span class="label">Email</span><input class="input" type="email" name="email" /></label>
      <label class="field"><span class="label">Phone</span><input class="input" name="phone" /></label>
      <label class="field"><span class="label">Company</span><input class="input" name="company" /></label>
      <label class="field"><span class="label">Role</span><input class="input" name="role" /></label>
      <label class="field"><span class="label">Notes</span><textarea class="textarea" name="notes" rows="3"></textarea></label>
      <button class="btn btn-primary" type="submit">Add contact</button>
    </form>
  </details>
</header>

{#if data.contacts.length === 0}
  <div class="empty mt-3">
    <Users size={26} />
    <h2 class="mt-1">No contacts yet.</h2>
    <p class="muted">Add people you know so you can link them to applications.</p>
  </div>
{:else}
  <div class="stack mt-3">
    {#each data.contacts as contact}
      <article class="panel panel-pad contact-card">
        <div class="row-between">
          <div>
            <p class="mono contact-name">{contact.name}</p>
            <p class="small muted">{contact.role ?? "Contact"} {contact.company ? `· ${contact.company}` : ""}</p>
          </div>
          <form method="POST" action="?/delete">
            <input type="hidden" name="id" value={contact.id} />
            <button class="icon-btn" type="submit" aria-label="Delete contact"><Trash2 size={14} /></button>
          </form>
        </div>
        <div class="row small muted mt-1">
          {#if contact.email}<span>{contact.email}</span>{/if}
          {#if contact.phone}<span>{contact.phone}</span>{/if}
        </div>
        {#if contact.notes}<p class="small mt-1">{contact.notes}</p>{/if}
        <div class="mt-1">
          {#each data.linked.filter((l) => l.contactId === contact.id) as link}
            <span class="badge">{link.relationship ?? "linked"}</span>
            <span class="small muted">{link.company} — {link.roleTitle}</span>
          {/each}
        </div>
      </article>
    {/each}
  </div>
{/if}

<style>
  .add-form {
    width: min(420px, calc(100vw - 64px));
  }
  .contact-name {
    font-weight: 800;
    font-size: 15px;
  }
</style>