# Deploy: GitHub + MongoDB Atlas + Render (API) + Vercel (UI)

## Overview

| Piece | Role |
|--------|------|
| **GitHub** | Hosts your code. Render and Vercel deploy from it. |
| **MongoDB Atlas** | Database (`MONGODB_URI`). |
| **Render** | Runs the **Node server** (`server/`) — HTTP API + Socket.IO + file uploads. |
| **Vercel** | Hosts the **React build** (`client/`). |

---

## 1. MongoDB Atlas

1. Create a cluster (free M0 is fine).
2. **Database Access**: create a user + password.
3. **Network Access**: `0.0.0.0/0` (allow from anywhere) so Render can connect — or use Render’s outbound IPs if you lock it down later.
4. **Connect** → Drivers → copy the **SRV** connection string.
5. Put the **database name** in the path, e.g. `...mongodb.net/syncwork?...`

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
   | `MONGODB_URI` | Your Atlas SRV string (with DB name in path). |
   | `JWT_SECRET` | Long random string (generate once, keep secret). |
   | `CLIENT_ORIGIN` | `http://localhost:5173,https://YOUR-VERCEL-APP.vercel.app` (comma-separated, **no spaces** after commas is OK). Include localhost if you still test locally against production API. |
   | `NODE_ENV` | `production` |

   Render sets **`PORT`** automatically — the app already uses `process.env.PORT`.

5. Deploy. Copy the public URL, e.g. `https://sync-work-api.onrender.com` (your API base, **no** `/api` suffix).

**Note:** Free tier **spins down** after idle; first request can take ~30–60s.

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

5. Go back to **Render** → **Environment** → set `CLIENT_ORIGIN` to include your real Vercel URL, e.g.  
   `http://localhost:5173,https://your-app.vercel.app`  
   Redeploy Render after changing env.

---

## 5. Checklist

- [ ] Atlas user + network allow Render.
- [ ] Render env: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` (includes Vercel URL).
- [ ] Vercel env: `VITE_API_URL` = Render URL.
- [ ] Register/login on the **Vercel** site (not only localhost).
- [ ] If CORS errors: `CLIENT_ORIGIN` must **exactly** match the browser origin (scheme + host, no path).

---

## 6. Optional: `render.yaml`

A sample `render.yaml` is in the repo root. You can use **Blueprint** on Render to import it, or create the service manually as above.

---

## Local development

Leave **`VITE_API_URL` unset** (or empty) in `client/.env` so the app uses the Vite proxy to `localhost:5000`. Set **`CLIENT_ORIGIN`** in `server/.env` to include `http://localhost:5173`.
