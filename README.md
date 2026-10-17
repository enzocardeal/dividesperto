# dividesperto

## What the app does

dividesperto is an expense splitting app for a closed group of friends.
The interface is in Brazilian Portuguese (pt-BR) and every amount is in BRL.
The app stores every amount as an integer number of cents.

- **Login:** Google login only. An invite gate refuses every email that is not on the allow-list.
- **Groups:** a group holds the expenses and payments of one trip or event.
- **Expenses:** one person pays. The expense splits by equal parts, exact values, percent, shares or line items.
- **Payments:** a payment records money that one member gives to another member.
- **Balances:** the app calculates balances from expenses and payments. The app stores no balance.
- **Two balance views:** the Saldos tab has two views. "Simplificada" shows the minimum list of transfers. "Completa" shows who owes whom for the expenses, after the payments. "Marcar como pago" records one line of either view as a payment.
- **Overall balances:** the "Saldos gerais" page and the Home card show your lines in each group, in the view that you chose. Each line of an active group has "Marcar como pago".
- **Activity history:** the Atividade tab shows every change, with the values before and after it.

Production URL: <https://dividesperto.vercel.app>

## Architecture

The app has three layers. The browser never writes to the database.

```
 Browser (client components)
   |  form submit = server action call        Google button only
   v                                                |
 Next.js on Vercel (functions in gru1)              |
   proxy.ts            session refresh, redirects   |
   server components   read through data.ts files   |
   server actions      app/groups/actions.ts        |
   route handlers      /api/invite, /api/cron/...   |
   |  user session (RLS applies)    secret key      |
   v                                                v
 Supabase (sa-east-1)
   Auth: Google provider, before-user-created hook -> invited_emails
   Postgres: SELECT-only grants, RLS on every table, balance views
             security definer RPCs for every write -> activity_log
```

### Browser

- Client components show forms, previews and buttons.
- Client components call server actions. They never write to the database.
- The Google button (`app/login/google-button.tsx`) is the only browser code that calls Supabase.

### Next.js on Vercel

- `proxy.ts` refreshes the Supabase session on every request.
- `proxy.ts` sends a signed-out user to `/login` and a signed-in user away from `/login` and `/invite`.
- Server components read data through `app/groups/data.ts` and `app/balances/data.ts`.
- These reads use the session of the user, so RLS returns only the rows of that user.
- Server actions in `app/groups/actions.ts` calculate the splits and call one RPC per write.
- Server actions also use the session of the user.
- Two route handlers use the secret key: `/api/invite` and `/api/cron/keepalive`. No other code uses it.

In this README, an RPC is a Postgres function that the app calls with `supabase.rpc()`.

### Supabase

- Auth accepts Google sign-in only in production.
- The `before_user_created_hook` function refuses a new user whose email is not in `invited_emails`.
- The `authenticated` role has SELECT only on the app tables.
- The migrations enable and force RLS on every table.
- Balances are views with `security_invoker = true`, so RLS also filters them.
- Every write goes through a `security definer` RPC.
- Each RPC checks group membership, archived groups, sums and stale balances.
- Each RPC writes a row to `activity_log` with the before and after snapshot.

### Shared calculation code

`lib/` holds pure TypeScript with no database access.
The money code (`lib/money/`), the split code (`lib/expenses.ts`) and the settlement code (`lib/settlement/`) are there.
The same code runs in the browser preview and in the server action.
Thus the preview always shows the amounts that the app saves.
The database checks the result. It never calculates the splits again.

### Balance views

The settlement ledger (`lib/settlement/ledger.ts`) replays the live expenses and payments of one group into a debt graph.
A payment pays the debt chains between payer and receiver first. Any rest becomes a debt in the other direction.
A person with a net of zero keeps no line: the ledger joins the debts through that person.
"Completa" shows the edges of the graph. "Simplificada" shows the minimum transfer list and prefers a list that follows the debt chains.
Server components run the ledger on rows that RLS returns. The ledger writes nothing.

The `ds_balance_view` cookie stores the chosen view for each browser. The server reads it, so the first HTML shows the chosen view.
"Marcar como pago" calls the `settle_line` RPC with the ledger version, which is the newest `activity_log` id of the group.
When the version changed, the RPC refuses with "Os saldos mudaram. Atualize a página."

### Security rule

Checks in the frontend are for the user experience only.
Postgres enforces every rule.
The RLS test (`scripts/rls-test.ts`) proves this against a local Supabase stack in CI.

### Folders

| Folder | Contents |
|---|---|
| `app/` | Pages, layouts, server actions, data reads and route handlers |
| `components/` | Shared client and server UI components |
| `lib/` | Pure TypeScript (money, splits, settlement, strings) and the Supabase clients in `lib/supabase/` |
| `supabase/migrations/` | SQL migrations: tables, grants, RLS policies, views and RPCs |
| `scripts/` | The RLS integration test |
| `docs/` | The [phone checklist](docs/phone-checklist.md) for manual release checks |

