<script lang="ts">
  import { CheckCircle, CircleAlert, Send, TestTube } from "lucide-svelte";

  let { data, form } = $props();
  const settingsMap = $derived(
    Object.fromEntries(data.settings.map((s) => [s.key, s.masked])),
  );
</script>

<svelte:head><title>Admin — CareerGroove</title></svelte:head>

<header class="row-between">
  <div>
    <p class="kicker">Tools</p>
    <h1>Admin</h1>
    <p class="muted">AI providers, search, and SMTP. Secrets are encrypted at rest.</p>
  </div>
</header>

{#if form?.aiTest}
  <p class={form.aiTest.ok ? "success mt-2" : "error mt-2"} role="alert">
    {form.aiTest.ok ? "AI connection OK." : `AI connection failed: ${form.aiTest.error}`}
  </p>
{/if}

{#if form?.smtpTest}
  <p class={form.smtpTest.ok ? "success mt-2" : "error mt-2"} role="alert">
    {form.smtpTest.ok ? "Test email sent." : `SMTP failed: ${form.smtpTest.error}`}
  </p>
{/if}

<form method="POST" action="?/save" class="stack mt-3">
  <section class="panel panel-pad">
    <p class="kicker">AI</p>
    <h2>Provider configuration</h2>
    <div class="grid-2 mt-2">
      <label class="field"><span class="label">Provider</span><select class="select" name="ai.provider"><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="ollama">Ollama</option></select></label>
      <label class="field"><span class="label">Model</span><input class="input" name="ai.model" value={settingsMap["ai.model"] ?? ""} placeholder="gpt-4o-mini" /></label>
      <label class="field"><span class="label">API key</span><input class="input" name="ai.apiKey" value={settingsMap["ai.apiKey"] ?? ""} /></label>
      <label class="field"><span class="label">Base URL</span><input class="input" name="ai.baseURL" value={settingsMap["ai.baseURL"] ?? ""} placeholder="https://api.openai.com/v1" /></label>
    </div>
    <button class="btn btn-sm mt-2" type="submit" formaction="?/testAi">Test connection</button>
  </section>

  <section class="panel panel-pad mt-3">
    <p class="kicker">Search</p>
    <h2>Search key</h2>
    <label class="field mt-2"><span class="label">Search key</span><input class="input" name="search.key" value={settingsMap["search.key"] ?? ""} /></label>
  </section>

  <section class="panel panel-pad mt-3">
    <p class="kicker">Email</p>
    <h2>SMTP</h2>
    <div class="grid-2 mt-2">
      <label class="field"><span class="label">Host</span><input class="input" name="smtp.host" value={settingsMap["smtp.host"] ?? ""} /></label>
      <label class="field"><span class="label">Port</span><input class="input" name="smtp.port" value={settingsMap["smtp.port"] ?? ""} /></label>
      <label class="field"><span class="label">User</span><input class="input" name="smtp.user" value={settingsMap["smtp.user"] ?? ""} /></label>
      <label class="field"><span class="label">Password</span><input class="input" type="password" name="smtp.password" value={settingsMap["smtp.password"] ?? ""} /></label>
      <label class="field"><span class="label">From</span><input class="input" name="smtp.from" value={settingsMap["smtp.from"] ?? ""} /></label>
      <label class="field check"><input type="checkbox" name="smtp.secure" /> Use TLS</label>
    </div>
    <div class="row mt-2">
      <input class="input flex-1" name="testEmail" placeholder="Test email address" />
      <button class="btn btn-sm" type="submit" formaction="?/testSmtp"><Send size={14} /> Test SMTP</button>
    </div>
  </section>

  <button class="btn btn-primary mt-3" type="submit"><TestTube size={15} /> Save settings</button>
</form>

<style>
  .success {
    border: 2px solid var(--ink);
    border-left: 8px solid var(--green);
    background: #e5f8d9;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 600;
  }
  .error {
    border: 2px solid var(--ink);
    border-left: 8px solid var(--rust);
    background: #f7d9d1;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 600;
  }
</style>