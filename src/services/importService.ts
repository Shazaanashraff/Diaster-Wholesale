import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { getProducts, createProduct } from './productService';
import type { Product, Shipment } from '../types';
import type { RawExcelRow, ImportRow, ImportSummary } from '../types/import';

// ============================================================
// Import Service — Excel parsing, classification & Supabase writes
// ============================================================

// ----------------------------------------------------------
// 1. parseExcelFile
//    Read an Excel file, extract rows from the first sheet,
//    validate required fields, and return typed RawExcelRow[]
//    wrapped as ImportRow[] (with error status for bad rows).
// ----------------------------------------------------------

export async function parseExcelFile(file: File): Promise<ImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The Excel file contains no sheets.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new Error('Could not read the first sheet.');
  }

  // Parse sheet into array of objects using header row
  const rawData: unknown[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const rows: ImportRow[] = rawData.map((raw) => {
    const row = raw as Record<string, unknown>;

    // Map flexible column headers to our typed fields
    const item_code = normalizeString(row['Item Code'] ?? row['item_code'] ?? '');
    const name = normalizeString(row['Product Name'] ?? row['Name'] ?? row['name'] ?? '');
    const model = normalizeString(row['Model'] ?? row['model'] ?? '');
    const cartons = normalizeNumber(row['Cartons'] ?? row['cartons'] ?? 0);
    const units_per_carton = normalizeNumber(row['Units Per Carton'] ?? row['units_per_carton'] ?? 0);
    const cost_price = normalizeNumber(row['Cost Price'] ?? row['cost_price'] ?? 0);

    // Validate required fields
    const errors: string[] = [];
    if (!name) errors.push('Name is required');
    if (!model) errors.push('Model is required');
    if (!cartons || cartons <= 0) errors.push('Cartons must be a positive number');

    if (errors.length > 0) {
      return {
        item_code: item_code || undefined,
        name,
        model,
        cartons,
        units_per_carton,
        cost_price: cost_price || undefined,
        status: 'error' as const,
        error_message: errors.join('; '),
      };
    }

    return {
      item_code: item_code || undefined,
      name,
      model,
      cartons,
      units_per_carton,
      cost_price: cost_price || undefined,
      status: 'new' as const, // temporary — classifyRows will update this
    };
  });

  return rows;
}

// ----------------------------------------------------------
// 2. classifyRows
//    Fetch all existing products, then classify each row
//    into match_code / match_name / new (errors stay as-is).
// ----------------------------------------------------------

export async function classifyRows(rawRows: ImportRow[]): Promise<ImportRow[]> {
  const products = await getProducts();

  return rawRows.map((row) => {
    // Skip rows that already failed validation
    if (row.status === 'error') return row;

    // Case 1: exact item_code match
    if (row.item_code) {
      const codeMatch = products.find(
        (p) => p.item_code.toLowerCase() === row.item_code!.toLowerCase()
      );
      if (codeMatch) {
        return { ...row, status: 'match_code' as const, matched_product: codeMatch };
      }
    }

    // Case 2: model exact match (case-insensitive) AND name includes match (case-insensitive)
    const nameModelMatch = products.find(
      (p) =>
        p.model.toLowerCase() === row.model.toLowerCase() &&
        p.name.toLowerCase().includes(row.name.toLowerCase())
    );
    if (nameModelMatch) {
      return { ...row, status: 'match_name' as const, matched_product: nameModelMatch };
    }

    // Case 3: no match — new product
    return { ...row, status: 'new' as const };
  });
}

// ----------------------------------------------------------
// 3. confirmImport
//    Insert shipment → create new products → insert stock batches.
//    Returns ImportSummary with counts.
// ----------------------------------------------------------

