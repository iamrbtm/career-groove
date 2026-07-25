# Master Prompt for Codex: CareerGroove (Personal Career & Life CRM)

**Role & Objective:**
You are an expert Full-Stack Developer specializing in React (Next.js/Vite), Node.js, and PostgreSQL. Your task is to architect, design, and provide the foundational code for a web application called **"CareerGroove"** — a Personal Career & Life CRM.

**Core Concept:**
CareerGroove tracks all of the user's professional data (jobs, residences, licenses) and uses AI to streamline data entry and generate customized documents. The UI must feel like a "Progressive Web App" (PWA) on mobile, featuring a fun, whimsical, and highly interactive interface with integrated background music.

**Deployment & Execution:**
The application MUST be able to run in two modes:
1. **Standalone / Local Development:** Standard `npm run dev` or `npm start` utilizing a local node/react environment.
2. **Dockerized Environment:** Must include a `Dockerfile` for the frontend/backend and a `docker-compose.yml` that provisions the app container along with a PostgreSQL database container.

**Technology Stack:**
*   **Frontend:** React (Next.js App Router) with Tailwind CSS. Use Framer Motion for whimsical, bouncy UI animations.
*   **Backend:** Node.js (Next.js API routes) with RESTful API architecture.
*   **Database:** PostgreSQL (utilizing `JSONB`).
*   **Authentication:** NextAuth.js configured for Google, GitHub, Apple, Passkeys, and Credentials.
*   **AI Integration:** Vercel AI SDK.

**IMPORTANT DESIGN INSTRUCTION:**
Codex MUST use defined "skills" for the design and look and feel of the site (refer to DESIGN.md and AGENTS.md). Skills are required for the agent to properly craft the UX/UI. Do not rely on generic layouts.

#### Core Features:
1. **The AI Job Interviewer:** Converts rambling transcripts into polished bullet points.
2. **The Reverse Mock Interviewer:** Context-aware interview prep against saved job history.
3. **Document Generator:** AI resume and cover letter builder.
4. **Smart Network & Colleague Graph:** CRM for professional relationships.
5. **Life Tracking Modules:** Master Residence & License/Education Tracker.
6. **GitHub Project & Issue Integration:** Feedback loop tied to GitHub repo and projects.
7. **The "CareerGroove" User Experience:** Ambient background audio player, Framer Motion animations, and AI Settings config page.

#### Instructions for Codex:
1.  **Database & Docker Setup:** Provide the `docker-compose.yml`, `Dockerfile`, and PostgreSQL schema.
2.  **Authentication:** NextAuth.js `route.ts`.
3.  **AI Wrapper:** Backend API route for provider switching.
4.  **GitHub API Logic:** Functions to create issues and project board cards via Octokit/GraphQL.
5.  **Design via Skills:** Execute design skills to generate the React components, Framer Motion specs, and music player layout as outlined in `DESIGN.md`.