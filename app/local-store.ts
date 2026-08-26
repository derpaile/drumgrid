const DB_NAME = "klangmass";
const STORE_NAME = "kv";
const DB_VERSION = 3;

function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Lokaler Speicher konnte nicht geöffnet werden."));
    request.onblocked = () => reject(new Error("Lokaler Speicher wird von einem anderen Fenster blockiert."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Lokales Speichern ist fehlgeschlagen."));
    transaction.onabort = () => reject(transaction.error || new Error("Lokales Speichern wurde abgebrochen."));
  });
}

export async function readStore<T>(key: string, fallback: T): Promise<T> {
  let database: IDBDatabase | null = null;
  try {
    database = await openStore();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    const value = await new Promise<T | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
    await transactionDone(transaction);
    return value ?? fallback;
  } catch {
    return fallback;
  } finally {
    database?.close();
  }
}

export async function writeStore(key: string, value: unknown): Promise<void> {
  const database = await openStore();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, key);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function deleteStore(key: string): Promise<void> {
  const database = await openStore();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(key);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function clearLocalData(): Promise<void> {
  const database = await openStore();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
