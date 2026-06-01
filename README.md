# Executive Engine

Executive Engine is a mobile-first MERN app for daily execution, long-term goals, deadlines, and progress reflection. It is designed for people who need a simple system for follow-through: a small daily task list, one anchor task, goal action plans, deadline pressure, and stats that show where the system is working or breaking.

## Features

- Email/password authentication with JWT stored in an HTTP-only cookie.
- Notebook-style daily task list with a 7 active task limit.
- Anchor task support: one non-negotiable task can count as two weekly checks.
- Weekly progress that respects task creation dates, archived tasks, and weekend settings.
- Goal cards for long-term goals, daily action plans, and notes for what works or does not work.
- Daily goal action reset based on the current date while preserving historical completion data.
- Deadline tracking with pass/fail/pending states and remaining-time highlights.
- Stats for streaks, weekly completion, most missed tasks, deadline outcomes, and pass timing before deadlines.
- Automatic reset protocol page when weekly completion drops for two consecutive weeks.
- WebSocket-powered stats refresh when task, deadline, or settings data changes.
- Installable PWA shell via web app manifest.

## Stack

- React 19 + Vite + TypeScript client
- Express + MongoDB + Mongoose API
- bcrypt, JSON Web Tokens, cookie-parser, CORS, Morgan
- Recharts for charts
- Framer Motion for transitions
- date-fns for date calculations
- lucide-react for icons
- ws for realtime updates

## Project Structure

```text
client/   Vite React app
server/   Express API, Mongo models, routes, auth, realtime WebSocket server
```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy server environment values:

   ```bash
   cp server/.env.example server/.env
   ```

3. Fill in `server/.env`:

   ```env
   PORT=4000
   CLIENT_ORIGIN=http://localhost:5173
   API_BASE_URL=http://localhost:4000
   MONGODB_URI=mongodb://127.0.0.1:27017/executive_engine
   JWT_SECRET=replace-with-a-long-random-secret
   ```

4. Start MongoDB locally or point `MONGODB_URI` to a hosted MongoDB database.

5. Start development servers:

   ```bash
   npm run dev
   ```

Client: `http://localhost:5173`

API: `http://localhost:4000`

No OAuth provider setup is required.

## Scripts

From the repository root:

```bash
npm run dev      # Start client and server together
npm run build    # Type-check and build the client
npm run start    # Start the Express server
```

Workspace-specific scripts:

```bash
npm run dev --workspace client
npm run build --workspace client
npm run preview --workspace client
npm run dev --workspace server
npm run start --workspace server
```

## Realtime Stats

The server exposes a WebSocket endpoint at `/ws`. The client uses it to refetch stats when relevant backend events broadcast `stats:changed`.

For local development, the client defaults to:

```text
ws://localhost:4000/ws
```

Set `VITE_WS_BASE_URL` for a different WebSocket URL.

## Build

```bash
npm run build
```

The production client build is emitted from `client/dist`.

## Deployment Notes

- Recommended production setup: deploy this repo as one Render web service and use MongoDB Atlas for the database.
- In production, Express serves the built React app from `client/dist`, handles `/api/*`, and hosts `/ws` for realtime stats on the same domain.
- Build command: `npm ci --include=dev && npm run build`.
- Start command: `npm run start`.
- Health check path: `/api/health`.
- Required Render environment variables:

   ```env
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=use-a-long-random-secret
   CLIENT_ORIGIN=https://your-render-service.onrender.com
   API_BASE_URL=https://your-render-service.onrender.com
   ```

- A `render.yaml` blueprint is included. If you use it, set `MONGODB_URI`, `CLIENT_ORIGIN`, and `API_BASE_URL` in Render after creating the service.
- The client uses same-origin API requests and same-origin WebSockets by default in production, so no separate frontend host is needed.