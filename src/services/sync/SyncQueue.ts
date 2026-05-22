import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_STORAGE_KEY = 'bittersweet-sync-queue';

export interface SyncQueueEntry {
  id: string;
  table: string;
  operation: 'upsert' | 'soft_delete';
  data: Record<string, any>;
  timestamp: number;
}

export class SyncQueue {
  private queue: SyncQueueEntry[] = [];
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      this.queue = raw ? JSON.parse(raw) : [];
      this.loaded = true;
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.queue = [];
      this.loaded = true;
    }
  }

  async enqueue(entry: Omit<SyncQueueEntry, 'id' | 'timestamp'>): Promise<void> {
    await this.load();

    const fullEntry: SyncQueueEntry = {
      ...entry,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
    };

    // Deduplicate: remove older entries for the same table + same record ID
    const recordId = entry.data?.id;
    if (recordId) {
      this.queue = this.queue.filter(
        (e) => !(e.table === entry.table && e.data?.id === recordId)
      );
    }

    this.queue.push(fullEntry);
    await this.persist();
  }

  async dequeue(count: number = 50): Promise<SyncQueueEntry[]> {
    await this.load();
    const entries = this.queue.slice(0, count);
    return entries;
  }

  async remove(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    this.queue = this.queue.filter((e) => !idSet.has(e.id));
    await this.persist();
  }

  async clear(): Promise<void> {
    this.queue = [];
    await this.persist();
  }

  get size(): number {
    return this.queue.length;
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to persist sync queue:', error);
    }
  }
}

// Singleton instance
export const syncQueue = new SyncQueue();
