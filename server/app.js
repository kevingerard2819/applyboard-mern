import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Application } from './models/Application.js';
import { statuses } from '../shared/statuses.js';
import { applicationInput, applicationPatch } from './validation.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable' });
});

app.use('/api/applications', (_req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res
      .status(503)
      .json({ message: 'The database is unavailable. Please try again shortly.' });
  }
  next();
});

app.get('/api/applications', async (req, res) => {
  const { status, q = '' } = req.query;
  if (typeof q !== 'string' || q.length > 100 || (status && !statuses.includes(status))) {
    return res.status(400).json({ message: 'Invalid search or status filter' });
  }
  const filter = {};
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
  const application = await Application.create(result.data);
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
  const application = await Application.findByIdAndUpdate(
    req.params.id,
    { $set: result.data },
    { new: true, runValidators: true },
  );
  if (!application) return res.status(404).json({ message: 'Application not found' });
  res.json({ application });
});

app.delete('/api/applications/:id', async (req, res) => {
  const application = await Application.findByIdAndDelete(req.params.id);
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
