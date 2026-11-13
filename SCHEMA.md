# Dicționar de date (generat din migrările 0001–0002)

> Generat automat din schema validată local. Regenerează-l după orice migrare nouă (vezi `docs/OPERATIONS.md`).

Convenții: `status` = `draft → pending_review → published | rejected | archived`. Doar staff poate seta `published`/`rejected` (trigger `guard_status`).


## `audit_log`

**Vizibilitate:** Doar staff · **Politici RLS:** 1

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | bigint | nu | `nextval('audit_log_id_seq'::regclass)` |
| `actor_id` | uuid | da |  |
| `action` | text | nu |  |
| `table_name` | text | nu |  |
| `row_id` | uuid | da |  |
| `old_data` | jsonb | da |  |
| `new_data` | jsonb | da |  |
| `created_at` | timestamp with time zone | nu | `now()` |

## `collaboration_responses`

**Vizibilitate:** Respondentul + organizatorul + staff · **Politici RLS:** 3

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `collaboration_id` | uuid | nu |  |
| `user_id` | uuid | nu | `auth.uid()` |
| `respondent_type` | text | da |  |
| `message` | text | nu |  |
| `status` | text | nu | `'new'::text` |
| `created_at` | timestamp with time zone | nu | `now()` |

## `collaborations`

**Vizibilitate:** Public când `published` · **Politici RLS:** 4

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `created_by` | uuid | da | `auth.uid()` |
| `ngo_id` | uuid | da |  |
| `title` | text | nu |  |
| `type` | text | nu |  |
| `category` | text | da |  |
| `description` | text | da |  |
| `location` | text | da |  |
| `deadline` | date | da |  |
| `is_open` | boolean | nu | `true` |
| `status` | USER-DEFINED | nu | `'draft'::content_status` |
| `rejection_reason` | text | da |  |
| `created_at` | timestamp with time zone | nu | `now()` |
| `updated_at` | timestamp with time zone | nu | `now()` |

## `comments`

**Vizibilitate:** Public când `published` · **Politici RLS:** 4

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `post_id` | uuid | nu |  |
| `user_id` | uuid | nu | `auth.uid()` |
| `body` | text | nu |  |
| `status` | USER-DEFINED | nu | `'published'::content_status` |
| `created_at` | timestamp with time zone | nu | `now()` |
| `updated_at` | timestamp with time zone | nu | `now()` |

## `event_registrations`

**Vizibilitate:** Utilizatorul + organizatorul + staff · **Politici RLS:** 4

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `event_id` | uuid | nu |  |
| `user_id` | uuid | nu | `auth.uid()` |
| `full_name` | text | da |  |
| `email` | text | da |  |
| `status` | text | nu | `'registered'::text` |
| `created_at` | timestamp with time zone | nu | `now()` |

## `events`

**Vizibilitate:** Public când `published` · **Politici RLS:** 4

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `created_by` | uuid | da | `auth.uid()` |
| `ngo_id` | uuid | da |  |
| `title` | text | nu |  |
| `description` | text | da |  |
| `category` | text | da |  |
| `starts_at` | timestamp with time zone | nu |  |
| `ends_at` | timestamp with time zone | da |  |
| `is_online` | boolean | nu | `false` |
| `venue` | text | da |  |
| `city` | text | da |  |
| `address` | text | da |  |
| `capacity` | integer | da |  |
| `registration_deadline` | timestamp with time zone | da |  |
| `status` | USER-DEFINED | nu | `'draft'::content_status` |
| `rejection_reason` | text | da |  |
| `created_at` | timestamp with time zone | nu | `now()` |
| `updated_at` | timestamp with time zone | nu | `now()` |
| `image_url` | text | da |  |

## `follows`

**Vizibilitate:** Doar proprietarul · **Politici RLS:** 1

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `user_id` | uuid | nu | `auth.uid()` |
| `ngo_id` | uuid | da |  |
| `person_id` | uuid | da |  |
| `created_at` | timestamp with time zone | nu | `now()` |

## `funding_opportunities`

**Vizibilitate:** Public când `published`; scriere doar staff · **Politici RLS:** 2

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `created_by` | uuid | da | `auth.uid()` |
| `title` | text | nu |  |
| `funder` | text | da |  |
| `type` | text | da |  |
| `amount_text` | text | da |  |
| `deadline` | date | da |  |
| `categories` | ARRAY | nu | `'{}'::text[]` |
| `description` | text | da |  |
| `source_url` | text | da |  |
| `status` | USER-DEFINED | nu | `'draft'::content_status` |
| `created_at` | timestamp with time zone | nu | `now()` |
| `updated_at` | timestamp with time zone | nu | `now()` |

## `ngo_members`

**Vizibilitate:** Membrul / owner ONG / staff · **Politici RLS:** 2

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `ngo_id` | uuid | nu |  |
| `user_id` | uuid | nu |  |
| `role` | text | nu | `'editor'::text` |

## `ngos`

