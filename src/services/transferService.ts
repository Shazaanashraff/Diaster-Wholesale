import { supabase } from '../lib/supabase';
import type { StockTransfer, StockTransferItem } from '../types';

async function generateTransferReference(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_transfer_reference');
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getStockTransfers(): Promise<StockTransfer[]> {
  const { data, error } = await supabase
    .from('stock_transfers')
    .select('*, from_location:from_location_id(name, type), to_location:to_location_id(name, type)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as StockTransfer[];
}

export async function getStockTransferById(id: string): Promise<{
  transfer: StockTransfer;
  items: StockTransferItem[];
}> {
  const [{ data: transfer, error: te }, { data: items, error: ie }] = await Promise.all([
    supabase
      .from('stock_transfers')
      .select('*, from_location:from_location_id(name, type), to_location:to_location_id(name, type)')
      .eq('id', id)
      .single(),
    supabase
      .from('stock_transfer_items')
      .select('*, products(id, name, model, item_code, pieces_per_carton)')
      .eq('transfer_id', id),
  ]);
  if (te) throw new Error(te.message);
  if (ie) throw new Error(ie.message);
  return { transfer: transfer as StockTransfer, items: (items ?? []) as StockTransferItem[] };
}

export interface NewTransferItemInput {
  product_id: string;
  quantity: number;
}

export interface CreateTransferInput {
  from_location_id: string;
  to_location_id: string;
  notes?: string;
  requested_by: string;
  items: NewTransferItemInput[];
}

export async function createStockTransfer(input: CreateTransferInput): Promise<StockTransfer> {
  if (!input.from_location_id) throw new Error('Source location is required');
  if (!input.to_location_id) throw new Error('Destination location is required');
  if (input.from_location_id === input.to_location_id) throw new Error('Source and destination cannot be the same location');
  if (input.items.length === 0) throw new Error('At least one item is required');

  for (const item of input.items) {
    if (!item.product_id) throw new Error('All items must have a product selected');
    if (item.quantity <= 0) throw new Error('All item quantities must be greater than 0');
  }

  const reference = await generateTransferReference();

  const { data: transfer, error: te } = await supabase
    .from('stock_transfers')
    .insert({
      reference,
      from_location_id: input.from_location_id,
      to_location_id: input.to_location_id,
      status: 'pending',
      notes: input.notes ?? '',
      requested_by: input.requested_by,
    })
    .select()
    .single();
  if (te) throw new Error(te.message);

  const transferId = (transfer as StockTransfer).id;

  const { error: ie } = await supabase.from('stock_transfer_items').insert(
    input.items.map(i => ({
      transfer_id: transferId,
      product_id: i.product_id,
      quantity: i.quantity,
    }))
  );
  if (ie) throw new Error(ie.message);

  await supabase.from('audit_log').insert({
    table_name: 'stock_transfers',
    record_id: transferId,
    action: 'CREATE',
    new_values: { reference, from: input.from_location_id, to: input.to_location_id, items: input.items.length },
    user_label: input.requested_by,
    notes: `Transfer ${reference} created`,
  });

  return transfer as StockTransfer;
}

export async function completeStockTransfer(id: string, approvedBy: string): Promise<void> {
  const { error } = await supabase
    .from('stock_transfers')
    .update({ status: 'completed', approved_by: approvedBy })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);

  await supabase.from('audit_log').insert({
    table_name: 'stock_transfers',
    record_id: id,
    action: 'COMPLETE',
    new_values: { status: 'completed', approved_by: approvedBy },
    user_label: approvedBy,
    notes: 'Transfer completed — stock adjusted',
  });
}

export async function cancelStockTransfer(id: string): Promise<void> {
  const { error } = await supabase
    .from('stock_transfers')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
}
