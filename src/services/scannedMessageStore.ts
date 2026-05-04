import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local cache of Gmail message-ids that have been scanned.
 *
 * Lives entirely on-device (privacy invariant: backend never sees Gmail
 * message-ids). On disconnect we wipe the cache; on uninstall the OS
 * removes AsyncStorage.
 *
 * We use AsyncStorage rather than SQLite because:
 *  - The data shape is trivially flat (just message-ids + small per-id
 *    metadata), no joins or queries beyond "have I seen this id?".
 *  - AsyncStorage is JS-only and doesn't require a native rebuild,
 *    which keeps the feature shippable through OTA updates.
 *  - Even with 5000 scanned messages, the cache is < 500 KB JSON,
 *    well within AsyncStorage's per-key safe range.
 */

const STORAGE_KEY = 'gmail_scanned_messages_v1';

interface ScannedRecord {
  scannedAt: number;
  importedSubscriptionId: string | null;
  sourceSender: string | null;
}

type StorageShape = Record<string, ScannedRecord>;

let cache: StorageShape | null = null;

async function load(): Promise<StorageShape> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as StorageShape) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

async function save(data: StorageShape): Promise<void> {
  cache = data;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export interface ScannedRow {
  messageId: string;
  scannedAt: number;
  importedSubscriptionId: string | null;
  sourceSender: string | null;
}

export const scannedMessageStore = {
  /**
   * No-op for AsyncStorage backend, kept for API compatibility with the
   * earlier SQLite implementation.
   */
  async init() { /* AsyncStorage needs no schema setup */ },

  async markScanned(rows: { messageId: string; sourceSender: string | null }[]) {
    if (rows.length === 0) return;
    const data = await load();
    const now = Date.now();
    for (const r of rows) {
      if (data[r.messageId]) continue; // INSERT-OR-IGNORE semantics
      data[r.messageId] = {
        scannedAt: now,
        importedSubscriptionId: null,
        sourceSender: r.sourceSender,
      };
    }
    await save(data);
  },

  async filterUnscanned(messageIds: string[]): Promise<string[]> {
    if (messageIds.length === 0) return [];
    const data = await load();
    return messageIds.filter((id) => !data[id]);
  },

  async linkImportedSubscription(messageId: string, subscriptionId: string) {
    const data = await load();
    if (!data[messageId]) {
      data[messageId] = {
        scannedAt: Date.now(),
        importedSubscriptionId: subscriptionId,
        sourceSender: null,
      };
    } else {
      data[messageId].importedSubscriptionId = subscriptionId;
    }
    await save(data);
  },

  async getRow(messageId: string): Promise<ScannedRow | null> {
    const data = await load();
    const r = data[messageId];
    return r
      ? {
          messageId,
          scannedAt: r.scannedAt,
          importedSubscriptionId: r.importedSubscriptionId,
          sourceSender: r.sourceSender,
        }
      : null;
  },

  async dropAll() {
    cache = {};
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};
