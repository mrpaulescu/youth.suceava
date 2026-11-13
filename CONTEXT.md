# Youth Suceava — Repository Context & Implementation Roadmap

> Context document for contributors and coding agents. Reviewed against the `main` branch on 2026-11-13.

## 1. Repository purpose

**Youth Suceava** is intended to be a civic-community platform for Suceava and Bucovina. Its stated purpose is to centralize local civic activities and the people and organizations involved in them, making it easier for residents to discover opportunities, participate, collaborate, and understand civic initiatives.

The product should serve as a shared, searchable directory and participation layer for the local civic ecosystem—not merely a static showcase. The interface is Romanian-language and is designed around several connected kinds of community information.

### Main user-facing areas found in the current interface

- **Acasă (home/dashboard):** summary metrics, upcoming events, urgent collaboration opportunities, an NGO map preview, featured organizations, and the signed-in user's activity.
- **Flux (community feed):** posts, community updates, likes, comments, following, and optional links to events, collaborations, and funding opportunities.
- **Hartă ONG-uri:** NGO directory/map, category filters, organization cards, and organization detail pages.
- **Evenimente:** searchable/filterable events, location and schedule details, and participant registration.
- **Oameni:** people directory with role/category filters and person detail pages.
- **Colaborări:** requests for partners, volunteers, offers of help, and funding/collaboration opportunities, with a response flow.
- **Finanțări:** funding opportunity directory, deadlines, categories, and saved opportunities.
- **Resurse:** resources such as guides, templates, webinars, and datasets.
- **Detail and interaction surfaces:** NGO/person profiles, modal forms, notifications, follows, post creation, and registration/response interactions.

## 2. Current repository shape

The default branch is `main`. The repository is currently a small static web application:

| Path | Current role |
|---|---|
| `index.html` | Single-page application shell, navigation, view containers, large inline CSS block, modal and notification containers, and script imports. |
| `app.js` | Main application logic, view rendering, view-model mapping, filtering, modals, community feed interactions, and Supabase reads/writes. |
| `supabase.js` | Supabase project URL and anon/public client initialization. |
| `app.css` | Currently empty; most styling is embedded in `index.html`. |
| `README.md` | Very short project description; should eventually link to setup, schema, contribution, and deployment documentation. |
| `.claude/launch.json` | Local static development server configuration using Python's HTTP server on port 8000. |
| `.vscode/settings.json` | Editor configuration. |

There is no visible package manifest, build pipeline, migration directory, automated test suite, or separate server/API layer in the inspected tree.

## 3. Current implementation status and important observations

### Frontend

- The current UI is a single-page application with view containers in `index.html` and rendering/navigation functions in `app.js`.
- The visual design uses a warm paper-like palette, serif display typography, Inter body text, Tabler icons, cards, filters, a left navigation rail, and responsive layout rules.
- Much of the CSS is embedded in `index.html`; `app.css` is empty.
- Data is transformed into legacy view models in `app.js` before being rendered. Preserve or deliberately replace this mapping when introducing a normalized database model.

### Mock data

- The current arrays `NGOS`, `EVENTS`, `COLLABS`, `PEOPLE`, and `FUND` are initialized as empty arrays near the top of `app.js`, and populated by `loadPublicData()` from Supabase.
- Several other parts of the UI still contain demo/static content or behavior. Examples observed include hard-coded dashboard labels/counts or copy, profile composer identity text, a resource-open demo action, a demo share confirmation, and community-feed counts with an added fixed offset.
- Audit all displayed records, metrics, labels, seed-like constants, sample attachments, user identity placeholders, and success messages. Do not remove legitimate category/role/filter configuration constants; those are application metadata, not mock business records.
- Do not treat an empty array declaration as mock data: it is the current destination for live data.

### Existing Supabase integration (partial)

The app already initializes the Supabase JavaScript client in `supabase.js` and has a read/mapping layer in `app.js`.

Observed public reads in `loadPublicData()` target:

