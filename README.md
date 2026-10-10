# ApplyBoard

A job application tracker built with MongoDB, Express, React, and Node.js. Keep track of roles, interview rounds, and follow-ups while applying for jobs.

**[Live demo](https://applyboard-mern.onrender.com)** · [Kanban screenshot](docs/kanban.png) · [Analytics screenshot](docs/analytics.png)

Click **Try demo workspace** to use the app without signing up. It includes eight fictional applications. Each visitor gets a separate workspace that expires after 24 hours.

The app runs on Render's free plan, so the first visit after inactivity may take about a minute.

![ApplyBoard dashboard](docs/dashboard.png)

## Features

- Sign up and log in to your own workspace.
- Add, edit, delete, search, and filter applications.
- Move applications through Wishlist, Applied, Interview, Offer, and Rejected in a list or Kanban board.
- Schedule interview rounds, keep preparation notes, and download calendar events.
- Track due follow-ups and mark them complete.
- View application activity and weekly analytics.

Follow-up reminders appear inside the app; they don't send email notifications.

## Stack

React 19 with Vite, Node.js, Express 5, MongoDB with Mongoose, and JavaScript. Zod handles input validation. Tests use Node's test runner and Supertest, with GitHub Actions for CI.

## Run locally

You'll need Node.js 22.13+, pnpm 11.25.0, and MongoDB 7+.

```sh
git clone https://github.com/kevingerard2819/applyboard-mern.git
cd applyboard-mern
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/applyboard
PORT=4000
```

Use your Atlas connection string if you're using MongoDB Atlas. Keep `.env` private; Git ignores it. If you have Docker, `docker compose up -d` starts a local MongoDB instance.

```sh
pnpm dev
```

Open **http://127.0.0.1:5173**. Create an account or click **Try demo workspace**. Keep the API port at 4000 for the development proxy.

Without MongoDB installed, run `pnpm dev:local` instead. It downloads MongoDB and starts both the API and frontend. The first run needs internet access; local data stays in `.cache/mongo-data`.

## Build and checks

```sh
pnpm test
pnpm format:check
pnpm build
pnpm start
```

Tests start a separate MongoDB instance and cover authentication, account isolation, CRUD, validation, interviews, analytics, and API errors. They may download a MongoDB binary on the first run.

With MongoDB configured, `pnpm start` serves the built app at **http://127.0.0.1:4000**.

## Deployment

The live app uses Render and MongoDB Atlas. [render.yaml](render.yaml) contains the build, start, and health-check settings. Set `MONGODB_URI` in Render's environment settings and use `NODE_ENV=production` for HTTPS deployments. Give the database user read/write access to `applyboard` and allow the hosting service to connect in Atlas.

## Project layout

```text
client/   React components, styles, and client tests
server/   Express API, authentication, models, and API tests
shared/   Application statuses
scripts/  Local database and legacy data helpers
docs/     Screenshots and development notes
```

The API checks account ownership on every application request. Passwords are hashed, and sessions use HttpOnly cookies. Interview times display in your device's local time zone.

## AI Development Experience

I used **Code0** while testing the app and setting up the backend:

1. **Application testing:** Checked the main workflows in the app.
2. **MongoDB setup:** Used it for connection instructions and database configuration.
3. **API testing:** Tested Express API requests and checked the responses.

More details are in [the development notes](docs/ai-development.md).
