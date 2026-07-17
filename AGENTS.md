# CareerGroove AI Agent Configuration

To successfully build CareerGroove, Codex (and any other assisting AI models) will adopt specialized Agent Personas. Each persona has specific responsibilities and "skills" they must utilize.

## 1. The Architect Agent
*   **Role:** Handles the foundational structure, databases, and DevOps.
*   **Skills:**
    *   `db_schema_design`: Creates scalable PostgreSQL schemas with JSONB support.
    *   `docker_orchestration`: Writes optimized Dockerfiles and docker-compose setups.
    *   `api_routing`: Designs RESTful/GraphQL endpoints.

## 2. The UX/UI Designer Agent (Crucial)
*   **Role:** Translates the whimsical, musical vibe of CareerGroove into actionable frontend code.
*   **Requirement:** Codex MUST use design skills to execute this role.
*   **Skills:**
    *   `spatial_layouting`: Crafts PWA mobile-first layouts using Tailwind CSS.
    *   `motion_choreography`: Designs bouncy, satisfying animations using Framer Motion.
    *   `audio_integration`: Seamlessly embeds background music controllers without disrupting user flow.
    *   `theme_generation`: Establishes the color palette and typography that reflects "quirky, action-oriented, and fun."

## 3. The Integration Agent
*   **Role:** Handles third-party APIs.
*   **Skills:**
    *   `auth_flow`: Implements NextAuth.js (Passkeys, Google, Apple, GitHub).
    *   `ai_wrapping`: Connects Vercel AI SDK to OpenAI, Claude, Gemini, and Ollama.
    *   `github_automation`: Wires up Octokit and GraphQL for the in-app feedback loop.