- `ngos`
- `people`
- `projects`
- `events`
- `collaborations`
- `funding_opportunities`
- `resources`
- `posts`
- `comments`

Observed user-scoped reads target:

- `event_registrations`
- `saved_funding`
- `post_likes`
- `follows`
- the signed-in user's `posts` and `comments`
- unread `notifications`

Observed writes include event registration/unregistration, saving funding opportunities, follow/unfollow, and post likes. However, several visible actions are still local-only or demo-only: comment creation in the feed, deleting a locally held post, publishing a post (currently pushes into client state), share behavior, and at least some response/contact/application workflows. Verify each action against the current code before assuming it is backed by persistence.

**Important:** the repository snapshot does not include SQL migrations/schema, so the exact database schema and RLS policies cannot be confirmed from the repo. The app's current queries establish the expected table names and some column names, but not the complete schema. The Supabase project URL and public anon key are present in `supabase.js`; the anon key is intended for browser use, but access must be constrained by correct RLS. Never put a service-role key or other secret in frontend code.

## 4. Product data model to formalize

Use the UI and current Supabase query/mapping code as the initial requirements source. Before writing SQL, inventory every field read, written, filtered, sorted, joined, or rendered. The following is a conceptual model; validate and refine it against actual forms and workflows.

### Core reference data

- **profiles** — one record per authenticated user; display name, avatar, contact preferences, profile/participation type, and timestamps. Link to `auth.users`.
- **ngos** — organization profile, category, status/moderation state, city/address/location, map coordinates, website and public contact details, description/tagline, founding year, and creator/owner.
- **people** — public or consented civic-person profile, role, organization association where applicable, biography and public contact fields. Avoid publishing private user contact data by default.
- **projects** — projects/initiatives belonging to an organization, description, lifecycle status, timeline, and creator.
- **categories / lookup values** — controlled categories and role/type/status values. These may be PostgreSQL enums or validated text/check constraints; choose a consistent approach.

### Activity and opportunity data

- **events** — title, description, category, organizer NGO, start/end timestamps, online flag, venue, city/address, capacity, publication/moderation status, creator, and timestamps.
- **event_registrations** — event/user relation, registration status, submitted name/email if needed, timestamps; unique constraint on (event_id, user_id).
- **collaborations** — title, type (partner/volunteer/offer/funding), category, description, location, deadline, organizer NGO/user, status, and timestamps.
- **collaboration_responses** — collaboration/user relation, respondent type, message, status, and timestamps. This is needed to replace the current response modal's demo-only confirmation.
- **funding_opportunities** — title, funder, type, amount/amount description, deadline, categories, description, source URL, status, and timestamps.
- **saved_funding** — user/funding relation, unique constraint on (user_id, funding_id).
- **resources** — title, type/format, category, description, external URL or Storage object path, publication status, creator, and timestamps.

### Community and engagement data

- **posts** — author user and/or organization/person relation, post type, body, optional attachment relation to event/collaboration/funding, moderation status, and timestamps.
- **comments** — post/user relation, body, moderation status, and timestamps.
- **post_likes** — post/user relation, unique constraint on (post_id, user_id).
- **follows** — user following an NGO or a person; enforce exactly one target per row and uniqueness per user/target.
- **notifications** — recipient, type/icon/color or structured metadata, message, read timestamp, related entity, and timestamps.

### Database and security requirements

