import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Application } from './models/Application.js';
import { statuses } from '../shared/statuses.js';
import { applicationInput, applicationPatch } from './validation.js';
import { auth, requireUser, sameOrigin } from './auth.js';

export const app = express();
app.disable('x-powered-by');
// Render terminates HTTPS at its single reverse proxy before forwarding to this service.
if (process.env.RENDER === 'true') app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable' });
});

app.use(['/api/applications', '/api/auth'], (_req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res
      .status(503)
      .json({ message: 'The database is unavailable. Please try again shortly.' });
  }
  next();
});
app.use('/api', sameOrigin);
app.use('/api/auth', auth);
app.use('/api/applications', requireUser, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/applications', async (req, res) => {
  const { status, q = '' } = req.query;
  if (typeof q !== 'string' || q.length > 100 || (status && !statuses.includes(status))) {
    return res.status(400).json({ message: 'Invalid search or status filter' });
  }
  const filter = { userId: req.user._id };
  if (status) filter.status = status;
  if (q.trim()) {
    const literal = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['company', 'role', 'location'].map((field) => ({
      [field]: { $regex: literal, $options: 'i' },
    }));
  }
  const applications = await Application.find(filter).sort({ createdAt: -1, _id: -1 }).lean();
  res.json({ applications });
});

app.post('/api/applications', async (req, res) => {
  const result = applicationInput.safeParse(req.body);
  if (!result.success) return invalidInput(res, result.error);
  const application = await Application.create({
    ...result.data,
    userId: req.user._id,
    ...(req.demoExpiresAt ? { expiresAt: req.demoExpiresAt } : {}),
    activity: [{ message: 'Application created' }],
  });
  res.status(201).json({ application });
});

app.use('/api/applications/:id', (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id))
    return res.status(400).json({ message: 'Invalid application ID' });
  next();
});

app.patch('/api/applications/:id', async (req, res) => {
  const result = applicationPatch.safeParse(req.body);
  if (!result.success) return invalidInput(res, result.error);
  const previous = await Application.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!previous) return res.status(404).json({ message: 'Application not found' });
  const changes = Object.keys(result.data).filter(
    (key) =>
      JSON.stringify(previous[key] ?? (key === 'interviewRounds' ? [] : '')) !==
      JSON.stringify(result.data[key]),
  );
  const messages = [];
  if (changes.includes('interviewRounds')) {
    const oldRounds = previous.interviewRounds || [];
    for (const round of result.data.interviewRounds) {
      const old = oldRounds.find((item) => item.id === round.id);
      if (!old) messages.push(`Interview round added: ${round.label}`);
      else if (old.status !== round.status)
        messages.push(`${round.label}: ${old.status} → ${round.status}`);
      else if (old.at !== round.at) messages.push(`Interview rescheduled: ${round.label}`);
    }
    for (const old of oldRounds) {
      if (!result.data.interviewRounds.some((round) => round.id === old.id))
        messages.push(`Interview round removed: ${old.label}`);
    }
  }
  if (changes.includes('status'))
    messages.push(`Status changed from ${previous.status} to ${result.data.status}`);
  if (
    changes.includes('interviewRounds') ||
    changes.includes('interviewAt') ||
    changes.includes('interviewNotes')
  )
    messages.push('Interview schedule updated');
  if (changes.includes('followUpDate'))
    messages.push(
      result.data.followUpDate
        ? `Follow-up scheduled for ${result.data.followUpDate}`
        : 'Follow-up completed or cleared',
    );
  if (
    changes.some(
      (key) =>
        !['status', 'interviewRounds', 'interviewAt', 'interviewNotes', 'followUpDate'].includes(
          key,
        ),
    )
  )
    messages.push('Application details updated');
  const application = await Application.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    {
      $set: result.data,
      ...(messages.length
        ? {
            $push: {
              activity: {
                $each: messages.map((message) => ({ message, at: new Date() })),
                $slice: -50,
              },
            },
          }
        : {}),
    },
    { new: true, runValidators: true },
  );
  if (!application) return res.status(404).json({ message: 'Application not found' });
  res.json({ application });
});

app.delete('/api/applications/:id', async (req, res) => {
  const application = await Application.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!application) return res.status(404).json({ message: 'Application not found' });
  res.status(204).end();
});

app.use('/api', (_req, res) => res.status(404).json({ message: 'API endpoint not found' }));
const dist = fileURLToPath(new URL('../dist', import.meta.url));
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed')
    return res.status(400).json({ message: 'Invalid JSON body' });
  if (error.type === 'entity.too.large')
    return res.status(413).json({ message: 'Request body is too large' });
  console.error(error.name, error.message);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

function invalidInput(res, error) {
  return res
    .status(400)
    .json({ message: 'Check the application details', errors: error.flatten() });
}
