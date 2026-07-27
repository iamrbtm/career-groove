# CareerGroove Business Plan

Last updated: July 27, 2026

## 1. Executive Summary

CareerGroove is a mobile-first career operating system for job seekers who need more than a resume builder. The product combines a personal career CRM, job application tracker, AI resume and cover-letter generation, interview preparation, follow-up workflows, brand polishing, and outcome analytics into one account that works across web, iOS, and a browser extension.

The core insight is that job seekers repeatedly rebuild the same story for every resume, cover letter, interview, LinkedIn update, recruiter message, and application form. CareerGroove makes the user's real career history the source of truth, then turns it into the next best action for each opportunity.

The current product already includes the foundation for a freemium subscription business:

- Free plan: limited role tracking, basic resume generation, journey chapters, kanban/application capture, and starter workflow value.
- Pro plan: unlimited role tracking, premium AI, interview prep, resume and cover-letter remixing, application scoring, document export, bring-your-own API key support, and future core features.
- Pricing surfaced in the app: $15 monthly, $99 yearly, and a $199 lifetime early-bird plan.
- Monetization rails: Stripe checkout for web and StoreKit product identifiers for iOS.

CareerGroove should launch first as a direct-to-consumer product for active job seekers, then expand into career coaches, bootcamps, alumni groups, workforce programs, and universities once retention and conversion data validate the workflow.

## 2. Company Purpose

### Mission

Help people turn their lived work history into organized, credible, actionable career momentum.

### Vision

Become the personal career memory layer that follows a person across job searches, promotions, layoffs, career pivots, networking, interviews, and professional brand updates.

### Brand Positioning

CareerGroove is the calm, structured, slightly playful alternative to blank-page job-search stress. It should feel approachable and motivating while handling private career data with professional seriousness.

## 3. Problem

Job search work is fragmented:

- Career history is scattered across resumes, LinkedIn, notes, old applications, memory, files, and conversations.
- Resume builders help produce documents but often do not preserve the full context behind achievements.
- Job trackers organize roles but usually stop short of guiding the next best action.
- AI tools can generate generic content quickly, but they often flatten the user's voice and proof unless grounded in personal history.
- Follow-ups, interview prep, recruiter contacts, outcomes, rejection patterns, and brand consistency are usually managed manually or ignored.

The result is wasted time, weak reuse of prior work, inconsistent applications, missed follow-ups, and limited learning from outcomes.

## 4. Solution

CareerGroove gives users one career workspace built around reusable personal context.

### Current Product Surface

- Career timeline: jobs, achievements, skills, residences, education, licenses, certifications, and contacts.
- Tracker Studio: saved applications, statuses, source data, salary fields, work mode, notes, job descriptions, interviews, documents, scores, outcomes, and follow-up dates.
- Command Sessions: daily guided job-search action lists such as capture role, research company, remix resume, draft cover letter, follow up, prep interview, log outcome, or archive.
- AI Job Interviewer: guided prompts that turn rough work history into stronger achievement language.
- Mock Interviewer: role-aware practice based on saved work history.
- Document Studio: queued resume and cover-letter generation with export support and application linking.
- Follow-Up Studio: templates, scheduled follow-ups, drafts, email connection tables, and overdue follow-up surfaces.
- Analytics Studio: source quality, response rate, interview rate, resume version signal, follow-up health, outcome mix, and role-fit trends.
- Brand Studio: LinkedIn, GitHub, portfolio/personal statement fields, keyword tracking, and consistency scoring.
- AI provider flexibility: OpenAI, Anthropic, Google, and local Ollama support, including encrypted per-user provider keys.
- Distribution surfaces: Next.js web app, installable PWA, iOS SwiftUI app, and Manifest V3 browser extension for job capture.

### Differentiation

CareerGroove is not just "generate a resume." It is a career memory and workflow system:

- Persistent source of truth: the product remembers the user's experience, contacts, outcomes, preferences, and prior drafts.
- Action guidance: Career DJ labels and Command Sessions suggest what to do next.
- Outcome learning: analytics connect applications, resumes, sources, interviews, offers, rejections, and follow-up behavior.
- User-control AI: server-managed premium AI, bring-your-own API key, and local Ollama support create trust and cost flexibility.
- Cross-platform continuity: web, PWA, iOS, push notifications, and browser capture all point back to the same account.

