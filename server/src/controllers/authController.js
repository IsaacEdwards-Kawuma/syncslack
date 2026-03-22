import bcrypt from 'bcryptjs';
import * as users from '../db/users.js';
import { getJwtExpiresIn, getJwtSecret } from '../config/env.js';
import { signToken } from '../utils/jwt.js';

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
    const user = await users.createUser({ email: email.toLowerCase(), passwordHash, name: name.trim() });
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
