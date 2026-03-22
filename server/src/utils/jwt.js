import jwt from 'jsonwebtoken';

export function signToken(payload, secret, expiresIn) {
  const exp = typeof expiresIn === 'string' ? expiresIn.trim() : expiresIn;
  const opts = exp != null && exp !== '' ? { expiresIn: exp } : {};
  return jwt.sign(payload, secret, opts);
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}
