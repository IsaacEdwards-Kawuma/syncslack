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

### Vercel shows `404: NOT_FOUND` (or blank)

That usually means Vercel is not serving your Vite build (wrong folder or empty output).

1. **Project → Settings → General → Root Directory** → set to **`client`** (not empty, not `server`).
2. **Settings → Build & Deployment**:
   - **Framework Preset**: Vite (or Other)
   - **Build Command**: `npm run build`
   - **Output Directory**: **`dist`** — must be exactly `dist` when Root Directory is **`client`**.  
     If Root Directory is **empty** (repo root), use **`client/dist`** instead.
3. **Save** → **Deployments** → **Redeploy** the latest commit.

**Do not** set Output to `client/dist` when Root Directory is already `client` (that looks for `client/client/dist` and fails).  
Config for the UI lives only in **`client/vercel.json`** (Vite → **`dist`**). There is **no** `vercel.json` at the repo root so settings don’t fight each other—set **Root Directory** to **`client`** on Vercel.

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
| `DATABASE_URL` | Your **Neon** Postgres connection string (`postgresql://...` from Neon Dashboard → Connect) |
| `JWT_SECRET` | Long random string |
| `CLIENT_ORIGIN` | `http://localhost:5173,https://syncsllack.vercel.app` |
| `NODE_ENV` | `production` |

Local dev: copy the same `DATABASE_URL` into `server/.env`.

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
   - **Recommended:** set to **`client`** → build command `npm run build`, output **`dist`** (see **`client/vercel.json`**).
   - **Alternate:** leave **empty** → set **Build Command** to `npm run build` (root `package.json` runs `cd client && npm run build`) and **Output Directory** to **`client/dist`** manually in the dashboard (no root `vercel.json`).

2. After changing settings or pushing config, **Redeploy** (Deployments → … → Redeploy).

3. Confirm **Build** logs show `vite build` succeeding and **Output** is `dist` or `client/dist`.