## Stack

| Part | Version | Source |
|---|---|---|
| Next.js | 16.4.2 | `package.json` |
| React | 19.3.0 | `package.json` |
| `@supabase/ssr` | ^0.12.7 | `package.json` |
| `@supabase/supabase-js` | ^2.118.0 | `package.json` |
| Tailwind CSS | v4 (dev dependency) | `package.json` |
| TypeScript | ^5 | `package.json` |
| Node.js | 22.18 or newer in the 22 line | `engines` in `package.json`, `.nvmrc` |
| Supabase CLI | 2.121.0 in CI | `.github/workflows/ci.yml` |

Hosting:

- Vercel Hobby plan. The functions run in `gru1` (São Paulo).
- Supabase free plan. The project is in `sa-east-1` (São Paulo).

## Local setup

### Prerequisites

- Node.js 22.18 or newer. Run `nvm use` to select the version from `.nvmrc`.
- The Supabase CLI from Homebrew: `brew install supabase/tap/supabase`.
- Docker or Podman. With Podman, set `DOCKER_HOST` to the Podman socket.

Node.js 22.18 runs TypeScript files without a build step. The tests need this.

### Steps

1. Install the dependencies.

   ```sh
   npm ci
   ```

2. Start the local Supabase stack. Supabase applies every migration on start.

   ```sh
   SUPABASE_AUTH_EMAIL_ENABLE_SIGNUP=true supabase start
   ```

   On Podman, add `-x vector`. The `vector` log container does not start on Podman.

   ```sh
   SUPABASE_AUTH_EMAIL_ENABLE_SIGNUP=true supabase start -x vector
   ```

3. Read the local URL and keys.

   ```sh
   supabase status -o env
   ```

4. Create `.env.local` with the values from step 3. Git ignores this file.

   ```sh
   NEXT_PUBLIC_SUPABASE_URL=<API_URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
   SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
   INVITE_CODE=<any local code>
   CRON_SECRET=<any local secret>
   ```

5. Start the development server on <http://localhost:3000>.

   ```sh
   npm run dev
   ```

### Email sign-up on the local stack

`supabase/config.toml` sets `enable_signup = false` for email.
`SUPABASE_AUTH_EMAIL_ENABLE_SIGNUP=true` turns email sign-up on for the local stack only.
The RLS test needs it, because the test creates users with email and password.
Production has Google sign-in only.
The app has no email login form, so email sign-up does not help you sign in through the UI.

### Sign in through the UI on the local stack

`supabase/config.toml` has no Google provider.
To sign in locally, add an `[auth.external.google]` section with your own Google OAuth client.
Set the redirect URI of that client to `http://127.0.0.1:54321/auth/v1/callback`.
Do not commit this change.

The hook also applies on the local stack.
Put your email in `invited_emails` before the first sign-in.
Use the `/invite` page with the `INVITE_CODE` from `.env.local`.
You can also insert the row in Supabase Studio at <http://127.0.0.1:54323>.

### Cleanup

Stop the stack and delete its data.

```sh
supabase stop --no-backup
```

On Podman, also delete the volumes that remain.

```sh
docker volume ls -q --filter name=_dividesperto | xargs docker volume rm
```

## Scripts

| Script | What it does | Needs |
|---|---|---|
| `npm run dev` | Starts the Next.js development server. | `.env.local` and a Supabase stack |
| `npm run build` | Builds the production app. | The `NEXT_PUBLIC_` env vars, because the build puts them into the browser code |
| `npm start` | Serves the production build. | `npm run build` first |
| `npm run typecheck` | Runs `next typegen` to generate the route types, then `tsc --noEmit`. | Nothing |
| `npm test` | Runs `node --test` on `lib/**/*.test.ts`. | Nothing |
| `npm run test:rls` | Runs `scripts/rls-test.ts` against the local stack. It reads the keys from `supabase status`. | A running local stack with email sign-up on |

CI (`.github/workflows/ci.yml`) runs on every push to `main` and on every pull request.
CI runs `typecheck`, the unit tests and the RLS test.

## Database changes

Migrations are in `supabase/migrations/`. Each file name starts with a 4-digit number, for example `0007_balance_views.sql`.

- Never edit a migration that the production database has. Add a new migration.
- Vercel deploys each push to `main` immediately. Thus push the migration to Supabase immediately after the git push.

  ```sh
  supabase db push --linked
  supabase migration list --linked
  ```

- The second command must show the new migration on the local and the remote side.
- Link the project once before the first push: `supabase link --project-ref <project ref>`.

