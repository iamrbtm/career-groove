import { redirect } from "@sveltejs/kit";

export function load({ locals, url }: { locals: App.Locals; url: URL }) {
  if (!locals.user) {
    redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
  }
  return { user: locals.user };
}
