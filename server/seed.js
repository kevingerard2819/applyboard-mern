import 'dotenv/config';
import mongoose from 'mongoose';
import { Application } from './models/Application.js';

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in .env');
try {
  await mongoose.connect(process.env.MONGODB_URI);
  if (await Application.exists({})) {
    console.log('Seed skipped: existing applications are preserved.');
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const interviewAt = new Date(Date.now() + 2 * 86400000).toISOString();
    await Application.insertMany([
      {
        company: 'Northstar',
        role: 'Frontend Engineer',
        location: 'Remote',
        status: 'Interview',
        notes: 'Prepare a walkthrough of a recent React project.',
        interviewAt,
        interviewNotes: 'Fictional example: technical round and project walkthrough.',
      },
      {
        company: 'Studio Eleven',
        role: 'Full Stack Developer',
        location: 'London · Hybrid',
        status: 'Applied',
        followUpDate: today,
        nextStep: 'Ask the recruiter about the next round.',
      },
      {
        company: 'Bloom',
        role: 'Software Engineer',
        location: 'Remote',
        status: 'Wishlist',
        notes: 'Explore the engineering team and product before applying.',
      },
      { company: 'Orbit Labs', role: 'Product Engineer', location: 'Berlin', status: 'Offer' },
    ]);
    console.log('Added four fictional example applications.');
  }
} finally {
  await mongoose.disconnect();
}
