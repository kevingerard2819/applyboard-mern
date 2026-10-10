import { Router } from 'express';
import mongoose from 'mongoose';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { Application } from './models/Application.js';
import { sampleApplications } from './sampleApplications.js';

const scrypt = promisify(scryptCallback);
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  isDemo: { type: Boolean, default: false },
  expiresAt: { type: Date, index: { expires: 0 } },
});
export const User = mongoose.model('User', userSchema);
export const Session = mongoose.model(
  'Session',
  new mongoose.Schema({
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  }),
);
const cookieName = 'applyboard_session';
const sessionAge = 7 * 24 * 60 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  ...(user.isDemo ? { isDemo: true } : {}),
});
const credentials = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(10, 'Use at least 10 characters for your password').max(128),
  })
  .strict();
const registration = credentials.extend({ name: z.string().trim().min(1).max(80) });

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}
async function matchesPassword(password, hash) {
  const [salt, stored] = hash.split(':');
  const derived = await scrypt(password, salt, 64);
  return timingSafeEqual(derived, Buffer.from(stored, 'hex'));
}
function sessionToken(req) {
  const cookie = req.headers.cookie
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
async function createSession(user, res) {
  const token = randomBytes(32).toString('hex');
  const maxAge = user.isDemo
    ? Math.max(0, new Date(user.expiresAt).getTime() - Date.now())
    : sessionAge;
  await Session.create({
    tokenHash: tokenHash(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + maxAge),
  });
  res.cookie(cookieName, token, { ...cookieOptions, maxAge });
}
export async function requireUser(req, res, next) {
  const token = sessionToken(req);
  const session =
    token &&
    (await Session.findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } }).lean());
  const user = session && (await User.findById(session.userId).lean());
  if (!user || (user.isDemo && new Date(user.expiresAt) <= new Date()))
    return res.status(401).json({ message: 'Please sign in to continue.' });
  req.user = publicUser(user);
  if (user.isDemo) req.demoExpiresAt = user.expiresAt;
  next();
}

// Reject browser requests from other origins before they can mutate cookie-authenticated data.
export function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const allowed = new Set([`${req.protocol}://${req.get('host')}`, process.env.CLIENT_ORIGIN]);
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://127.0.0.1:5173');
    allowed.add('http://localhost:5173');
  }
  if (
    req.get('sec-fetch-site') === 'cross-site' ||
    (req.get('origin') && !allowed.has(req.get('origin')))
  ) {
    return res.status(403).json({ message: 'Request origin is not allowed.' });
  }
  next();
}
const attempts = new Map();
function limitAttempts(req, res, next) {
  const now = Date.now();
  for (const [ip, entry] of attempts) if (entry.expiresAt <= now) attempts.delete(ip);
  const ip = req.ip;
  let entry = attempts.get(ip);
  if (!entry) {
    if (attempts.size >= 10000)
      return res.status(429).json({ message: 'Please try signing in later.' });
    entry = { count: 0, expiresAt: now + 15 * 60 * 1000 };
    attempts.set(ip, entry);
  }
  if (++entry.count > 20) {
    res.set('Retry-After', String(Math.ceil((entry.expiresAt - now) / 1000)));
    return res.status(429).json({ message: 'Too many attempts. Try again in 15 minutes.' });
  }
  next();
}
export const auth = Router();
auth.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
auth.post('/register', limitAttempts, async (req, res) => {
  const result = registration.safeParse(req.body);
  if (!result.success)
    return res
      .status(400)
      .json({ message: 'Enter your name, a valid email, and a password of 10–128 characters.' });
  const { name, email, password } = result.data;
  try {
    const user = await User.create({ name, email, passwordHash: await hashPassword(password) });
    await createSession(user, res);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ message: 'An account already uses this email. Please sign in.' });
    throw error;
  }
});
// A dummy hash keeps a missing account on the same password-verification path.
const dummyHash = await hashPassword(randomBytes(32).toString('hex'));

auth.post('/demo', limitAttempts, async (req, res) => {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const user = await User.create({
    name: 'Demo workspace',
    email: `${randomBytes(16).toString('hex')}@demo.applyboard.invalid`,
    passwordHash: await hashPassword(randomBytes(32).toString('hex')),
    isDemo: true,
    expiresAt,
  });
  await Application.insertMany(sampleApplications(user._id, new Date(), expiresAt));
  const oldToken = sessionToken(req);
  if (oldToken) await Session.deleteOne({ tokenHash: tokenHash(oldToken) });
  await createSession(user, res);
  res.status(201).json({ user: publicUser(user) });
});
auth.post('/login', limitAttempts, async (req, res) => {
  const result = credentials.safeParse(req.body);
  if (!result.success)
    return res
      .status(400)
      .json({ message: 'Enter a valid email and a password of 10–128 characters.' });
  const user = await User.findOne({ email: result.data.email }).select('+passwordHash');
  const valid = await matchesPassword(result.data.password, user?.passwordHash || dummyHash);
  if (!user || !valid) return res.status(401).json({ message: 'Email or password is incorrect.' });
  const oldToken = sessionToken(req);
  if (oldToken) await Session.deleteOne({ tokenHash: tokenHash(oldToken) });
  await createSession(user, res);
  res.json({ user: publicUser(user) });
});
auth.get('/me', requireUser, (req, res) => res.json({ user: req.user }));
auth.post('/logout', async (req, res) => {
  const token = sessionToken(req);
  if (token) await Session.deleteOne({ tokenHash: tokenHash(token) });
  res.clearCookie(cookieName, cookieOptions);
  res.status(204).end();
});
