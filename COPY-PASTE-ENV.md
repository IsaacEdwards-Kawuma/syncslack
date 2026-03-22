# Copy-paste environment variables

| Service | URL |
|---------|-----|
| **Render (API)** | **https://syncslack.onrender.com** |
| **Vercel (frontend)** | **https://syncsllack.vercel.app** |

---

## Vercel → Project → Settings → Environment Variables

Add for **Production** (and **Preview** if you want):

| Name | Value (copy exactly) |
|------|----------------------|
| `VITE_API_URL` | `https://syncslack.onrender.com` |

**No trailing slash.** Then **Save** → **Deployments** → **Redeploy**.

---

## Render → Web Service (API)

**Important:** **Root Directory** must be **`server`** (not the repo root).  
**Build Command:** `npm install` · **Start Command:** `npm start`

If **Root Directory is empty**, set **Build Command** to `cd server && npm install` so `server/node_modules` exists, and **Start Command** to `npm start` (the repo root `package.json` now includes `start` → runs the API in `server/`).

**Recommended:** Root Directory = **`server`**, Build = **`npm install`**, Start = **`npm start`** — no `cd` needed.

---

## Render → Web Service → Environment

| Name | Value |
|------|--------|
| `MONGODB_URI` | Your MongoDB Atlas `mongodb+srv://...` string |
| `JWT_SECRET` | Long random string |
| `CLIENT_ORIGIN` | `http://localhost:5173,https://syncsllack.vercel.app` |
| `NODE_ENV` | `production` |

Atlas **Network Access:** allow **`0.0.0.0/0`** (or tighten later).

---

## Quick checks (API on Render)

Open in a browser:

- https://syncslack.onrender.com/
- https://syncslack.onrender.com/health
- https://syncslack.onrender.com/api/health  

You should see JSON with `"ok": true`.

---

## Local `server/.env`

Do **not** commit `.env`. You can mirror `CLIENT_ORIGIN` from Render for local testing.

---

## Vercel `404 NOT_FOUND`

1. **Root Directory** (Project → Settings → General):
   - **Option A:** set to **`client`** → Vercel builds the Vite app from `client/` (uses `client/vercel.json`).
   - **Option B:** leave **empty** → uses repo root `package.json` + `vercel.json` and outputs **`client/dist`**.

2. After changing settings or pushing config, **Redeploy** (Deployments → … → Redeploy).

3. Confirm **Build** logs show `vite build` succeeding and **Output** is `dist` or `client/dist`.
