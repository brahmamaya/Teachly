// The on-device database (IndexedDB) and the few things everything else
// needs from it. One store, plain keys:
//   library, folders, srcrefs     small lists
//   nb:<id>                       a notebook (pages and elements; pictures are referenced)
//   rv:<id>                       the notebook's revision number (small: read on every save instead of the whole notebook)
//   asset:<time>:<hash>           a picture of a page element (stored once, as a file)
//   src:… / pimg:…                an opened PDF and its page pictures
//   bak:<id>:v<n>                 the untouched original of a notebook that was migrated

const DB = 'teachly';
export const STORE = 'docs';

let dbp: Promise<IDBDatabase> | null = null;
export function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      // Another window upgrading or closing the database: reopen on next use.
      req.result.onclose = () => (dbp = null);
      req.result.onversionchange = () => {
        req.result.close();
        dbp = null;
      };
      resolve(req.result);
    };
    req.onerror = () => {
      dbp = null;
      reject(req.error);
    };
  });
  return dbp;
}

export async function get<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function allKeys(): Promise<string[]> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE).objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result.map(String));
    req.onerror = () => reject(req.error);
  });
}

/**
 * Run several reads and writes as ONE transaction: all of them happen or
 * none do. Settles on commit, and rejects on any error or abort (a full
 * disk aborts the transaction; the old data stays as it was).
 */
export async function atomic<T>(work: (os: IDBObjectStore, done: (v: T) => void) => void): Promise<T> {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    let value: T;
    work(tx.objectStore(STORE), (v) => (value = v));
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error ?? new Error('Storage error'));
    tx.onabort = () => reject(tx.error ?? new DOMException('Storage write was cancelled', 'AbortError'));
  });
}

export async function put(entries: [string, unknown][], remove: string[] = []): Promise<void> {
  await atomic<void>((os) => {
    for (const [k, v] of entries) os.put(v, k);
    for (const k of remove) os.delete(k);
  });
}

/** One queue for everything that changes the library list or a notebook: no two writes ever mix. */
let chain: Promise<unknown> = Promise.resolve();
export function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job);
  chain = run.catch(() => undefined);
  return run;
}
