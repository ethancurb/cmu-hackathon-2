import path from 'node:path';
import { savedSeed } from '../server/research.js';
import { createSnapshotStore } from '../server/snapshots.js';

const seed = await savedSeed();
await createSnapshotStore(path.resolve('data')).publish(seed);
process.stdout.write(`Restored CMU seed ${seed.id}. Newer snapshots remain saved. Use “Reset demo” in the interface to restore browser criteria and selections.\n`);
