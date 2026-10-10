import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../server/auth.js';
import { Application } from '../server/models/Application.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !process.env.MONGODB_URI)
  throw new Error('Set MONGODB_URI and run: pnpm assign:legacy your@email.com');
try {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email });
  if (!user) throw new Error('Create this account in the app first.');
  const result = await Application.updateMany(
    { userId: { $exists: false } },
    { $set: { userId: user._id } },
  );
  console.log(`Assigned ${result.modifiedCount} legacy applications to ${user.email}.`);
} finally {
  await mongoose.disconnect();
}