### Rules for a new table

- Grant SELECT only to `authenticated`. Revoke all from `anon` and `authenticated` first.
- Enable and force RLS. Add a SELECT policy that checks `is_group_member` for the group of the row.
- Do every write through a `security definer` RPC with `set search_path = ''`.
- In the RPC, check membership with `is_group_member` and refuse an archived group.
- Write the change to `activity_log`.
- Revoke execute on each new function from `anon` and `public`.
- Raise a custom SQLSTATE for each expected refusal.
- Map each code to a pt-BR message in `lib/`.
- Add a unit test that reads the migration and checks that every raised code has a message.
- The existing `DS0xx` codes and `lib/groups.test.ts` show this pattern.
- Add the new table and RPCs to `scripts/rls-test.ts`.

## Deployment

### Vercel

- Import the GitHub repository. Vercel deploys every push to `main`.
- Framework preset: Next.js. `vercel.json` also sets it.
- Function region: `gru1`.

Environment variables (production):

| Name | Read by | Use |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/env.ts`, `lib/supabase/admin.ts` | The Supabase API URL. The browser also gets it. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase/env.ts` | The publishable key. The browser also gets it. RLS applies to it. |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/admin.ts` | The secret key. It bypasses RLS. Only `/api/invite` and `/api/cron/keepalive` use it. |
| `INVITE_CODE` | `app/api/invite/route.ts` | The code that the `/invite` page asks for. |
| `CRON_SECRET` | `app/api/cron/keepalive/route.ts` | Vercel sends it as a bearer token on each cron call. |

Never give the `NEXT_PUBLIC_` prefix to the secret key.

`vercel.json` runs `/api/cron/keepalive` every day at 09:00 UTC.
The route answers 401 when the `Authorization` header does not carry `CRON_SECRET`.
The route reads one user from Supabase Auth, so the Supabase project has traffic.

### Supabase

- Project region: `sa-east-1`.
- Auth providers: Google on, Email off.
- Site URL: `https://dividesperto.vercel.app`.
- Redirect URLs: `https://dividesperto.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`.
- Auth hook "Before User Created": Postgres function `public.before_user_created_hook`.
- Apply the migrations with `supabase db push --linked`.

### Google Cloud

- Create an OAuth client of type "Web application".
- Add the Supabase callback URL as an authorized redirect URI: `https://<project ref>.supabase.co/auth/v1/callback`.
- Put the client ID and the client secret in the Google provider of Supabase.
- Publish the app on the OAuth consent screen. In "Testing" status, only listed test users can sign in.

## Invites

1. Give the invite code to a friend.
2. The friend opens `/invite`, types the code and an email, and taps "Liberar acesso".
3. `/api/invite` adds the email, in lower case, to `invited_emails`.
4. The friend signs in with Google with that email.

- `invited_emails` holds at most 10 rows. A trigger refuses the 11th row.
- The route accepts any valid email, not only Gmail addresses.
- An email with a typo also uses a slot. The app cannot delete it.
- To free a slot, delete the row by hand in the Supabase SQL editor.

To close the invites, delete `INVITE_CODE` in Vercel and redeploy.
After that, `/api/invite` answers 404.

## Known limits

- A member cannot leave a group, and nobody can remove a member. To fix a wrong member, archive the group and create a new one.
- A deleted expense or payment stays in the database with `deleted_at`. The app cannot restore it.
- Settlement happens inside one group only. "Saldos gerais" never nets a debt in one group against a credit in another group.
- An archived group is read-only and moves to the closed "Grupos arquivados" list on the home page.
- The lines of an archived group still count in "Saldos gerais" and on the Home card. They have no "Marcar como pago" button.
- The Home card shows the first 5 lines only. "Saldos gerais" shows all lines.
- The view choice is a cookie per browser. A new browser or a home screen app with its own cookie store starts with "Simplificada".
- Any change in a group makes an open Saldos page stale, also a rename or a new member. "Marcar como pago" then asks for a refresh.
- The app stores no allocation of payments. An edit of an old expense can move the lines that an old payment paid.
- A "Completa" line can join two people who never shared an expense. The line follows a real debt chain through a settled person.
- Sometimes no minimum transfer list follows the debt chains. Then a "Simplificada" payment can add a debt in the other direction to "Completa" until the people in the middle settle.
- An expense has one payer only.
- The settlement list is the exact minimum for up to 12 people with a balance. Above 12, it uses a greedy method.
- The expense and payment forms need JavaScript.
- The back arrow needs the Navigation API. Older Safari goes to the parent page instead.
- On screens narrower than about 284 px, pages scroll sideways.
- Supabase pauses a free project after 7 days with no traffic. The daily cron prevents this.

## License

See [LICENSE](LICENSE).
