import { building } from "$app/env";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { auth } from "#lib/server/auth";
import type { RequestEvent } from "@sveltejs/kit";

export async function handle({ event, resolve }: { event: RequestEvent; resolve: (event: RequestEvent) => Response | Promise<Response> }) {
  try {
    const session = await auth.api.getSession({ headers: event.request.headers });
    event.locals.user = (session?.user as App.Locals["user"]) ?? null;
  } catch {
    event.locals.user = null;
  }
  return svelteKitHandler({ event, resolve, auth, building });
}