## 5. Target Customers

### Primary ICP: Active Knowledge-Work Job Seekers

People applying to multiple roles over weeks or months who need a system for tracking opportunities, tailoring materials, preparing for interviews, and learning from outcomes.

Key traits:

- Applying to 5+ roles per week.
- Uses LinkedIn, company career pages, job boards, and recruiters.
- Has enough prior experience that tailoring matters.
- Feels pain from repeated application work and messy tracking.
- Will pay for a better search when actively looking.

### Secondary ICPs

- Career pivoters: need help reframing existing experience for a new industry or role.
- Recently laid-off professionals: need calm workflow, emotional pacing, follow-ups, and fast document iteration.
- Early-career graduates: need interview preparation and guidance but may require lower-cost or institutional packaging.
- Career coaches: need client workspaces, structured intake, document generation, and progress visibility.
- Bootcamps, alumni associations, and workforce programs: need scalable tooling for resume, application tracking, interview prep, and reporting.

## 6. Market Context

The job-search software category is active and competitive. That is a positive demand signal, but CareerGroove needs sharper positioning than generic AI resume generation.

Relevant signals:

- The U.S. labor market still has large job-search volume. BLS reported 7.6 million job openings in May 2026, with 5.2 million hires and 5.1 million total separations. Source: https://www.bls.gov/news.release/jolts.htm
- AI use in job search is meaningful but trust-sensitive. NACE reported that only 33% of Class of 2025 graduating seniors used AI in their job search, with common uses including cover letters, interview prep, and resumes. Concerns included ethics, lack of expertise, and employer detection. Source: https://www.naceweb.org/job-market/trends-and-predictions/student-concerns-about-ai-tempering-their-use-of-it-in-job-search
- U.S. workers are aware of AI but cautious. Pew reported in 2025 that 52% of workers were worried about future workplace AI use, while workers using AI chatbots often valued speed more than quality. Source: https://www.pewresearch.org/social-trends/2025/02/25/u-s-workers-are-more-worried-than-hopeful-about-future-ai-use-in-the-workplace/
- Competitors are validating the category. Teal positions around AI resumes, job tracking, keyword matching, cover letters, interview tracking, and premium tiers. Source: https://www.tealhq.com/pricing
- Simplify validates browser-extension-led job-search workflow and autofill demand, with a Chrome Web Store listing showing a large installed base and high rating as of July 2026. Source: https://chromewebstore.google.com/detail/simplify-copilot-autofill/pbanhockgagggenencehbnadejlgchfc

### Market Interpretation

The opportunity is not to outspend large job platforms. The opportunity is to own the user-side workflow layer: the private, reusable memory of a person's career and job-search process.

## 7. Competitive Landscape

### Direct Competitors

- Teal: strong resume builder, job tracker, keyword matching, AI tools, templates, and career workflow.
- Simplify: strong browser extension, autofill, job tracker, job matching, and high-volume application workflow.
- Huntr: job tracking and search organization.
- Rezi, Kickresume, Resume.io, Enhancv: resume and cover-letter generation.
- LinkedIn: professional profile, job discovery, networking, Easy Apply.
- ChatGPT, Claude, Gemini: general-purpose writing and prep tools.

### CareerGroove Advantage

CareerGroove should compete on depth and trust rather than raw autofill:

- "Your career story as source of truth" instead of one-off document generation.
- Guided job-search operating rhythm instead of a static board.
- Outcome analytics that help users improve source selection and materials.
- Multi-provider and local AI options for privacy-conscious users.
- Mobile-native continuation, push reminders, and App Store billing.
- Whimsical but professional brand that makes job search less draining.

### Competitive Risk

Teal and Simplify can copy individual features. CareerGroove's defensibility needs to come from integrated user history, workflow habits, outcome data, and trust.

## 8. Business Model

### Revenue Streams

1. Freemium subscription
   - Free plan for acquisition and activation.
   - Pro subscription for active seekers who need unlimited tracking, premium AI, interview prep, document remixing, scoring, export, and BYOK.

