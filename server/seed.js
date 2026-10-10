import 'dotenv/config';
import mongoose from 'mongoose';
import { Application } from './models/Application.js';
import { User } from './auth.js';
import { sampleApplications } from './sampleApplications.js';

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env');
try {
  await mongoose.connect(process.env.MONGODB_URI);
  const email = process.argv[2]?.trim().toLowerCase();
  const user = email && (await User.findOne({ email }));
  if (!user) throw new Error('Create an account first, then run: pnpm seed your@email.com');
  if (await Application.exists({ userId: user._id })) {
    console.log('Seed skipped: existing applications are preserved.');
  } else {
    const applications = sampleApplications(user._id);
    await Application.insertMany(applications);
    console.log(`Added ${applications.length} fictional example applications.`);
  }
} finally {
  await mongoose.disconnect();
}