**Vizibilitate:** Public când `published`; autorul/membrii văd și ciornele · **Politici RLS:** 4

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `created_by` | uuid | da | `auth.uid()` |
| `name` | text | nu |  |
| `tagline` | text | da |  |
| `description` | text | da |  |
| `category` | text | da |  |
| `city` | text | da |  |
| `address` | text | da |  |
| `lat` | double precision | da |  |
| `lng` | double precision | da |  |
| `website` | text | da |  |
| `contact_email` | text | da |  |
| `founded_year` | integer | da |  |
| `status` | USER-DEFINED | nu | `'draft'::content_status` |
| `rejection_reason` | text | da |  |
| `created_at` | timestamp with time zone | nu | `now()` |
| `updated_at` | timestamp with time zone | nu | `now()` |
| `logo_url` | text | da |  |

## `notifications`

**Vizibilitate:** Doar destinatarul; create doar de triggere · **Politici RLS:** 2

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `user_id` | uuid | nu |  |
| `type` | text | nu |  |
| `message` | text | nu |  |
| `entity_type` | text | da |  |
| `entity_id` | uuid | da |  |
| `read_at` | timestamp with time zone | da |  |
| `created_at` | timestamp with time zone | nu | `now()` |

## `people`

**Vizibilitate:** Public când `published` · **Politici RLS:** 4

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `created_by` | uuid | da | `auth.uid()` |
| `user_id` | uuid | da |  |
| `ngo_id` | uuid | da |  |
| `name` | text | nu |  |
| `role` | text | da |  |
| `bio` | text | da |  |
| `city` | text | da |  |
| `public_contact` | text | da |  |
| `status` | USER-DEFINED | nu | `'draft'::content_status` |
| `rejection_reason` | text | da |  |
| `created_at` | timestamp with time zone | nu | `now()` |
| `updated_at` | timestamp with time zone | nu | `now()` |

## `post_likes`

**Vizibilitate:** Citire publică; scriere proprie · **Politici RLS:** 3

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `post_id` | uuid | nu |  |
| `user_id` | uuid | nu | `auth.uid()` |
| `created_at` | timestamp with time zone | nu | `now()` |

## `posts`

**Vizibilitate:** Public când `published` · **Politici RLS:** 4

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `author_id` | uuid | nu | `auth.uid()` |
| `ngo_id` | uuid | da |  |
| `type` | text | nu | `'update'::text` |
| `body` | text | nu |  |
| `event_id` | uuid | da |  |
| `collaboration_id` | uuid | da |  |
| `funding_id` | uuid | da |  |
| `status` | USER-DEFINED | nu | `'published'::content_status` |
| `created_at` | timestamp with time zone | nu | `now()` |
| `updated_at` | timestamp with time zone | nu | `now()` |

## `profiles`

**Vizibilitate:** Citire publică; edit doar proprietar · **Politici RLS:** 2

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu |  |
| `display_name` | text | da |  |
| `avatar_url` | text | da |  |
| `bio` | text | da |  |
| `profile_type` | text | da |  |
| `created_at` | timestamp with time zone | nu | `now()` |
| `updated_at` | timestamp with time zone | nu | `now()` |

## `projects`

**Vizibilitate:** Public când `published` · **Politici RLS:** 4

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `created_by` | uuid | da | `auth.uid()` |
| `ngo_id` | uuid | nu |  |
| `title` | text | nu |  |
| `description` | text | da |  |
| `lifecycle` | text | nu | `'planned'::text` |
| `starts_on` | date | da |  |
| `ends_on` | date | da |  |
| `status` | USER-DEFINED | nu | `'draft'::content_status` |
| `rejection_reason` | text | da |  |
| `created_at` | timestamp with time zone | nu | `now()` |
| `updated_at` | timestamp with time zone | nu | `now()` |

## `reports`

**Vizibilitate:** Raportorul + staff · **Politici RLS:** 3

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `reporter_id` | uuid | nu | `auth.uid()` |
| `entity_type` | text | nu |  |
| `entity_id` | uuid | nu |  |
| `reason` | text | nu |  |
| `status` | text | nu | `'open'::text` |
| `created_at` | timestamp with time zone | nu | `now()` |

## `resources`

**Vizibilitate:** Public când `published` · **Politici RLS:** 4

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `id` | uuid | nu | `gen_random_uuid()` |
| `created_by` | uuid | da | `auth.uid()` |
| `title` | text | nu |  |
| `type` | text | da |  |
| `category` | text | da |  |
| `description` | text | da |  |
| `url` | text | da |  |
| `storage_path` | text | da |  |
| `status` | USER-DEFINED | nu | `'draft'::content_status` |
| `rejection_reason` | text | da |  |
| `created_at` | timestamp with time zone | nu | `now()` |
| `updated_at` | timestamp with time zone | nu | `now()` |

## `saved_funding`

**Vizibilitate:** Doar proprietarul · **Politici RLS:** 1

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `user_id` | uuid | nu | `auth.uid()` |
| `funding_id` | uuid | nu |  |
| `created_at` | timestamp with time zone | nu | `now()` |

## `user_roles`

**Vizibilitate:** Propriul rol / staff; scriere doar prin SQL/service role · **Politici RLS:** 1

| Coloană | Tip | Null | Implicit |
|---|---|---|---|
| `user_id` | uuid | nu |  |
| `role` | USER-DEFINED | nu |  |