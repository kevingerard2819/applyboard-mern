// A real local MongoDB process with persistent data, for reviewers without Docker/Atlas.
import { MongoMemoryServer } from 'mongodb-memory-server';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const dataPath = path.resolve('.cache/mongo-data');
await mkdir(dataPath, { recursive: true });
process.env.MONGOMS_DOWNLOAD_DIR ||= path.resolve('.cache/mongodb');
process.env.MONGOMS_VERSION ||= '7.0.14';
const mongo = await MongoMemoryServer.create({
  instance: { dbPath: dataPath, storageEngine: 'wiredTiger' },
});
const api = spawn(process.execPath, ['--watch', 'server/index.js'], {
  stdio: 'inherit',
  env: { ...process.env, MONGODB_URI: mongo.getUri('applyboard') },
});
const web = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
  stdio: 'inherit',
});
console.log('Local MongoDB ready. Application data persists in .cache/mongo-data.');
console.log(`Local MongoDB URI: ${mongo.getUri('applyboard')}`);
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api.kill();
  web.kill();
  await mongo.stop({ doCleanup: false });
  process.exit(code);
}
api.on('exit', (code) => stop(code || 0));
web.on('exit', (code) => stop(code || 0));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