2. Lifetime early-bird plan
   - Useful during early launch for cash flow and advocacy.
   - Should be capped or time-boxed to avoid long-term support liabilities.

3. App Store subscriptions
   - Monthly and yearly iOS products already appear in the iOS project.
   - Web Stripe subscriptions remain separate but visible to backend entitlement logic.

4. Future B2B/B2B2C
   - Career coach seats.
   - University/alumni/workforce program licenses.
   - Bootcamp cohort packages.
   - Outplacement partnerships.

### Current Pricing

- Free Forever: $0.
- Pro Monthly: $15/month.
- Pro Yearly: $99/year.
- Lifetime Early Bird: $199 once.

### Pricing Recommendation

Keep the current pricing for initial launch because it is simple and competitive against visible Teal+ monthly pricing. Revisit after conversion data:

- Keep Free generous enough to build trust and let users experience the career memory loop.
- Gate high-cost or high-intent features behind Pro: premium AI, unlimited tracked roles, document export, mock interviews, scoring, analytics depth, and BYOK.
- Consider a $12-$19 monthly range, $89-$129 annual range, and coach/team pricing after customer discovery.

## 9. Go-To-Market Strategy

### Launch Wedge

Lead with "Stop rebuilding your career story for every application."

The first funnel should emphasize:

- Capture your experience once.
- Save jobs from the browser.
- Get a next action for each role.
- Generate tailored materials from real history.
- Track follow-ups and interviews.
- Learn what is working.

### Channels

1. Content and SEO
   - "How to track job applications without a spreadsheet"
   - "How to turn rough work history into resume achievements"
   - "Resume version tracking: how to know what is working"
   - "Follow-up templates by job-search stage"
   - "Interview prep from your own work history"

2. Browser extension distribution
   - Chrome Web Store and Firefox Add-ons listings.
   - Job-board capture as the fastest acquisition wedge.
   - Use "save role to CareerGroove" as a low-friction first action.

3. Product-led growth
   - Free account with immediate role capture and one useful AI output.
   - Upgrade prompts when users hit meaningful moments: more roles, document export, mock interview, premium AI, scoring, and analytics.

4. Partnerships
   - Career coaches.
   - Bootcamps and certificate programs.
   - Alumni communities.
   - Workforce development organizations.

5. Community-led distribution
   - Build in public around job-search workflows.
   - Share templates, checklists, and anonymized search strategy insights.

### First 90-Day Launch Plan

Month 1:

- Tighten onboarding around first value: add one role, add one career chapter, generate one tailored artifact.
- Publish extension install instructions and package the browser extension for distribution.
- Define activation metrics and events.
- Recruit 20-30 beta users from job-seeker communities.

Month 2:

- Improve upgrade moments and pricing page conversion.
- Add lightweight lifecycle emails/push notifications for follow-up, document completion, and inactive search sessions.
- Publish 6-10 SEO pages around application tracking, resume bullets, follow-ups, and interview prep.
- Interview beta users weekly.

Month 3:

- Launch paid web subscription publicly.
- Submit iOS app/TestFlight or App Store build after Apple Developer prerequisites are complete.
- Pilot with 2-3 career coaches or small cohorts.
- Use analytics to identify retention drivers and feature drop-off.

## 10. Product Roadmap

### Near Term

- Polish onboarding and first-run data capture.
- Package and publish browser extension.
- Finish iOS signing, Apple capabilities, StoreKit sandbox checks, APNs checks, and TestFlight.
- Strengthen entitlement boundaries for Free vs Pro features.
- Add in-app export/import and backup confidence messaging for user trust.
- Add event instrumentation for acquisition, activation, conversion, and retention.

### Mid Term

- Application autofill assistance using saved profile data, while keeping user review before submission.
- Better job-source parsing and deduplication.
- Coach/client workspace mode.
- Shareable but privacy-controlled career profile or application packet.
- More advanced analytics: source ROI, resume version comparison, follow-up effectiveness, interview conversion, rejection intelligence.
- Template marketplace for coaches or expert workflows.

### Long Term

