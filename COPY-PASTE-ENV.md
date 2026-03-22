# Copy-paste environment variables

Your Vercel app (frontend): **https://syncsllack.vercel.app**

**API health checks must use your Render URL**, not Vercel — e.g. `https://YOUR-SERVICE.onrender.com/health` or `.../api/health`.

Replace `YOUR-RENDER-URL` below with your **Render Web Service** URL (e.g. `https://sync-work-api.onrender.com`) — from Render dashboard → your API → copy URL. **No trailing slash.**

---

## Vercel → Project → Settings → Environment Variables

Add for **Production** (and **Preview** if you want previews to work):

| Name | Value |
|------|--------|
| `VITE_API_URL` | `YOUR-RENDER-URL` |

**Example** (after you know your Render URL):

| Name | Value |
|------|--------|
| `VITE_API_URL` | `https://sync-work-api.onrender.com` |

Then **Redeploy** the project.

---

## Render → your Web Service → Environment

**Required** (or the service exits with status 1):

| Name | Value |
|------|--------|
| `MONGODB_URI` | Your full **MongoDB Atlas** SRV string (`mongodb+srv://...`) including database name in the path. |
| `JWT_SECRET` | A long random string (generate locally, never commit). |
| `CLIENT_ORIGIN` | `http://localhost:5173,https://syncsllack.vercel.app` |
| `NODE_ENV` | `production` |

Optional: `JWT_EXPIRES_IN` (default `7d`).

**Atlas:** under **Network Access**, allow **`0.0.0.0/0`** (or Render’s egress IPs) so the cloud can connect.

Then **Save** and **Manual Deploy** if needed.

---

## Local `server/.env` (your machine only)

You can use the same `CLIENT_ORIGIN` line as Render so local + Vercel are listed. Do **not** commit `.env`.
