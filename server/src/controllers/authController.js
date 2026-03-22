import bcrypt from 'bcryptjs';
import * as users from '../db/users.js';
import * as authTokens from '../db/authTokens.js';
import { getJwtExpiresIn, getJwtSecret } from '../config/env.js';
import { signToken } from '../utils/jwt.js';
import { sendMail, publicAppBaseUrl } from '../utils/mail.js';

const SALT_ROUNDS = 12;

export async function register(req, res) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const existing = await users.findUserByEmail(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const smtp = Boolean(process.env.SMTP_HOST?.trim());
    const user = await users.createUser({
      email: email.toLowerCase(),
      passwordHash,
      name: name.trim(),
      emailVerified: !smtp,
    });
    if (smtp) {
      const raw = await authTokens.createToken(user.id, authTokens.PURPOSE_EMAIL_VERIFY, 72);
      const link = `${publicAppBaseUrl()}/verify-email?token=${encodeURIComponent(raw)}`;
      await sendMail({
        to: user.email,
        subject: 'Verify your email',
        text: `Open this link to verify your account:\n${link}`,
      });
    }
    const secret = getJwtSecret();
    const expiresIn = getJwtExpiresIn();
    const token = signToken({ sub: user.id, email: user.email }, secret, expiresIn);
    return res.status(201).json({ user: users.mapUserPublic(user), token, expiresIn });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Registration failed' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const user = await users.findUserByEmail(String(email).toLowerCase().trim());
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const secret = getJwtSecret();
    const expiresIn = getJwtExpiresIn();
    const token = signToken({ sub: user.id, email: user.email }, secret, expiresIn);
    return res.json({ user: users.mapUserPublic(user), token, expiresIn });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Login failed';
    return res.status(500).json({ error: message.includes('JWT_SECRET') ? 'Server misconfiguration' : 'Login failed' });
  }
}

export async function me(req, res) {
  try {
    const user = await users.findUserById(req.user.sub);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: users.mapUserPublic(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load profile' });
  }
}

export async function updateTheme(req, res) {
  try {
    const { theme } = req.body;
    if (!['light', 'dark'].includes(theme)) {
      return res.status(400).json({ error: 'theme must be light or dark' });
    }
    const user = await users.updateTheme(req.user.sub, theme);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: users.mapUserPublic(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Update failed' });
  }
}

export async function updateStatus(req, res) {
  try {
    const { statusText, statusEmoji } = req.body;
    const user = await users.updateStatus(req.user.sub, statusText ?? '', statusEmoji ?? '');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: users.mapUserPublic(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Update failed' });
  }
}

export async function updateDnd(req, res) {
  try {
    const { dndUntil, minutes, clear } = req.body || {};
    let until = null;
    if (clear === true || minutes === 0 || dndUntil === null) {
      until = null;
    } else if (typeof minutes === 'number' && minutes > 0 && minutes <= 24 * 60) {
      until = new Date(Date.now() + minutes * 60 * 1000);
    } else if (typeof dndUntil === 'string' && dndUntil.trim()) {
      until = new Date(dndUntil);
      if (Number.isNaN(until.getTime())) return res.status(400).json({ error: 'Invalid dndUntil' });
    } else {
      return res.status(400).json({ error: 'Provide clear: true, minutes (1–1440), or dndUntil (ISO)' });
    }
    const user = await users.updateDndUntil(req.user.sub, until);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: users.mapUserPublic(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Update failed' });
  }
}

export async function updateAvatar(req, res) {
  try {
    let { avatarUrl } = req.body;
    avatarUrl = String(avatarUrl ?? '').trim();
    if (!avatarUrl.startsWith('/uploads/')) {
      return res.status(400).json({ error: 'avatarUrl must be a path from file upload (e.g. /uploads/...)' });
    }
    if (avatarUrl.length > 500) return res.status(400).json({ error: 'Invalid avatarUrl' });
    const user = await users.updateAvatarUrl(req.user.sub, avatarUrl);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: users.mapUserPublic(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Update failed' });
  }
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: 'email is required' });
    const user = await users.findUserByEmail(String(email).toLowerCase().trim());
    if (user) {
      const raw = await authTokens.createToken(user.id, authTokens.PURPOSE_PASSWORD_RESET, 2);
      const link = `${publicAppBaseUrl()}/reset-password?token=${encodeURIComponent(raw)}`;
      await sendMail({
        to: user.email,
        subject: 'Reset your password',
        text: `Reset your password (valid 2 hours):\n${link}`,
      });
    }
    return res.json({ ok: true, message: 'If an account exists, a reset link was sent.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Request failed' });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const userId = await authTokens.consumeToken(token, authTokens.PURPOSE_PASSWORD_RESET);
    if (!userId) return res.status(400).json({ error: 'Invalid or expired token' });
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await users.updatePasswordHash(userId, passwordHash);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Reset failed' });
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const user = await users.findUserById(req.user.sub);
    if (!user?.password_hash) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(String(currentPassword), user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await users.updatePasswordHash(req.user.sub, passwordHash);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Change failed' });
  }
}

export async function verifyEmail(req, res) {
  try {
    const token = req.query.token || req.body?.token;
    const userId = await authTokens.consumeToken(token, authTokens.PURPOSE_EMAIL_VERIFY);
    if (!userId) return res.status(400).json({ error: 'Invalid or expired token' });
    await users.setEmailVerifiedNow(userId);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Verification failed' });
  }
}