- Career memory graph across roles, skills, achievements, contacts, companies, and outcomes.
- Proactive job-search agent that suggests weekly strategy based on user preferences and historical outcomes.
- Institution dashboards for cohort progress.
- Negotiation and offer comparison workflows.
- Professional network warm-intro mapping.

## 11. Operations Plan

### Technology Stack

- Next.js, React, TypeScript, Tailwind CSS, Framer Motion.
- PostgreSQL with user-scoped tables and JSONB for flexible career/application data.
- Auth.js with credentials, Google, GitHub, Apple, and passkey support.
- AI SDK integrations for OpenAI, Anthropic, Google, and Ollama.
- Stripe for web billing.
- StoreKit/App Store Server Notifications for iOS billing.
- Docker Compose deployment with app, database, Ollama, workers, and backup scheduler.
- SwiftUI iOS app using the same backend API.
- Manifest V3 browser extension for role capture.

### Data and Trust

CareerGroove stores sensitive professional data, private job-search activity, application outcomes, and API keys. Trust should be a core selling point:

- Keep provider keys encrypted server-side.
- Be explicit that user data stays theirs.
- Avoid silent application submission; keep users in review/control.
- Publish a clear privacy policy before broad launch.
- Create account export/delete flows before scaling.

### Support Model

Early support should be founder-led:

- In-app feedback routed to GitHub Issues is already present.
- Add public support email and help docs.
- Track recurring support questions as product onboarding gaps.

## 12. Financial Model

### Revenue Assumptions

Initial DTC model:

- Free-to-paid conversion: 2%-6% once onboarding is tuned.
- Monthly ARPU: roughly $8-$15 depending on monthly/yearly mix and App Store fees.
- Annual plan should be pushed as the primary paid option to reduce churn during multi-month job searches.
- Lifetime plan should be treated as an early-customer acquisition tool, not the default long-term model.

### Cost Drivers

- AI inference for server-managed premium AI.
- Database and app hosting.
- Email delivery and notification infrastructure.
- App Store and Stripe fees.
- Customer support time.
- Browser extension and iOS maintenance.

### Unit Economics Strategy

- Use BYOK/local Ollama support to reduce AI cost for power users.
- Gate expensive AI workflows behind Pro.
- Queue document generation to manage cost and reliability.
- Prefer annual subscriptions to stabilize cash flow.
- Track AI cost per active Pro user and per generated document.

### Example Year-1 Operating Targets

These are planning targets, not current results:

- 5,000 registered users.
- 500 weekly active users.
- 150-300 Pro subscribers.
- $1,500-$3,500 monthly recurring revenue by month 12.
- AI gross margin above 70% after usage limits and BYOK adoption.
- 25%+ of active users saving at least 5 roles.
- 15%+ of active users generating at least one document.

## 13. Key Metrics

### Acquisition

- Landing page visitor to signup conversion.
- Browser extension installs.
- Source of signup.
- Cost per signup by channel.

### Activation

- First career chapter created.
- First job/application saved.
- First AI-generated bullet/document/interview session.
- First Command Session completed.
- Time to first useful output.

### Engagement

- Weekly active users.
- Applications saved per active user.
- Documents generated per active user.
- Follow-ups scheduled and completed.
- Interviews logged.
- Outcomes logged.

### Monetization

- Free-to-Pro conversion.
- Trial-to-paid conversion if trial is added.
- Monthly vs yearly mix.
- Churn and cancellation reasons.
- AI cost per Pro user.
- Revenue per active seeker.

### Outcome Metrics

- Interview rate.
- Response rate.
- Follow-up completion rate.
- Offer rate.
- Resume version positive signal.
- User-reported confidence and time saved.

## 14. Risks and Mitigations

### Risk: Competitive feature copying

Mitigation: focus on integrated career memory, outcome analytics, habit formation, and trusted AI controls.

### Risk: AI-generated content feels generic

Mitigation: ground generation in saved work history, achievements, outcomes, and user voice. Make review/edit flows central.

### Risk: Job seekers churn after landing a job

Mitigation: expand use cases beyond active search: career journaling, achievement tracking, brand upkeep, promotion prep, performance review prep, networking, and long-term career memory.

### Risk: AI costs exceed subscription revenue

