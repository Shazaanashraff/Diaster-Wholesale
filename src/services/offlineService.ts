/**
 * Offline sale storage using IndexedDB.
 * Disabled for loyalty/partial-payment sales (requires server state).
 */

const DB_NAME = 'diastar_offline';
const DB_VERSION = 1;
const STORE_SALES = 'pending_sales';

export interface OfflineCartItem {
  productId: string;
  productName: string;
  quantityCartons: number;
  quantityPieces: number;
  piecesPerCarton: number;
  unitPrice: number;
  total: number;
  batchId?: string;
}

export interface OfflineSale {
  id: string;              // temp ID: 'OFF-<base36 timestamp>'
  invoiceNo: string;       // same as id
  customerId: string;
  customerName: string;
  isWholesale: boolean;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;   // single method only in offline mode
  paymentAmount: number;
  items: OfflineCartItem[];
  createdAt: string;
  synced: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SALES)) {
        db.createObjectStore(STORE_SALES, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineSale(sale: Omit<OfflineSale, 'id' | 'invoiceNo' | 'synced'>): Promise<string> {
  const db = await openDB();
  const id = 'OFF-' + Date.now().toString(36).toUpperCase();
  const record: OfflineSale = { ...sale, id, invoiceNo: id, synced: false };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SALES, 'readwrite');
    tx.objectStore(STORE_SALES).put(record);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingSales(): Promise<OfflineSale[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SALES, 'readonly');
    const req = tx.objectStore(STORE_SALES).getAll();
    req.onsuccess = () => resolve((req.result as OfflineSale[]).filter(s => !s.synced));
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const sales = await getPendingSales();
  return sales.length;
}

export async function markSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SALES, 'readwrite');
    const store = tx.objectStore(STORE_SALES);
    const req = store.get(id);
    req.onsuccess = () => {
      const record = req.result as OfflineSale;
      if (record) {
        record.synced = true;
        store.put(record);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearSyncedSales(): Promise<void> {
  const db = await openDB();
  const all: OfflineSale[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SALES, 'readonly');
    const req = tx.objectStore(STORE_SALES).getAll();
    req.onsuccess = () => resolve(req.result as OfflineSale[]);
    req.onerror = () => reject(req.error);
  });

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SALES, 'readwrite');
    const store = tx.objectStore(STORE_SALES);
    for (const s of all) {
      if (s.synced) store.delete(s.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncPendingSales(
  onProgress: (done: number, total: number) => void,
  syncFn: (sale: OfflineSale) => Promise<void>
): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingSales();
  let synced = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    try {
      await syncFn(pending[i]);
      await markSynced(pending[i].id);
      synced++;
    } catch {
      failed++;
    }
    onProgress(i + 1, pending.length);
  }

  if (synced > 0) await clearSyncedSales();
  return { synced, failed };
}
