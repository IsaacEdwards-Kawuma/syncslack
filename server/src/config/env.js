/**
 * Trim env values — Windows CRLF in .env can break JWT (e.g. invalid "expiresIn").
 */
export function getJwtSecret() {
  const s = (process.env.JWT_SECRET || '').trim();
  if (!s) {
    throw new Error('JWT_SECRET is missing or empty. Set it in server/.env');
  }
  return s;
}

export function getJwtExpiresIn() {
  return (process.env.JWT_EXPIRES_IN || '7d').trim();
}