Mitigation: usage limits, BYOK, local Ollama, queued generation, model routing, and premium gating.

### Risk: Sensitive data reduces trust

Mitigation: transparent privacy controls, export/delete, encryption, no data resale, clear AI provider disclosures, and user-controlled submission.

### Risk: App Store complexity delays mobile monetization

Mitigation: launch web subscriptions first, use TestFlight for retention validation, then complete Apple Developer setup and StoreKit production.

## 15. Milestones

### Pre-Launch

- Complete privacy policy, terms, support pages, and account deletion/export flows.
- Verify Stripe checkout and webhook entitlements.
- Package browser extension for Chrome/Firefox.
- Instrument core product events.
- Recruit beta users.

### Public Launch

- Publish landing page and pricing.
- Launch browser extension.
- Launch content funnel.
- Enable paid Pro upgrades.
- Track activation and conversion weekly.

### Scale

- Launch iOS app.
- Build coach/cohort offering.
- Add advanced analytics and shareable reports.
- Build partnership pipeline.

## 16. Source Notes

Codebase-derived facts came from the local CareerGroove repository, including README.md, DESIGN.md, db/schema.sql, app/api routes, landing components, iOS README/metadata, browser-extension README, Stripe billing code, and product docs.

External market and competitor references:

- BLS JOLTS May 2026: https://www.bls.gov/news.release/jolts.htm
- NACE student AI job-search use, January 2026: https://www.naceweb.org/job-market/trends-and-predictions/student-concerns-about-ai-tempering-their-use-of-it-in-job-search
- Pew workplace AI attitudes, February 2025: https://www.pewresearch.org/social-trends/2025/02/25/u-s-workers-are-more-worried-than-hopeful-about-future-ai-use-in-the-workplace/
- Teal pricing and feature positioning: https://www.tealhq.com/pricing
- Simplify Copilot Chrome Web Store listing: https://chromewebstore.google.com/detail/simplify-copilot-autofill/pbanhockgagggenencehbnadejlgchfc

## 17. Questions and Blanks

These are intentionally held until the end.

### Company and Legal

- Legal business name: [blank]
- Founder name(s): [blank]
- Business entity type and jurisdiction: [blank]
- Business address: [blank]
- Ownership split/cap table: [blank]
- Existing trademarks or trademark plans for CareerGroove: [blank]

### Launch Status

- Current production URL confirmation: [blank]
- Current registered user count: [blank]
- Current active user count: [blank]
- Current paying customer count: [blank]
- Current MRR/ARR: [blank]
- Current beta/tester list size: [blank]

### Financial Inputs

- Current hosting cost per month: [blank]
- Current AI/API cost per month: [blank]
- Target gross margin: [blank]
- Founder/customer support capacity per week: [blank]
- Budget for first 90 days of marketing: [blank]
- Budget for App Store/Apple Developer setup: [blank]

### Product Decisions

- Should lifetime early-bird remain available after launch? [blank]
- Free plan hard limits beyond 5 tracked roles: [blank]
- Pro AI usage limits or fair-use policy: [blank]
- Whether BYOK should be Free, Pro, or both: [blank]
- Whether local Ollama should be positioned as privacy feature, power-user feature, or self-hosting feature: [blank]
- Whether browser extension should focus first on capture only or capture plus autofill: [blank]

### Market and Customer Focus

- First launch niche: general job seekers, software/tech workers, early-career graduates, laid-off professionals, career pivoters, or coaches: [blank]
- Geographic focus: U.S. only or broader English-speaking market: [blank]
- First partnership category: coaches, bootcamps, universities, workforce programs, or alumni groups: [blank]
- Target customer willingness-to-pay from interviews: [blank]

### Go-To-Market

- Preferred founder-led channel: content, community, paid ads, partnerships, direct outreach, or App Store/browser marketplaces: [blank]
- Launch date target: [blank]
- Public demo/video availability: [blank]
- Support email and help center URL: [blank]
- Privacy policy and terms URLs: [blank]

### Measurement

- Analytics stack decision: [blank]
- North-star metric: [blank]
- Activation event definition: [blank]
- Paid conversion goal: [blank]
- Churn goal: [blank]