- Use UUID primary keys for user-owned and relational records unless a well-justified compatibility constraint exists. Do not assume current demo numeric IDs will be valid UUIDs; remove hard-coded/demo IDs and use returned database IDs.
- Add foreign keys, indexes for common filters/joins/sort columns, sensible delete behavior, timestamps, and uniqueness constraints.
- Model status transitions explicitly (e.g. draft → pending_review → published; open → closed/archived). Do not let anonymous clients publish privileged directory records.
- Enable RLS on every exposed table. Public users should only read published/approved public records. Authenticated users should only mutate their own profile, registrations, saved items, follows, posts, comments, likes, and responses, subject to product rules.
- Add organization ownership/membership roles if organization representatives are allowed to submit or manage NGO, project, event, collaboration, funding, or resource records.
- Admin/moderator policies must be explicit and auditable. Prefer a protected role table or trusted claims validated server-side; never trust a client-supplied `is_admin` field.
- Validate all text, URL, date, capacity, and status fields. Prevent duplicate registrations, likes, follows, and saves with database constraints.
- Decide whether public contact fields belong on the NGO/person record or in private contact tables with controlled access.
- Use Supabase Storage for approved images/documents where appropriate, with bucket policies and size/type restrictions.
- Use database functions or Edge Functions for privileged actions, notifications, moderation, email, and other workflows that must not be trusted to the browser.
- Keep the Supabase anon/publishable key in the client only; store service-role keys and third-party secrets exclusively in Supabase secrets/server environment.

## 5. Implementation roadmap

The four requested workstreams are ordered so the data contract is established before the UI is switched to production workflows.

### Phase 1 — Design and create the SQL database

**Goal:** establish a version-controlled, reproducible schema that supports every data structure and interaction visible in the site.

Tasks:

1. Inspect all frontend fields and queries; create a field-level data dictionary with source UI, type, nullability, ownership, and public/private visibility.
2. Confirm existing Supabase project state before creating objects. Query `information_schema`, existing constraints, indexes, functions, triggers, RLS policies, and Storage buckets to avoid destructive duplication.
3. Write ordered SQL migrations under a dedicated directory (recommended: `supabase/migrations/`). Include extensions only when required, enums/check constraints, tables, foreign keys, indexes, triggers, and updated-at handling.
4. Create core tables first: profiles, organizations, people, projects, events, collaborations, funding opportunities, and resources.
5. Add engagement tables: registrations, collaboration responses, saved funding, posts, comments, likes, follows, and notifications.
6. Add RLS policies for anonymous reads, authenticated reads, owner writes, organization-member permissions, and admin/moderator workflows.
7. Add seed data only for explicitly approved reference categories or development fixtures. Production content must be entered through the website/admin workflow, not embedded in JavaScript.
8. Add schema documentation and a local/staging validation script. Test migrations against a clean database and, where possible, a copy of the existing project.

**Acceptance criteria:**

- A new environment can be built from migrations without manual SQL editing.
- Every table and column used by frontend queries exists and has documented semantics.
- All exposed tables have RLS enabled and tested for anonymous, ordinary-user, organization-representative, and admin roles.
- Constraints prevent duplicate or invalid relations and enforce valid status/category values.
- No secrets are committed.

### Phase 2 — Remove mock/demo content from the frontend

**Goal:** every content record, metric, user identity, and successful action shown by the site comes from real persisted data or an honest empty/loading/error state.

Tasks:

1. Search `index.html` and `app.js` for hard-coded example entities, names, emails, initials, IDs, counts, date labels, fake locations, placeholder posts, and demo arrays.
2. Separate legitimate static UI metadata (icons, category labels, filter definitions, empty-state copy) from mock business data.
3. Remove demo-only additions to metrics (including fixed offsets) and derive every metric from loaded data using explicit definitions.
4. Replace fixed user/profile identity text with the authenticated profile, or a neutral anonymous state.
5. Remove fake success claims for actions that have not completed on the server. Show success only after a successful database/API response.
6. Add loading, empty, permission-denied, validation, and retry states to every data-driven view.
7. Remove obsolete mock functions and any dead code that assumes demo entities exist.
8. Verify all views with an empty database and with realistic persisted records.

**Acceptance criteria:**

- No demo records or hard-coded personal data appear in production UI.
- Empty database state is usable and does not throw rendering errors.
- Dashboard metrics are calculated from real query results.
- No UI reports that an email was sent, a reservation confirmed, a file downloaded, a response delivered, or a post published unless that action actually succeeded.

### Phase 3 — Add user workflows for creating and managing website data

