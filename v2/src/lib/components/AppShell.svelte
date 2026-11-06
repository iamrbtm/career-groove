<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import type { Snippet } from "svelte";
  import {
    BriefcaseBusiness,
    Home,
    LogOut,
    Menu,
    MessagesSquare,
    Network,
    Search,
    Settings2,
    UserRound,
    Wrench,
    X,
  } from "lucide-svelte";
  import { authClient } from "#lib/auth-client";

  type ShellUser = { id: string; name: string; email: string; isAdmin?: boolean };

  let {
    user,
    children,
  }: { user: ShellUser; children: Snippet } = $props();

  let toolsOpen = $state(false);
  let accountOpen = $state(false);
  let mobileTools = $state(false);

  const primary = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/applications", label: "Applications", icon: BriefcaseBusiness },
    { href: "/profile", label: "Profile", icon: UserRound },
    { href: "/interview", label: "Interview", icon: MessagesSquare },
  ];

  const tools = $derived([
    { href: "/tools/network", label: "Network", icon: Network },
    { href: "/research", label: "Research", icon: Search },
    ...(user.isAdmin ? [{ href: "/tools/admin", label: "Admin", icon: Settings2 }] : []),
  ]);

  function isActive(href: string) {
    return page.url.pathname === href || page.url.pathname.startsWith(href + "/");
  }

  async function signOut() {
    await authClient.signOut();
    goto("/signin");
  }
</script>

