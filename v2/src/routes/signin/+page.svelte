<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { authClient } from "#lib/auth-client";
  import { ArrowRight, LoaderCircle } from "lucide-svelte";

  let email = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = "";
    loading = true;
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result?.error) {
        error = result.error.message || "Sign in failed.";
        loading = false;
        return;
      }
      const next = page.url.searchParams.get("next") || "/home";
      goto(next);
    } catch (e) {
      error = e instanceof Error ? e.message : "Sign in failed.";
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Sign in — CareerGroove</title>
</svelte:head>

<div class="signin-wrap">
  <div class="signin-card panel">
    <div class="brand-row">
      <span class="brand-mark">CG</span>
      <div>
        <p class="kicker">CareerGroove</p>
        <h1 class="brand-title">Your career, in one place.</h1>
      </div>
    </div>

    <p class="muted mt-2">
      Sign in to see what needs attention, move applications forward, and keep your
      profile current.
    </p>

    <form onsubmit={submit} class="stack mt-3">
      <label class="field">
        <span class="label">Email</span>
        <input class="input" type="email" bind:value={email} autocomplete="email" required />
      </label>
      <label class="field">
        <span class="label">Password</span>
        <input class="input" type="password" bind:value={password} autocomplete="current-password" required />
      </label>

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      <button class="btn btn-primary btn-block" disabled={loading} type="submit">
        {#if loading}
          <span class="spin"><LoaderCircle size={16} /></span> Signing in…
        {:else}
          Sign in <ArrowRight size={16} />
        {/if}
      </button>
    </form>

    <p class="small muted mt-3">
      Two CareerGroove accounts are enabled for this deployment. Ask the admin if you
      need access.
    </p>
  </div>
</div>

<style>
  .signin-wrap {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 20px;
  }

  .signin-card {
    width: min(480px, 100%);
    padding: 24px;
    box-shadow: var(--shadow);
  }

  .brand-row {
    display: flex;
    gap: 14px;
    align-items: center;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border: 3px solid var(--ink);
    border-radius: var(--radius);
    background: var(--green);
    font-family: var(--mono);
    font-size: 17px;
    font-weight: 800;
    box-shadow: var(--shadow-sm);
    flex: 0 0 auto;
  }

  .brand-title {
    font-size: 28px;
    margin-top: 2px;
  }

  .spin {
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
