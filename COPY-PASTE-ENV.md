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
