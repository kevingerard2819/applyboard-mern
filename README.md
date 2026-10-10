# ApplyBoard

A MERN application for tracking job applications. Save roles, update their status, and keep notes in one place.

[Live demo](https://applyboard-mern.onrender.com) — click **Try demo workspace** to explore eight sample applications without signing up. The free Render instance may take about a minute to wake up after inactivity.

![ApplyBoard dashboard](docs/dashboard.png)

[Login page](docs/login.png) · [Kanban board](docs/kanban.png) · [Analytics view](docs/analytics.png)

## Features

- Create an account, sign in, and sign out. Each account has its own private applications, board, and analytics.
- Try the app without signing up using **Try demo workspace** on the login page. Each visitor gets eight fictional sample applications in an isolated, editable workspace that expires after 24 hours.
- Create, edit, and delete applications with company, role, location, posting URL, applied date, and notes.
- Move opportunities through Wishlist, Applied, Interview, Offer, and Rejected.
- Switch between a list and a Kanban board. Drag cards between stages, or use the status menu on touch devices and with a keyboard. Status changes persist after the API confirms the update.
- View current pipeline counts, active applications, and weekly application activity across eight weeks. Analytics use all records, regardless of search filters; weekly totals use the saved applied date and exclude wishlist entries, future dates, and undated records.
- Search companies, roles, and locations; combine search with status filters.
- Dashboard totals and interview/offer rate derived from saved records.
- Schedule interviews with a date, local time, and preparation notes; download a one-hour calendar event (`.ics`).
- Track up to ten interview rounds per application, each with its own date, preparation/feedback, and Scheduled, Completed, or Cancelled outcome.
- View the latest 50 activity entries per application, recorded by the API when details, status, interviews, or follow-ups change.
- Set follow-up dates and next steps. The agenda highlights today’s and overdue follow-ups, and lets you mark them complete.
- MongoDB persistence, server-side validation, accessible forms, responsive layout, loading and error states.
- Integration tests exercise a real isolated MongoDB process; GitHub Actions runs tests and the production build.

## Technologies

React 19, Vite, JavaScript ES modules, Node.js, Express 5, MongoDB, Mongoose, Zod, Helmet, Supertest, and Node's test runner. pnpm manages dependencies with a committed lockfile.

## Setup and installation

Prerequisites: Node.js 22.13 or newer, pnpm 11.25.0, and MongoDB 7+ (local, Docker, or MongoDB Atlas).

```sh
git clone https://github.com/kevingerard2819/applyboard-mern.git
cd applyboard-mern
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env` and configure `MONGODB_URI`. For example:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/applyboard
PORT=4000
```

With Docker installed, start MongoDB using `docker compose up -d`. For Atlas, replace `MONGODB_URI` with your connection string and configure database access/network access in Atlas. Keep credentials in `.env`; it is ignored by Git.

## Run the application

```sh
pnpm dev
```

Open **http://127.0.0.1:5173** and create an account. Vite proxies `/api` to Express at port 4000. Optional: `pnpm seed your@email.com` adds the same eight fictional examples as the demo to an existing account only when that account has no applications. It uses the database configured in `.env`.

For a quick review, click **Try demo workspace**. No credentials or manual seed step are needed. The samples cover all five stages, upcoming interview rounds, due follow-ups, and application dates across the analytics chart. Each click creates a new demo account, so visitors do not overwrite each other's changes. Demo accounts, their applications, and their sessions have expiry dates and MongoDB TTL indexes. Access stops after 24 hours; MongoDB removes expired data asynchronously. Regular accounts are not affected.
Keep `PORT=4000` when using the development proxy.

### No MongoDB installed?

```sh
pnpm dev:local
```

This downloads and starts a **real MongoDB server** and launches the API and frontend. The first run needs internet access and may take a few minutes. Data persists locally in `.cache/mongo-data`. Stop with Ctrl+C. This helper is for local development, and does not need a `.env` connection string.

To run the seed or legacy assignment commands with this helper, keep it running and copy the local MongoDB URI printed in its terminal into `.env` as `MONGODB_URI`. The port may change when the helper restarts.

### Production build

```sh
pnpm build
pnpm start
```

With a configured MongoDB connection, Express serves the built React app and API at **http://127.0.0.1:4000**.

For an HTTPS deployment, set `NODE_ENV=production` to enable Secure session cookies and `CLIENT_ORIGIN=https://your-domain.example` to allow the deployed frontend's origin. Production cookies require HTTPS. Keep the default development settings when running on localhost.

### Existing records from before accounts

Older applications are preserved but hidden until explicitly assigned to an account. Create your account, then run `pnpm assign:legacy your@email.com` with `.env` pointing to the same database. This assigns all records without an owner to the specified account; records already owned by an account are left alone.

### Deploy on Render

The included `render.yaml` defines a free Node web service that builds the frontend and serves it with the Express API. Connect this repository through Render's Blueprint setup, or create a Node web service on the `master` branch with these settings:

- Build: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
- Start: `pnpm start`
- Environment: `NODE_ENV=production`, `NODE_VERSION=22.22.0`, and `MONGODB_URI` pointing to a MongoDB Atlas database named `applyboard`.
- Health check: `/api/health`.

Store the database URI in Render's environment settings, never in the repository. Give a dedicated database user read/write access only to `applyboard`, and add Render's outbound IP ranges to Atlas's network access list. Render supplies `PORT` and the `RENDER` flag. The app binds to `0.0.0.0` in production and trusts Render's single HTTPS proxy so origin checks and Secure cookies work on the same public URL.

No seed command is required for reviewers: **Try demo workspace** creates its samples on demand. Render's free service can sleep when idle, so the first visit may take longer. See [Render's web service documentation](https://render.com/docs/web-services) and [free service limits](https://render.com/docs/free).

### Tests

```sh
pnpm test
```

Tests download a MongoDB binary on first run, start an isolated test database, and clean it up afterward. They cover persistence and CRUD, defaults and trimming, invalid dates/URLs, operator injection, invalid IDs, literal search, filters, and JSON error responses.

Client tests also cover connection failures, timeouts, request cancellation, and unexpected server responses. Run `pnpm format` to format the whole repository, or `pnpm format:check` to check it without changing files.

## Architecture

```text
client/                 React dashboard, form, API client, CSS
server/app.js           Express routes, validation, errors, static hosting
server/index.js         Database connection and server lifecycle
server/models/          Mongoose application model
server/validation.js    Strict schemas for creation and partial updates
server/test/            MongoDB integration tests
shared/statuses.js      Status values used by the client and server
scripts/dev-local.js    Persistent local MongoDB development helper
.github/workflows/      CI
```

React stores a local copy of server data and updates it only after a successful mutation. Express explicitly validates and selects allowed fields before passing data to Mongoose. Status changes use partial updates so notes and other fields remain intact. The UI computes counts from the full collection, so filtering does not change dashboard totals.

Interview times are stored as ISO timestamps and displayed in the device’s local time zone. Follow-up dates are calendar dates, so they do not shift between time zones. The agenda refreshes each minute while open and excludes Offer and Rejected applications. Completing a follow-up clears its date and next step; scheduling a new one uses the same application form. Reminders appear in the app, with no email or background notifications. Calendar events default to a one-hour duration, which can be edited in your calendar.

Completed and cancelled rounds remain in the application but are excluded from upcoming interviews. Each round has a stable identifier and a separate calendar event. Older single-interview records appear as an existing round and are converted when saved, with no manual database migration required. Activity history is maintained by the server and cannot be supplied or edited through API input. It starts with new changes for records created before this feature and is removed when the application is deleted.

| Method | Endpoint                                  | Purpose                     |
| ------ | ----------------------------------------- | --------------------------- |
| GET    | `/api/health`                             | Database readiness          |
| POST   | `/api/auth/register`                      | Create account and session  |
| POST   | `/api/auth/login`                         | Sign in                     |
| POST   | `/api/auth/demo`                          | Start seeded demo workspace |
| GET    | `/api/auth/me`                            | Current profile             |
| POST   | `/api/auth/logout`                        | Revoke session              |
| GET    | `/api/applications?q=text&status=Applied` | List/search/filter          |
| POST   | `/api/applications`                       | Create                      |
| PATCH  | `/api/applications/:id`                   | Update selected fields      |
| DELETE | `/api/applications/:id`                   | Delete                      |

Errors use JSON with a `message`, and validation failures include field details. Posting links allow only HTTP(S); search treats user text as a literal string rather than executable regex syntax.

## AI Development Experience

I used **Code0** to help test the app and check the backend setup. My usage covered three tasks:

- **Application testing:** Checking the app’s main workflows.
- **MongoDB setup:** Working through the database connection instructions and configuration.
- **API testing:** Testing requests and checking the responses from the Express API.

See [the development notes](docs/ai-development.md) for a brief description of each task.

## Scope and tradeoffs

This is an account-based application tracker. The server binds to localhost in development and `0.0.0.0` in production. All of the signed-in user's records are loaded for a small dashboard. Development requests go through Vite's API proxy, and the production server hosts the frontend and API together.

Passwords are salted and hashed with Node's scrypt. Random session tokens are stored as hashes in MongoDB and sent in HttpOnly, SameSite=Lax cookies. Sessions expire after seven days, are checked on every protected request, and are revoked on logout. The API assigns ownership and scopes reads, updates, and deletes to that user. Write requests check browser origins, and authentication is limited to 20 attempts per IP in 15 minutes. The limiter is in memory for this single-process demo; a multi-instance deployment would need a shared limiter and trusted proxy configuration. Email verification, password reset, and social sign-in are outside this version's scope.

The interface uses Google Fonts with system fallbacks. No external service is required to store application data beyond the configured MongoDB instance.
