import { closeDb, DB_NAME } from '../storage/db';
import { resetEventsForTests } from '../lib/events';

/** Remet IndexedDB (fake-indexeddb) à zéro entre deux tests. */
export async function resetDb(): Promise<void> {
  // Laisse se terminer les lectures encore en vol du test précédent.
  await new Promise((resolve) => setTimeout(resolve, 30));
  await closeDb();
  resetEventsForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(new Error('delete failed'));
    };
  });
}
