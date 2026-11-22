import { allKeys, db, put, STORE } from './idb';

// A lesson video is written to the device piece by piece while it records (key rec:<id>:<n>, one piece a second),
// so even a two-hour lesson never has to sit in the memory: the app stays light and smooth. When the recording
// stops the pieces are joined into one file (the browser keeps it on disk) and deleted once it is saved. If the app
// closes in the middle (battery, a crash), the pieces are still there and the video can be saved next time.

const key = (id: string, n: number) => `rec:${id}:${String(n).padStart(7, '0')}`;

/** The pieces of one recording. Falls back to memory if the device cannot store them (nothing is lost). */
export class RecParts {
  private n = 0;
  private queue: Promise<void> = Promise.resolve();
  private mem: Blob[] = [];
  private onDisk = true;

  constructor(readonly id: string) {}

  /** Keep one piece (writes run one after another, never blocking the screen). */
  add(b: Blob): void {
    const n = this.n++;
    this.queue = this.queue.then(async () => {
      if (this.onDisk) {
        try {
          await put([[key(this.id, n), b]]);
          return;
        } catch {
          // Full or blocked storage: keep the rest in memory (as before), with what was stored kept too.
          this.onDisk = false;
        }
      }
      this.mem.push(b);
    });
  }

  /** The whole video as one file. */
  async blob(type: string): Promise<Blob> {
    await this.queue;
    return new Blob([...(await readParts(this.id)), ...this.mem], { type });
  }

  /** Forget the pieces (after the video is saved). */
  async clear(): Promise<void> {
    await this.queue;
    this.mem = [];
    await clearParts(this.id);
  }
}

/** Every stored piece of a recording, in order. */
async function readParts(id: string): Promise<Blob[]> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE).objectStore(STORE).getAll(IDBKeyRange.bound(`rec:${id}:`, `rec:${id}:~`));
    req.onsuccess = () => resolve(req.result as Blob[]);
    req.onerror = () => reject(req.error);
  });
}

export async function clearParts(id: string): Promise<void> {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(IDBKeyRange.bound(`rec:${id}:`, `rec:${id}:~`));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Recordings whose pieces are still on the device: id, file type, and whether the video was already saved. */
export async function leftRecordings(): Promise<{ id: string; type: string; saved: boolean; start: number }[]> {
  const keys = (await allKeys()).filter((k) => k.startsWith('rec:'));
  const ids = [...new Set(keys.map((k) => k.split(':')[1]))];
  const d = await db();
  const out: { id: string; type: string; saved: boolean; start: number }[] = [];
  for (const id of ids) {
    const meta = await new Promise<RecMeta | undefined>((resolve) => {
      const req = d.transaction(STORE).objectStore(STORE).get(`recmeta:${id}`);
      req.onsuccess = () => resolve(req.result as RecMeta | undefined);
      req.onerror = () => resolve(undefined);
    });
    out.push({ id, type: meta?.type ?? 'video/webm', saved: !!meta?.saved, start: meta?.start ?? 0 });
  }
  return out;
}

interface RecMeta {
  type: string;
  start: number;
  saved?: boolean;
}

/** Remember a recording's file type, so a left-over one can be saved later; saved = the video was handed over. */
export function noteType(id: string, type: string, start: number, saved = false): Promise<void> {
  return put([[`recmeta:${id}`, { type, start, saved } satisfies RecMeta]]);
}

export function forgetType(id: string): Promise<void> {
  return put([], [`recmeta:${id}`]);
}

/** Join the pieces of a left-over recording. */
export async function leftBlob(id: string, type: string): Promise<Blob> {
  return new Blob(await readParts(id), { type });
}
