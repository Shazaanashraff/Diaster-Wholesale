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
 * Delete a product by ID.
 */
export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('deleteProduct error:', error.message);
    throw new Error(error.message);
  }
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