**Goal:** authorized users can create, edit, submit, and manage the same kinds of records that the platform displays.

Build role-aware forms and workflows aligned with the existing visual system. At minimum:

1. **Organization onboarding:** submit an NGO profile; edit organization details; add/manage representatives; submit for review.
2. **People/profile management:** edit own profile and visibility; optionally associate with an organization, with consent and authorization.
3. **Project management:** create and edit projects under an organization; set lifecycle state and dates.
4. **Event management:** create/edit events, choose category and online/physical details, set capacity and registration windows, publish or submit for review, and manage registrations.
5. **Collaboration workflow:** create a partner/volunteer/help/funding request; edit/close it; receive, review, and respond to applications/messages.
6. **Funding directory management:** authorized administrators/editors create and update opportunities, categories, amounts, source links, and deadlines. Ordinary users can save opportunities.
7. **Resource management:** submit title/type/description/URL or upload, review and publish; expose working open/download actions.
8. **Community feed:** create/edit/delete own posts; create comments; like/unlike; follow/unfollow; attach supported records; report/moderate content as appropriate.
9. **Notifications:** create notifications from successful server-side events and mark them read.
10. **Admin/moderation:** review pending submissions, approve/reject with reason, handle reports, manage categories, and audit changes.

**Workflow principles:**

- Use explicit role checks and ownership rules; hiding a button is not authorization.
- Use client-side validation for usability and database/server validation for security.
- Use drafts and submission/review states for public directory content.
- Provide clear form states: draft, submitting, submitted, pending review, published, rejected, and failed.
- Preserve entered form data on recoverable errors.
- After a successful write, refresh the affected data from Supabase rather than only mutating local arrays.
- Make create/edit flows accessible on mobile and keyboard-operable.

**Acceptance criteria:**

- Each displayed entity type has an authorized creation/editing path or a clearly documented admin-only path.
- A user can submit a record, see its status, edit it when permitted, and understand why it is rejected.
- Ownership and moderation rules are enforced by RLS/server logic, not only by frontend checks.
- Related records and counts update after successful writes.

### Phase 4 — Complete the backend and connect every frontend action

**Goal:** make the platform reliable, secure, and fully backed by Supabase rather than mixing database operations with local/demo state.

Tasks:

1. Consolidate Supabase access into a small data-access layer (e.g. modules for auth/profiles, organizations, events, collaborations, funding/resources, feed, and notifications).
2. Standardize error handling and return shapes. Check every Supabase response's `error`; avoid silently treating failed reads/writes as empty arrays.
3. Complete missing writes: posts, comments, post deletion/editing, collaboration responses, organization/event/project/resource submissions, notification read state, and share URLs.
4. Implement auth/profile bootstrap, profile update, role/membership lookup, sign-out, and session-aware navigation.
5. Implement server-side notifications and email only where required, using Edge Functions/database triggers and protected secrets.
6. Implement Storage uploads and access policies for avatars, organization logos, event images, and resource files if those assets are in scope.
7. Add pagination and server-side filtering/search for growing directories and feeds. Avoid loading all records and filtering everything in the browser indefinitely.
8. Add moderation/audit logging for public submissions and privileged changes.
9. Add operational safeguards: rate limits or abuse controls where appropriate, input validation, safe rendering/escaping, and duplicate-submit protection.
10. Add tests for data access, RLS, core workflows, and responsive UI. Include a smoke test for anonymous browsing and signed-in user journeys.
11. Document environment configuration, migrations, local development, deployment, backup/recovery, and operational ownership.

**Acceptance criteria:**

- Every visible action either performs a real authorized operation or is clearly disabled/not yet available; no fake success path remains.
- Public and private data access is verified under RLS.
- Failed reads/writes surface actionable errors and do not silently corrupt UI state.
- Core flows pass end-to-end tests on desktop and mobile.
- Setup and deployment can be repeated from repository documentation.

## 6. Suggested execution order and dependencies

