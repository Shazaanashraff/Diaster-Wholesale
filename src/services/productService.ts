import { supabase } from '../lib/supabase';
import type { Product } from '../types';

// ============================================================
// Product Service — CRUD operations against Supabase
// ============================================================

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
  product: Omit<Product, 'id' | 'created_at' | 'updated_at'>
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
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
 * Check for duplicate product by model + name (case-insensitive).
 * Returns matching products (empty array = no duplicates).
 */
export async function checkDuplicate(
  model: string,
  name: string
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .ilike('model', model)
    .ilike('name', name);

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
