import 'dotenv/config';
import mongoose from 'mongoose';
import { app } from './app.js';

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required. Copy .env.example to .env first.');
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const server = app.listen(Number(process.env.PORT || 4000), '127.0.0.1', () =>
    console.log('ApplyBoard API ready'),
  );
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      });
    });
  }
} catch (error) {
  console.error(
    `Unable to connect to MongoDB (${error.name}). Check MONGODB_URI and database availability.`,
  );
  process.exit(1);
}
