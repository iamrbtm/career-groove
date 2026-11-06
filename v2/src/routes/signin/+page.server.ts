import { redirect } from "@sveltejs/kit";

export function load({ locals }: { locals: App.Locals }) {
  if (locals.user) redirect(303, "/home");
  return {};
}
