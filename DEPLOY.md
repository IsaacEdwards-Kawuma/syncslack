# Deploy: GitHub + Neon (Postgres) + Render (API) + Vercel (UI)

## Overview

| Piece | Role |
|--------|------|
| **GitHub** | Hosts your code. Render and Vercel deploy from it. |
| **Neon** | Serverless **PostgreSQL** (`DATABASE_URL`). |
| **Render** | Runs the **Node server** (`server/`) — HTTP API + Socket.IO + file uploads. |
| **Vercel** | Hosts the **React build** (`client/`). |

---

## 1. Neon (database)

1. Create a project at [neon.tech](https://neon.tech) (free tier is fine).
2. **Dashboard → Connect** — copy the **connection string** (`postgresql://user:pass@ep-....neon.tech/neondb?sslmode=require`).
3. Put it in **Render → Environment** as `DATABASE_URL` and in local `server/.env` for development.
4. The API applies `server/src/db/schema.sql` on startup (tables are created if missing).

---

## 2. GitHub

1. Create a new repository (private recommended).
2. From your project folder:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOU/YOUR-REPO.git
   git branch -M main
   git push -u origin main
   ```

3. Confirm **`.env` is not committed** (it should be in `.gitignore`).

---

## 3. Render (backend)

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**.
2. Connect the **GitHub** repo.
3. Settings:
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. **Environment** (Render → Environment):

   | Key | Value |
   |-----|--------|
   | `DATABASE_URL` | Your Neon `postgresql://...` connection string. |
   | `JWT_SECRET` | Long random string (generate once, keep secret). |
   | `CLIENT_ORIGIN` | `http://localhost:5173,https://YOUR-VERCEL-APP.vercel.app` (comma-separated, **no spaces** after commas is OK). Include localhost if you still test locally against production API. |
   | `NODE_ENV` | `production` |

   Render sets **`PORT`** automatically — the app already uses `process.env.PORT`.

5. Deploy. Copy the public URL, e.g. `https://sync-work-api.onrender.com` (your API base, **no** `/api` suffix).

**Note:** Free tier **spins down** after idle; first request can take ~30–60s.

### Render troubleshooting (common errors)

| Problem | Fix |
|--------|-----|
| **Build failed** / `npm run build` not found | **Build Command** must be `npm install` (or leave default). If you use `npm run build`, the repo now includes a no-op `build` script in `server/package.json`, but `npm install` is enough. |
| **Root Directory** wrong | Must be exactly **`server`** (no leading slash). If empty, Render builds from repo root and won’t find `package.json` correctly. |
| **Service crashed** / deploy fails after start | Set **`DATABASE_URL`**, **`JWT_SECRET`**, and **`CLIENT_ORIGIN`** in Render → Environment. Missing `JWT_SECRET` or invalid `DATABASE_URL` causes the process to exit. |
| **Blueprint / YAML error** | Skip `render.yaml` import — create the **Web Service** manually with the settings above. |
| **Health check** | Optional: set **Health Check Path** to `/api/health` in Render service settings. |

The server binds to **`0.0.0.0`** and sets **`trust proxy`** for Render’s load balancer.

---

## 4. Vercel (frontend)

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import the same GitHub repo.
2. Settings:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite (auto)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. **Environment Variables**:

   | Name | Value |
   |------|--------|
   | `VITE_API_URL` | `https://YOUR-RENDER-SERVICE.onrender.com` (same as API base, **no** trailing slash) |

4. Deploy. Open the **.vercel.app** URL.

**If you see `404: NOT_FOUND`:** almost always **Output Directory** or **Root Directory** is wrong. With **Root Directory = `client`**, Output must be **`dist`** (not `client/dist`). With **Root Directory empty**, Output must be **`client/dist`**. Redeploy after fixing.

5. Go back to **Render** → **Environment** → set `CLIENT_ORIGIN` to include your real Vercel URL, e.g.  
   `http://localhost:5173,https://your-app.vercel.app`  
   Redeploy Render after changing env.

---

## 5. Checklist

- [ ] Neon project created; `DATABASE_URL` copied.
- [ ] Render env: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN` (includes Vercel URL).
- [ ] Vercel env: `VITE_API_URL` = Render URL.
- [ ] Register/login on the **Vercel** site (not only localhost).
- [ ] If CORS errors: `CLIENT_ORIGIN` must **exactly** match the browser origin (scheme + host, no path).

---

## 6. Optional: `render.yaml`

A sample `render.yaml` is in the repo root. You can use **Blueprint** on Render to import it, or create the service manually as above.

---

## Local development

Leave **`VITE_API_URL` unset** (or empty) in `client/.env` so the app uses the Vite proxy to `localhost:5000`. Set **`CLIENT_ORIGIN`** in `server/.env` to include `http://localhost:5173`. Set **`DATABASE_URL`** to your Neon dev branch or local Postgres.