<div class="shell">
  <header class="mobile-header">
    <a href="/home" class="brand">
      <span class="brand-mark">CG</span>
      <span class="brand-name">CareerGroove</span>
    </a>
    <div class="mobile-actions">
      <button class="icon-btn" aria-label="Tools" onclick={() => (mobileTools = true)}>
        <Wrench size={18} />
      </button>
      <button class="icon-btn" aria-label="Account" onclick={() => (accountOpen = !accountOpen)}>
        <Menu size={18} />
      </button>
    </div>
  </header>

  <aside class="sidebar" aria-label="Main navigation">
    <a href="/home" class="brand-mark sidebar-logo" aria-label="CareerGroove home">CG</a>
    <nav class="side-links">
      {#each primary as item}
        <a
          href={item.href}
          class="side-link"
          class:active={isActive(item.href)}
          aria-current={isActive(item.href) ? "page" : undefined}
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </a>
      {/each}
      <button class="side-link" class:active={toolsOpen} onclick={() => (toolsOpen = !toolsOpen)}>
        <Wrench size={20} />
        <span>Tools</span>
      </button>
      {#if toolsOpen}
        <div class="side-tools">
          {#each tools as item}
            <a href={item.href} class="side-tool" class:active={isActive(item.href)}>
              <item.icon size={16} />
              {item.label}
            </a>
          {/each}
        </div>
      {/if}
    </nav>
    <div class="sidebar-foot">
      <button class="avatar" onclick={() => (accountOpen = !accountOpen)} aria-label="Account menu">
        {user.name?.slice(0, 1).toUpperCase() || "U"}
      </button>
    </div>
  </aside>

  {#if accountOpen}
    <div class="account-pop panel panel-pad">
      <p class="micro">Signed in as</p>
      <p class="account-email">{user.email}</p>
      <p class="small muted">{user.name}</p>
      <button class="btn btn-ghost btn-block mt-2" onclick={signOut}>
        <LogOut size={15} /> Sign out
      </button>
      <button class="btn btn-ghost btn-block mt-1" onclick={() => (accountOpen = false)}>
        <X size={15} /> Close
      </button>
    </div>
  {/if}

  <main class="main">
    <div class="page">
      {@render children()}
    </div>
  </main>

  <nav class="bottom-nav" aria-label="Primary navigation">
    {#each primary as item}
      <a
        href={item.href}
        class="bottom-link"
        class:active={isActive(item.href)}
        aria-current={isActive(item.href) ? "page" : undefined}
      >
        <item.icon size={19} />
        <span>{item.label}</span>
      </a>
    {/each}
    <button class="bottom-link" class:active={mobileTools} onclick={() => (mobileTools = true)}>
      <Wrench size={19} />
      <span>Tools</span>
    </button>
  </nav>

  {#if mobileTools}
    <div class="sheet-backdrop" role="presentation" onclick={() => (mobileTools = false)}></div>
    <div class="sheet panel" role="dialog" aria-modal="true" aria-label="Tools">
      <div class="row-between">
        <p class="micro">Tools</p>
        <button class="icon-btn" aria-label="Close tools" onclick={() => (mobileTools = false)}>
          <X size={18} />
        </button>
      </div>
      <div class="stack mt-2">
        {#each tools as item}
          <a href={item.href} class="card" onclick={() => (mobileTools = false)}>
            <div class="row">
              <item.icon size={18} />
              <span class="mono">{item.label}</span>
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    background: var(--paper);
    border-bottom: 3px solid var(--ink);
    position: sticky;
    top: 0;
    z-index: 40;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 3px solid var(--ink);
    border-radius: var(--radius);
    background: var(--green);
    font-family: var(--mono);
    font-weight: 800;
    font-size: 14px;
    box-shadow: 2px 2px 0 var(--ink);
  }

  .brand-name {
    font-family: var(--mono);
    font-weight: 800;
    font-size: 14px;
    letter-spacing: 0.02em;
  }

  .mobile-actions {
    display: flex;
    gap: 8px;
  }

  .sidebar {
    display: none;
  }

  .main {
    min-height: calc(100dvh - 66px);
  }

  .bottom-nav {
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: 10px;
    z-index: 45;
    display: flex;
    justify-content: space-between;
    gap: 4px;
    padding: 6px;
    border: 3px solid var(--ink);
    border-radius: var(--radius);
    background: var(--ink);
    box-shadow: var(--shadow-sm);
  }

  .bottom-link {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 7px 2px;
    border-radius: var(--radius);
    color: var(--paper);
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .bottom-link.active {
    background: var(--paper);
    color: var(--ink);
  }

  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgba(16, 16, 13, 0.55);
  }

  .sheet {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 61;
    padding: 16px;
    box-shadow: var(--shadow);
  }

  .account-pop {
    position: fixed;
    right: 14px;
    top: 64px;
    z-index: 70;
    width: 260px;
    box-shadow: var(--shadow);
  }

  .account-email {
    font-family: var(--mono);
    font-weight: 700;
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  @media (min-width: 880px) {
    .mobile-header,
    .bottom-nav {
      display: none;
    }

    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      z-index: 30;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 14px;
      width: 96px;
      padding: 16px 10px;
      background: var(--ink);
      color: var(--paper);
      border-right: 3px solid var(--ink);
      overflow-y: auto;
    }

    .sidebar-logo {
      background: var(--green);
      color: var(--ink);
      align-self: center;
    }

    .side-links {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .side-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 4px;
      border: 2px solid transparent;
      border-radius: var(--radius);
      color: var(--paper);
      font-family: var(--mono);
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      opacity: 0.72;
    }

    .side-link:hover,
    .side-link.active {
      opacity: 1;
      border-color: var(--paper);
      background: rgba(245, 239, 224, 0.1);
      color: var(--paper);
    }

    .side-tools {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-left: 8px;
      border-left: 2px solid rgba(245, 239, 224, 0.25);
    }

    .side-tool {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 4px;
      color: var(--paper);
      opacity: 0.72;
      font-family: var(--mono);
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .side-tool:hover,
    .side-tool.active {
      opacity: 1;
      color: var(--green);
    }

    .sidebar-foot {
      margin-top: auto;
      display: flex;
      justify-content: center;
    }

    .avatar {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border: 2px solid var(--paper);
      border-radius: 50%;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--mono);
      font-weight: 800;
    }

    .account-pop {
      top: auto;
      bottom: 18px;
      left: 106px;
      right: auto;
    }
  }
</style>
