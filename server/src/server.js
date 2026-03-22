import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Load .env from server/ regardless of process cwd (fixes missing JWT_SECRET when not run from server/). */
dotenv.config({ path: path.join(__dirname, '../.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { connectDB } from './config/db.js';
import { getCorsOrigins } from './config/cors.js';
import { getJwtSecret } from './config/env.js';
import { attachSocketIO } from './socket/socketServer.js';

import authRoutes from './routes/authRoutes.js';
import workspaceRoutes from './routes/workspaceRoutes.js';
import channelRoutes from './routes/channelRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
/** Required behind Render / other reverse proxies (rate-limit, secure cookies, req.ip). */
app.set('trust proxy', 1);

const httpServer = createServer(app);

const allowedOrigins = getCorsOrigins();
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
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

const io = attachSocketIO(httpServer);
app.set('io', io);

const PORT = Number(process.env.PORT) || 5000;

function resolveMongoUri() {
  const fromEnv = process.env.MONGODB_URI?.trim();
  if (fromEnv) return fromEnv;
  /** Render sets RENDER=true; there is no local MongoDB on the host. */
  const mustHaveAtlas = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  if (mustHaveAtlas) {
    console.error(
      '[FATAL] MONGODB_URI is not set. In Render → Environment, add your MongoDB Atlas connection string (mongodb+srv://...).'
    );
    return null;
  }
  return 'mongodb://127.0.0.1:27017/syncwork';
}

async function main() {
  const mongoUri = resolveMongoUri();
  if (!mongoUri) {
    process.exit(1);
  }

  getJwtSecret();

  try {
    await connectDB(mongoUri);
  } catch (err) {
    console.error('[FATAL] MongoDB connection failed:', err?.message || err);
    console.error(
      'Check MONGODB_URI, Atlas Database Access (user/password), and Network Access (IP allowlist: 0.0.0.0/0 for testing).'
    );
    process.exit(1);
  }

  /** Render and most PaaS require binding to 0.0.0.0, not only localhost. */
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP + Socket.IO listening on port ${PORT}`);
    console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
  });
}

main().catch((err) => {
  console.error('[FATAL]', err?.message || err);
  if (String(err?.message || '').includes('JWT_SECRET')) {
    console.error('Add JWT_SECRET in Render → Environment (generate a long random string).');
  }
  process.exit(1);
});
