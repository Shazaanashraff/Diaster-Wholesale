import { supabase } from '../lib/supabase';
import type { Product } from '../types';

// ============================================================
// Product Service — CRUD operations against Supabase
// ============================================================

async function loadExistingItemCodes(): Promise<Set<string>> {
  const { data, error } = await supabase.from('products').select('item_code');
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => String(row.item_code).trim().toUpperCase()));
}

export async function generateItemCode(prefetchedCodes?: string[]): Promise<string> {
  const existing =
    prefetchedCodes && prefetchedCodes.length > 0
      ? new Set(prefetchedCodes.map((code) => code.trim().toUpperCase()))
      : await loadExistingItemCodes();

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!existing.has(code)) return code;
  }

  throw new Error('Unable to generate a unique item code. Please try again.');
}

/**
 * Fetch all products ordered by name (A-Z).
 */
export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('getProducts error:', error.message);
    throw new Error(error.message);
  }

  return data as Product[];
}

/**
 * Fetch a single product by ID.
 */
export async function getProductById(id: string): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('getProductById error:', error.message);
    throw new Error(error.message);
  }

  return data as Product;
}

/**
 * Insert a new product and return the created record.
 */
export async function createProduct(
  product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'item_code' | 'model' | 'description'> & {
    item_code?: string;
    model?: string;
    description?: string;
  }
): Promise<Product> {
  const payload = {
    ...product,
    item_code:
      product.item_code && product.item_code.trim().length > 0
        ? product.item_code.trim()
        : await generateItemCode(),
    model: product.model ?? '',
    description: product.description ?? '',
  };

  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('createProduct error:', error.message);
    throw new Error(error.message);
  }

  return data as Product;
}

/**
 * Update an existing product by ID and return the updated record.
 */
export async function updateProduct(
  id: string,
  updates: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('updateProduct error:', error.message);
    throw new Error(error.message);
  }

  return data as Product;
}

/**
 * Check for duplicate product by name (case-insensitive).
 * Returns matching products (empty array = no duplicates).
 */
export async function checkDuplicate(name: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .ilike('name', name.trim());

  if (error) {
    console.error('checkDuplicate error:', error.message);
    throw new Error(error.message);
  }

  return data as Product[];
}

/**
 * Delete a product by ID and all linked records.
 * Clears all foreign key references before deleting the product.
 */
/**
 * Delete a product by ID at the database level using the stored function
 * `delete_product_cascade(product_id uuid, dry_run boolean)`.
 * The function performs a transactional cascade delete and returns a JSON
 * object with counts per table and a `deleted` flag.
 */
export async function deleteProduct(id: string): Promise<void> {
  const { data, error } = await supabase.rpc('delete_product_cascade', { product_id: id, dry_run: false });
  if (error) {
    console.error('deleteProduct rpc error:', error.message);
    throw new Error(error.message);
  }
  // Optionally, inspect `data` for details about what was deleted
}

/**
 * Preview the rows that would be deleted for a product.
 * Calls the same DB function with `dry_run=true` and returns the counts.
 */
export async function previewDeleteProduct(id: string): Promise<any> {
  const { data, error } = await supabase.rpc('delete_product_cascade', { product_id: id, dry_run: true });
  if (error) {
    console.error('previewDeleteProduct rpc error:', error.message);
    throw new Error(error.message);
  }
  return data;
}

export async function archiveProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    console.error('archiveProduct error:', error.message);
    throw new Error(error.message);
  }
}

const PRODUCT_LINK_TABLES = [
  'invoice_items',
  'sales_return_items',
  'returns',
  'supplier_return_items',
  'purchase_items',
  'purchase_receive',
  'stock_batches',
  'stock_adjustments',
  'stock_transfer_items',
  'cartons',
];

export async function getProductLinkCounts(productId: string): Promise<Record<string, number>> {
  const results = await Promise.all(
    PRODUCT_LINK_TABLES.map((table) =>
      supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId)
    )
  );

  const counts: Record<string, number> = {};
  results.forEach((res, idx) => {
    if (res.error) {
      throw new Error(res.error.message);
    }
    counts[PRODUCT_LINK_TABLES[idx]] = res.count ?? 0;
  });

  return counts;
}

export async function clearProductStockAdjustments(productId: string): Promise<void> {
  const { error } = await supabase
    .from('stock_adjustments')
    .delete()
    .eq('product_id', productId);

  if (error) {
    throw new Error(error.message);
  }
}
