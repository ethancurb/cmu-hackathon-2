import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { validateSnapshot, type Snapshot } from '../src/domain/schema.js';
import { AppError } from './errors.js';

const validId = (id: string) => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(id)) throw new AppError('INVALID_SNAPSHOT_ID', 'Invalid snapshot identifier.', 400);
  return id;
};

export function createSnapshotStore(directory: string) {
  const root = path.resolve(directory);
  const location = (id: string) => path.join(root, 'snapshots', validId(id), 'snapshot.json');
  let publication: Promise<void> = Promise.resolve();

  const load = async (id: string): Promise<Snapshot> => {
    const file = location(id);
    try {
      const data = validateSnapshot(JSON.parse(await readFile(file, 'utf8')));
      if (data.id !== id) throw new AppError('SNAPSHOT_CORRUPT', 'Snapshot identity does not match its file.');
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new AppError('SNAPSHOT_NOT_FOUND', 'That research snapshot is unavailable.', 404);
      throw error;
    }
  };
  const loadCurrent = async (): Promise<Snapshot> => {
    try {
      const pointer: unknown = JSON.parse(await readFile(path.join(root, 'current.json'), 'utf8'));
      if (!pointer || typeof pointer !== 'object' || !('snapshotId' in pointer) || typeof pointer.snapshotId !== 'string') {
        throw new AppError('SNAPSHOT_CORRUPT', 'The current research pointer is invalid.');
      }
      return load(pointer.snapshotId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new AppError('NO_SNAPSHOT', 'No research snapshot has been published yet.', 404);
      throw error;
    }
  };
  const publishNow = async (input: Snapshot) => {
    const snapshot = validateSnapshot(input);
    const target = location(snapshot.id);
    const body = JSON.stringify(snapshot, null, 2) + '\n';
    await mkdir(path.dirname(target), { recursive: true });
    let exists = false;
    try {
      const previous = await readFile(target, 'utf8');
      if (previous !== body) throw new AppError('SNAPSHOT_EXISTS', 'An immutable snapshot already has that identifier.', 409);
      exists = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const temporary = `${target}.${randomUUID()}.partial`;
    const pointerTemporary = path.join(root, `current.${randomUUID()}.partial`);
    try {
      if (!exists) {
        await writeFile(temporary, body, { flag: 'wx' });
        await rename(temporary, target);
      }
      await writeFile(pointerTemporary, JSON.stringify({ snapshotId: snapshot.id }) + '\n', { flag: 'wx' });
      await rename(pointerTemporary, path.join(root, 'current.json'));
    } finally {
      await Promise.all([temporary, pointerTemporary].map(file => unlink(file).catch(() => undefined)));
    }
  };
  const publish = (input: Snapshot) => {
    const next = publication.then(() => publishNow(input));
    publication = next.catch(() => undefined);
    return next;
  };
  return { publish, load, loadCurrent };
}

const defaultStore = createSnapshotStore(path.join(process.cwd(), 'data'));
export const publishSnapshot = defaultStore.publish;
export const loadCurrentSnapshot = defaultStore.loadCurrent;
export type SnapshotStore = ReturnType<typeof createSnapshotStore>;