export async function confirmImport(
  rows: ImportRow[],
  shipmentCode: string,
  supplierName: string
): Promise<ImportSummary> {
  // Step A: insert shipment
  const { data: shipment, error: shipError } = await supabase
    .from('shipments')
    .insert({
      reference: shipmentCode,
      supplier: supplierName,
      notes: `Bulk import: ${shipmentCode}`,
      arrived_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (shipError || !shipment) {
    console.error('confirmImport — shipment insert error:', shipError?.message);
    throw new Error(shipError?.message ?? 'Failed to create shipment');
  }

  const shipmentRecord = shipment as Shipment;

  // Step B: for 'new' rows, create the product first
  const processedRows: ImportRow[] = [];
  for (const row of rows) {
    if (row.status === 'error') {
      processedRows.push(row);
      continue;
    }

    if (row.status === 'new') {
      try {
        const newProduct = await createProduct({
          item_code: row.item_code ?? '',
          name: row.name,
          model: row.model,
          description: '',
          category: '',
          wholesale_price: 0,
          retail_price: 0,
          pieces_per_carton: row.units_per_carton,
        });
        processedRows.push({ ...row, matched_product: newProduct });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create product';
        processedRows.push({ ...row, status: 'error', error_message: message });
      }
      continue;
    }

    // match_code or match_name — already has matched_product
    processedRows.push(row);
  }

  // Step C: insert stock_batches for all non-error rows
  const batchInserts = processedRows
    .filter((r) => r.status !== 'error' && r.matched_product)
    .map((r) => ({
      product_id: r.matched_product!.id,
      shipment_id: shipmentRecord.id,
      cartons: r.cartons,
      pieces: 0,
      cost_per_piece: r.cost_price ?? 0,
      notes: `Imported via ${shipmentCode}`,
      received_at: new Date().toISOString(),
    }));

  if (batchInserts.length > 0) {
    const { error: batchError } = await supabase
      .from('stock_batches')
      .insert(batchInserts);

    if (batchError) {
      console.error('confirmImport — stock_batches insert error:', batchError.message);
      throw new Error(batchError.message);
    }
  }

  // Step D: calculate summary
  const summary: ImportSummary = {
    total: processedRows.length,
    matched_by_code: processedRows.filter((r) => r.status === 'match_code').length,
    matched_by_name: processedRows.filter((r) => r.status === 'match_name').length,
    new_products: processedRows.filter((r) => r.status === 'new').length,
    errors: processedRows.filter((r) => r.status === 'error').length,
  };

  return summary;
}

// ----------------------------------------------------------
// 4. getRollbackableShipments
//    Fetch all shipments ordered by most recent first.
// ----------------------------------------------------------

export async function getRollbackableShipments(): Promise<Shipment[]> {
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getRollbackableShipments error:', error.message);
    throw new Error(error.message);
  }

  return data as Shipment[];
}

// ----------------------------------------------------------
// 5. rollbackShipment
//    Safety check: if any stock_batch for this shipment has
//    a product_id that appears in invoice_items, throw.
//    Otherwise delete the stock_batches (keep shipment for audit).
// ----------------------------------------------------------

export async function rollbackShipment(shipmentId: string): Promise<void> {
  // Get all stock_batches for this shipment
  const { data: batches, error: batchError } = await supabase
    .from('stock_batches')
    .select('product_id')
    .eq('shipment_id', shipmentId);

  if (batchError) {
    console.error('rollbackShipment — fetch batches error:', batchError.message);
    throw new Error(batchError.message);
  }

  if (!batches || batches.length === 0) {
    throw new Error('No stock batches found for this shipment. It may have already been rolled back.');
  }

  // Check if any of these products appear in invoice_items
  const productIds = [...new Set(batches.map((b) => b.product_id))];

  const { data: soldItems, error: soldError } = await supabase
    .from('invoice_items')
    .select('product_id')
    .in('product_id', productIds)
    .limit(1);

  if (soldError) {
    console.error('rollbackShipment — sold check error:', soldError.message);
    throw new Error(soldError.message);
  }

  if (soldItems && soldItems.length > 0) {
    throw new Error('Cannot rollback — stock from this shipment has been sold.');
  }

  // Safe to delete stock_batches
  const { error: deleteError } = await supabase
    .from('stock_batches')
    .delete()
    .eq('shipment_id', shipmentId);

  if (deleteError) {
    console.error('rollbackShipment — delete error:', deleteError.message);
    throw new Error(deleteError.message);
  }
}

// ----------------------------------------------------------
// 6. generateSampleTemplate
//    Create and download a sample Excel file so users know
//    the expected column format.
// ----------------------------------------------------------

export function downloadSampleTemplate(): void {
  const sampleData = [
    {
      'Item Code': 'ITM-001',
      'Product Name': 'Wireless Bluetooth Speaker',
      'Model': 'BT-SPK-200',
      'Cartons': 10,
      'Units Per Carton': 24,
      'Cost Price': 15.50,
    },
    {
      'Item Code': '',
      'Product Name': 'USB-C Charging Cable',
      'Model': 'USB-C-1M',
      'Cartons': 25,
      'Units Per Carton': 50,
      'Cost Price': 2.75,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Import Template');

  // Set column widths for readability
  worksheet['!cols'] = [
    { wch: 14 }, // Item Code
    { wch: 30 }, // Product Name
    { wch: 16 }, // Model
    { wch: 10 }, // Cartons
    { wch: 16 }, // Units Per Carton
    { wch: 12 }, // Cost Price
  ];

  XLSX.writeFile(workbook, 'Diastar_Import_Template.xlsx');
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}