1. **Audit and schema inventory** — map every rendered field and action to a database entity and authorization rule.
2. **Database migrations + RLS** — create the canonical data contract.
3. **Data-access layer** — typed/consistent read and write operations against that contract.
4. **Frontend mock cleanup** — remove fake data while adding loading/empty/error states.
5. **Creation and management workflows** — forms for each entity and moderation lifecycle.
6. **Complete backend operations** — feed, registrations, collaboration responses, follows, notifications, uploads, and other remaining writes.
7. **Verification** — migrations, RLS matrix, end-to-end workflows, mobile responsiveness, and deployment docs.

This retains the user's requested priorities while avoiding a fragile sequence where the frontend is stripped of content before the database and real submission workflows are ready. Work incrementally: each feature should move from schema → policy → data service → form/list/detail UI → tests.

## 7. Known risks and technical debt to address

- **Schema drift:** frontend query names/columns may not match the actual Supabase project's current schema; inspect the live schema before migrations.
- **Legacy view-model assumptions:** current renderers expect short IDs, initials, category codes, and denormalized fields. Normalize data at the data-access boundary and avoid coupling renderers to database internals.
- **Authorization gaps:** client-side `requireAuth()` is only a UX check; RLS must enforce each user's rights.
- **Partially persisted actions:** some interactions mutate browser memory or display demo confirmations without durable writes.
- **Unsafe HTML composition:** much of the interface is assembled with template strings and `innerHTML`. Escape all untrusted user/database content and avoid injecting unsanitized markup.
- **N+1/over-fetching and scalability:** public data currently loads multiple tables in parallel and maps relationships in memory. Add pagination and appropriate joins/views as usage grows.
- **Privacy:** personal contact data, profiles, registrations, and notifications need deliberate visibility rules and consent.
- **No visible migration/test infrastructure:** introduce repeatable migrations and tests before expanding workflows.

## 8. Contributor rules for future implementation

- Treat Supabase as the source of truth. Do not add new mock content to production code.
- Keep schema changes in version-controlled migrations; never rely on undocumented manual dashboard edits.
- Confirm the current live schema before altering or dropping tables/policies.
- Enforce authorization in RLS and trusted server-side code, never only in JavaScript.
- Do not expose service-role keys, private email addresses, or unpublished submissions.
- Reuse the current visual language and Romanian UX copy; support mobile layouts.
- For every new user-facing action, implement validation, loading, success, and error states and test the actual persistence.
- Keep this file updated when entity types, routes, schema, or workflow responsibilities change.

## 9. Immediate next tasks (suggested GitHub checklist)

- [ ] Inventory all frontend fields, queries, and actions; produce a schema/data dictionary.
- [ ] Inspect the existing Supabase database and RLS policies; record current state before migration.
- [ ] Create migrations for core entities and constraints.
- [ ] Create migrations for user activity/feed/notifications entities.
- [ ] Add and test RLS policies for anonymous, user, organization representative, and admin roles.
- [ ] Implement a consistent Supabase data-access layer and error handling.
- [ ] Remove hard-coded demo metrics, identities, and success messages.
- [ ] Add loading/empty/error states to every data-driven view.
- [ ] Build organization, project, event, collaboration, funding, and resource submission/edit workflows.
- [ ] Complete feed post/comment/like/follow persistence.
- [ ] Implement collaboration responses, notification creation/read state, and file uploads.
- [ ] Add moderation/admin screens and audit trail.
- [ ] Add desktop/mobile end-to-end tests and deployment documentation.

---

## Review scope and caveats

This context is based on the repository's visible `main` branch files (`README.md`, `index.html`, `app.js`, `supabase.js`, and the small repository tree) as inspected on 2026-11-13. The live Supabase schema, policies, database contents, deployed website behavior, and external configuration were not inspected. Therefore the proposed schema is a requirements-oriented blueprint, not a claim about tables that already exist in the hosted project. Confirm the actual Supabase project before applying migrations.
