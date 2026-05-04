import * as SQLite from 'expo-sqlite';

/**
 * Local cache of Gmail message-ids that have been scanned.
 *
 * Lives entirely on-device (privacy invariant: backend never sees Gmail
 * message-ids). On disconnect we DROP the table; on uninstall the OS
 * removes the file.
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const getDb = () => {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync('gmail_import.db');
  return dbPromise;
};

export interface ScannedRow {
  messageId: string;
  scannedAt: number;
  importedSubscriptionId: string | null;
  sourceSender: string | null;
}

export const scannedMessageStore = {
  async init() {
    const db = await getDb();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS scanned_messages (
        message_id TEXT PRIMARY KEY,
        scanned_at INTEGER NOT NULL,
        imported_subscription_id TEXT NULL,
        source_sender TEXT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_scanned_at ON scanned_messages(scanned_at);
    `);
  },

  async markScanned(rows: { messageId: string; sourceSender: string | null }[]) {
    if (rows.length === 0) return;
    const db = await getDb();
    const now = Date.now();
    await db.withTransactionAsync(async () => {
      for (const r of rows) {
        await db.runAsync(
          'INSERT OR IGNORE INTO scanned_messages (message_id, scanned_at, source_sender) VALUES (?, ?, ?)',
          [r.messageId, now, r.sourceSender],
        );
      }
    });
  },

  async filterUnscanned(messageIds: string[]): Promise<string[]> {
    if (messageIds.length === 0) return [];
    const db = await getDb();
    const seen = new Set<string>();
    // SQLite parameter limit is ~999; chunk to be safe.
    const CHUNK = 500;
    for (let i = 0; i < messageIds.length; i += CHUNK) {
      const slice = messageIds.slice(i, i + CHUNK);
      const placeholders = slice.map(() => '?').join(',');
      const rows: { message_id: string }[] = await db.getAllAsync(
        `SELECT message_id FROM scanned_messages WHERE message_id IN (${placeholders})`,
        slice,
      );
      for (const r of rows) seen.add(r.message_id);
    }
    return messageIds.filter((id) => !seen.has(id));
  },

  async linkImportedSubscription(messageId: string, subscriptionId: string) {
    const db = await getDb();
    await db.runAsync(
      'UPDATE scanned_messages SET imported_subscription_id = ? WHERE message_id = ?',
      [subscriptionId, messageId],
    );
  },

  async getRow(messageId: string): Promise<ScannedRow | null> {
    const db = await getDb();
    const r = await db.getFirstAsync<{
      message_id: string;
      scanned_at: number;
      imported_subscription_id: string | null;
      source_sender: string | null;
    }>('SELECT * FROM scanned_messages WHERE message_id = ?', [messageId]);
    return r
      ? {
          messageId: r.message_id,
          scannedAt: r.scanned_at,
          importedSubscriptionId: r.imported_subscription_id,
          sourceSender: r.source_sender,
        }
      : null;
  },

  async dropAll() {
    const db = await getDb();
    await db.execAsync('DROP TABLE IF EXISTS scanned_messages');
  },
};
