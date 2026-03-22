# Sync Work — Slack-like team chat

**Repository:** [https://github.com/IsaacEdwards-Kawuma/syncslack](https://github.com/IsaacEdwards-Kawuma/syncslack)

Production-oriented monorepo: **React + Tailwind** (`client`), **Express + PostgreSQL (Neon) + Socket.IO** (`server`), **JWT + bcrypt** auth, workspaces, channels, DMs, threads, reactions, uploads, dark mode, **Settings / Profile / Help / Privacy** pages, and optional **browser push** (VAPID).

## Project layout

```
├── client/                 # Vite + React + Tailwind
│   ├── src/
│   │   ├── context/        # Auth, Socket
│   │   ├── lib/api.js      # REST helper + token
│   │   └── pages/          # Login, Register, Workspace, Settings, Profile, Help, Privacy
│   └── package.json
├── server/
│   ├── src/
│   │   ├── config/         # DB pool, CORS, env
│   │   ├── db/             # SQL schema + repositories
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── socket/         # Socket.IO rooms + events
│   │   └── server.js
│   ├── uploads/            # Created at runtime for file uploads
│   └── package.json
├── .gitignore
└── README.md
```

## Prerequisites

- **Node.js 18+**
- **PostgreSQL** — use a [Neon](https://neon.tech) database (recommended) or local Postgres; connection string in `DATABASE_URL`

## Backend setup

1. Copy environment file:

   ```bash
   copy server\.env.example server\.env
   ```

   On macOS/Linux: `cp server/.env.example server/.env`

2. Edit `server/.env` — set `DATABASE_URL` (Neon `postgresql://...`), `JWT_SECRET` (long random string in production), and optionally `PORT`, `CLIENT_ORIGIN`.

3. Install and run:

   ```bash
   cd server
   npm install
   npm run dev
   ```

   API: `http://localhost:5000` — health check: `GET /api/health`

## Frontend setup

In a **second terminal**:

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api`, `/uploads`, and `/socket.io` to the backend on port 5000.

## Using the app

1. **Register** a user, then **create a workspace** (or join with a workspace **slug** from another user).
2. Open the **#general** channel (created automatically) or add **channels** (public/private).
3. Use **Direct messages** to start a 1:1 chat with another workspace member.
4. **Threads**: open a channel message and click **Thread**; replies are real-time in the side panel.
5. **Reactions**, **edit/delete** (own messages), **file upload** (paperclip), **typing indicators**, and **dark mode** (moon/sun in the workspace rail) are supported.

## Real-time events (Socket.IO)

- Client authenticates with JWT in `handshake.auth.token`.
- Rooms: `channel:<id>`, `conversation:<id>`, `user:<id>` (DM notifications).
- Events: `join_channel`, `leave_channel`, `join_conversation`, `send_message`, `typing`; server emits `receive_message`, `message_updated`, `typing`, `notification`.

## Production notes

- Set strong `JWT_SECRET`, restrict `CLIENT_ORIGIN` / CORS, use TLS and a process manager (PM2, systemd, etc.).
- Serve the Vite `client/dist` via Express or a reverse proxy; point `CLIENT_ORIGIN` at your public URL.
- Back up Postgres (Neon branches / snapshots); consider Redis adapter for Socket.IO if you scale horizontally.

## Deploy online (GitHub + Neon + Render + Vercel)

Step-by-step guide: **[DEPLOY.md](./DEPLOY.md)** — env vars `VITE_API_URL` (Vercel) and comma-separated `CLIENT_ORIGIN` (Render) are required for the split frontend/backend setup.

## Firebase (optional)

Not wired by default. You can add Firebase Cloud Messaging later for push notifications using the existing `notification` socket event as a trigger on the client.
