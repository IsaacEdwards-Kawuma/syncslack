import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { connectDB } from './config/db.js';
import { uploadsDir } from './config/uploadsPath.js';
import { getCorsOrigins, isOriginAllowed } from './config/cors.js';
import { getJwtSecret } from './config/env.js';
import { attachSocketIO } from './socket/socketServer.js';

import authRoutes from './routes/authRoutes.js';
import workspaceRoutes from './routes/workspaceRoutes.js';
import channelRoutes from './routes/channelRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Load .env from server/ regardless of process cwd. */
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
/** Required behind Render / other reverse proxies (rate-limit, secure cookies, req.ip). */
app.set('trust proxy', 1);

const httpServer = createServer(app);

const allowedOrigins = getCorsOrigins();
/** CORS must run before helmet so responses always get ACAO; reflect exact origin string when using credentials. */
app.use(
  cors({
    origin: (origin, callback) => {
      if (origin == null || origin === '') return callback(null, true);
      const o = String(origin).trim();
      if (!o) return callback(null, true);
      if (isOriginAllowed(o)) return callback(null, o);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(express.json({ limit: '2mb' }));

/** Root URL — opening https://your-service.onrender.com/ shows JSON instead of 404 Not Found */
app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'sync-work-server',
    health: '/api/health',
    hint: 'API routes are under /api/...',
  });
});

/** Shorter health URL (same as /api/health) for quick checks in browser */
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sync-work-server' });
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});
app.use('/api/', limiter);

app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'sync-work-server' });
});

app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);

const io = attachSocketIO(httpServer);
app.set('io', io);

const PORT = Number(process.env.PORT) || 5000;

function resolveDatabaseUrl() {
  const u = process.env.DATABASE_URL?.trim();
  if (u) return u;
  if (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') {
    console.error('[FATAL] DATABASE_URL is not set. Add your Neon connection string in Render → Environment.');
    return null;
  }
  console.error(
    '[FATAL] DATABASE_URL is not set. Use Neon (postgresql://...) or local Postgres in server/.env.'
  );
  return null;
}

async function main() {
  console.log('[startup] sync-work-server');
  console.log('[startup] NODE_ENV=', process.env.NODE_ENV, 'RENDER=', process.env.RENDER);
  console.log('[startup] DATABASE_URL is set:', Boolean(process.env.DATABASE_URL?.trim()));
  console.log('[startup] JWT_SECRET is set:', Boolean(process.env.JWT_SECRET?.trim()));

  if (!resolveDatabaseUrl()) {
    process.exit(1);
  }

  try {
    getJwtSecret();
  } catch (e) {
    console.error('[FATAL]', e?.message || e);
    console.error('Add JWT_SECRET in Render → Environment (long random string).');
    process.exit(1);
  }

  try {
    await connectDB();
  } catch (err) {
    console.error('[FATAL] PostgreSQL connection failed:', err?.message || err);
    console.error('Set DATABASE_URL to your Neon connection string (postgresql://user:pass@...neon.tech/neondb?sslmode=require).');
    process.exit(1);
  }

  /** Render and most PaaS require binding to 0.0.0.0, not only localhost. */
  httpServer.on('error', (err) => {
    console.error('[FATAL] HTTP server error:', err?.message || err);
    process.exit(1);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP + Socket.IO listening on port ${PORT}`);
    console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
  });
}

main().catch((err) => {
  console.error('[FATAL] Unhandled startup error:', err?.message || err);
  if (String(err?.message || '').includes('JWT_SECRET')) {
    console.error('Add JWT_SECRET in Render → Environment (generate a long random string).');
  }
  process.exit(1);
});
