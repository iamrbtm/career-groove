# CareerGroove Redesign Prompt

I'm redesigning the visual identity and UI of CareerGroove, a job-search and resume-building
web app (PWA, mobile-first, with a logged-in dashboard, application tracker, AI interview
practice, and resume/document tools, plus a marketing landing page). Tech stack: Next.js,
Tailwind CSS, Framer Motion, lucide-react icons.

VIBE: Whimsical and fun, but strictly professional where it handles real career data
(resumes, applications, interviews). Think "cozy video game menu" energy applied to a
genuinely useful productivity tool — never goofy at the expense of trust.

REFERENCE MASHUP (what to pull from each, not a literal copy):
- causehouse.co — warm, custom illustrated icon/graphic style; a house/journey metaphor
  used consistently through the product; approachable mission-driven copy tone.
- hypergiant.com — confident, bold hero typography and a sense of "serious ambition";
  strong visual hierarchy, uncluttered sections.
- theateamproject.ai — playful mascot energy, multicolor accent decorations, conversational
  and a little irreverent copy, but still legible/earnest about the problem it solves.
- (Pinterest "groovy website design" board) — organic/retro-groovy shapes, warm color
  blocking, playful type pairings — use as loose textural/shape inspiration, not a direct style.

CURRENT STATE TO EVOLVE (not necessarily discard):
- Existing palette: cream background (#f6f0e5), ink text (#26312c), coral (#ff6b57),
  mint (#62c6a5), sun/yellow (#ffc857), plum (#725a7a), fog (#e8e2d7).
- Existing motion idea: tactile "pressed" buttons (hard offset shadow), card-flip/confetti
  on saving a job, slide/fade page transitions.
- Known problems to fix: fonts are currently just system-font stacks (Avenir Next, Arial
  Rounded) that don't actually load cross-platform — need a real licensed/web-safe font
  pairing (a confident display face + a clean readable body face) that still feels custom,
  not default Bootstrap/Tailwind. Motion is currently only on the marketing landing page,
  not the actual app shell (sidebar/bottom nav, dashboard, tracker) — needs to feel
  consistent app-wide. No dark mode currently.

SCOPE: The whole site — both the public marketing/landing pages AND the logged-in app
(dashboard, application tracker, documents, interview practice, settings, global nav/shell,
the floating music player widget).

WHAT I WANT FROM YOU: A proposed design direction covering color palette (refined/evolved,
not necessarily all-new), typography pairing, iconography/illustration approach (note: we're
open to commissioning/generating new custom icons, like causehouse does), component styling
(buttons, cards, nav), and motion principles — with enough specificity that a frontend
developer could implement it consistently across the whole app. Show me options where it
helps rather than just one direction.
