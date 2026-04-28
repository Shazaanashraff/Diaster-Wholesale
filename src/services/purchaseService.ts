import { supabase } from '../lib/supabase';
import type { Purchase, PurchaseItem, PurchaseCost, PurchaseReceive } from '../types';

// ── List & fetch ──────────────────────────────────────────────────────────────

export async function getPurchases(): Promise<Purchase[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, suppliers(id, name, country)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Purchase[];
}

export async function getPurchaseById(id: string): Promise<{
  purchase: Purchase;
  items: PurchaseItem[];
  costs: PurchaseCost[];
  received: PurchaseReceive[];
}> {
  const [{ data: purchase, error: pe }, { data: items }, { data: costs }, { data: received }] =
    await Promise.all([
      supabase.from('purchases').select('*, suppliers(*)').eq('id', id).single(),
      supabase
        .from('purchase_items')
        .select('*, products(id, name, model, item_code, sku, pieces_per_carton, cost_price, msp, margin_pct)')
        .eq('purchase_id', id),
      supabase.from('purchase_costs').select('*').eq('purchase_id', id),
      supabase
        .from('purchase_receive')
        .select('*, products(id, name, model)')
        .eq('purchase_id', id),
    ]);

  if (pe) throw new Error(pe.message);
  return {
    purchase: purchase as Purchase,
    items: (items ?? []) as PurchaseItem[],
    costs: (costs ?? []) as PurchaseCost[],
    received: (received ?? []) as PurchaseReceive[],
  };
}

// ── Create ────────────────────────────────────────────────────────────────────

export interface NewPurchaseItemInput {
  product_id: string;
  quantity_units: number;
  quantity_cartons: number;
  unit_price_rmb: number;
}

export async function createPurchase(data: {
  supplier_id: string;
  exchange_rate: number;
  notes: string;
  items: NewPurchaseItemInput[];
}): Promise<Purchase> {
  // Generate reference via DB function
  const { data: refData, error: refErr } = await supabase.rpc('generate_purchase_reference');
  if (refErr) throw new Error(refErr.message);

  const totalRmb = data.items.reduce(
    (s, i) => s + i.quantity_units * i.unit_price_rmb,
    0
  );
  const totalLkr = totalRmb * data.exchange_rate;

  const { data: purchase, error: pe } = await supabase
    .from('purchases')
    .insert({
      reference: refData as string,
      supplier_id: data.supplier_id,
      exchange_rate: data.exchange_rate,
      total_rmb: totalRmb,
      total_lkr: totalLkr,
      notes: data.notes,
      status: 'draft',
    })
    .select()
    .single();
  if (pe) throw new Error(pe.message);

  const purchaseId = (purchase as Purchase).id;
  const { error: ie } = await supabase.from('purchase_items').insert(
    data.items.map((i) => ({ ...i, purchase_id: purchaseId }))
  );
  if (ie) throw new Error(ie.message);

  return purchase as Purchase;
}

// ── Update items (draft only) ─────────────────────────────────────────────────

export async function updatePurchaseItems(
  purchaseId: string,
  items: NewPurchaseItemInput[],
  exchangeRate: number
): Promise<void> {
  const totalRmb = items.reduce((s, i) => s + i.quantity_units * i.unit_price_rmb, 0);
  const totalLkr = totalRmb * exchangeRate;

  await supabase.from('purchase_items').delete().eq('purchase_id', purchaseId);
  const { error: ie } = await supabase.from('purchase_items').insert(
    items.map((i) => ({ ...i, purchase_id: purchaseId }))
  );
  if (ie) throw new Error(ie.message);

  const { error: pe } = await supabase
    .from('purchases')
    .update({ total_rmb: totalRmb, total_lkr: totalLkr, exchange_rate: exchangeRate })
    .eq('id', purchaseId);
  if (pe) throw new Error(pe.message);
}

// ── Status transitions ────────────────────────────────────────────────────────

export async function confirmPurchase(id: string): Promise<void> {
  const { error } = await supabase
    .from('purchases')
    .update({ status: 'confirmed' })
    .eq('id', id)
    .eq('status', 'draft');
  if (error) throw new Error(error.message);
}

export async function markInTransit(id: string): Promise<void> {
  const { error } = await supabase
    .from('purchases')
    .update({ status: 'in_transit' })
    .eq('id', id)
    .eq('status', 'confirmed');
  if (error) throw new Error(error.message);
}

// ── Receive confirmation ──────────────────────────────────────────────────────

export interface ReceiveItemInput {
  product_id: string;
  ordered_units: number;
  received_units: number;
  damaged_units: number;
  pieces_per_carton: number;
  notes?: string;
}

export async function receivePurchase(
  purchaseId: string,
  items: ReceiveItemInput[]
): Promise<void> {
  // Insert receive records
  const { error: re } = await supabase.from('purchase_receive').insert(
    items.map((i) => ({
      purchase_id: purchaseId,
      product_id: i.product_id,
      ordered_units: i.ordered_units,
      received_units: i.received_units,
      damaged_units: i.damaged_units,
      notes: i.notes ?? '',
    }))
  );
  if (re) throw new Error(re.message);

  // Add sellable stock to stock_batches (received - damaged)
  for (const item of items) {
    const sellableUnits = Math.max(0, item.received_units - item.damaged_units);
    if (sellableUnits > 0) {
      const cartons = Math.floor(sellableUnits / item.pieces_per_carton);
      const loosePieces = sellableUnits % item.pieces_per_carton;
      await supabase.from('stock_batches').insert({
        product_id: item.product_id,
        cartons,
        loose_pieces: loosePieces,
        notes: `Received from purchase (${purchaseId})`,
        received_at: new Date().toISOString(),
      });
    }
  }

  // Update status to received
  const { error: pe } = await supabase
    .from('purchases')
    .update({ status: 'received' })
    .eq('id', purchaseId);
  if (pe) throw new Error(pe.message);
}

// ── Costs ─────────────────────────────────────────────────────────────────────

export async function addPurchaseCost(data: {
  purchase_id: string;
  cost_type: 'shipping' | 'clearing' | 'tax' | 'other';
  amount_lkr: number;
  notes?: string;
}): Promise<PurchaseCost> {
  const { data: row, error } = await supabase
    .from('purchase_costs')
    .insert({ ...data, notes: data.notes ?? '' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row as PurchaseCost;
}

export async function deletePurchaseCost(id: string): Promise<void> {
  const { error } = await supabase.from('purchase_costs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Finalize costing & close ──────────────────────────────────────────────────

export async function finalizeCostingAndClose(
  purchaseId: string,
  items: PurchaseItem[],
  received: PurchaseReceive[],
  costs: PurchaseCost[],
  exchangeRate: number
): Promise<void> {
  // Total additional costs in LKR
  const totalAddlCosts = costs.reduce((s, c) => s + Number(c.amount_lkr), 0);

  // Total received units (sellable) across all items
  const totalSellable = received.reduce(
    (s, r) => s + Math.max(0, r.received_units - r.damaged_units),
    0
  );

  if (totalSellable === 0) throw new Error('No sellable units received.');

  // Compute per-item cost price and MSP, update products
  for (const item of items) {
    const receiveRow = received.find((r) => r.product_id === item.product_id);
    const sellable = receiveRow
      ? Math.max(0, receiveRow.received_units - receiveRow.damaged_units)
      : 0;
    if (sellable === 0) continue;

    const itemRmb = item.quantity_units * item.unit_price_rmb;
    const itemLkr = itemRmb * exchangeRate;

    // Proportion of additional costs allocated by unit count
    const proportion = sellable / totalSellable;
    const allocatedCosts = totalAddlCosts * proportion;

    const costPrice = (itemLkr + allocatedCosts) / sellable;

    const product = item.products as any;
    const marginPct = Number(product?.margin_pct ?? 20);
    const msp = costPrice * (1 + marginPct / 100);

    await supabase
      .from('products')
      .update({ cost_price: costPrice, msp })
      .eq('id', item.product_id);
  }

  // Close the purchase
  const { error } = await supabase
    .from('purchases')
    .update({ status: 'closed', cost_finalized: true })
    .eq('id', purchaseId);
  if (error) throw new Error(error.message);
}

// ── Delete draft ──────────────────────────────────────────────────────────────

export async function deletePurchase(id: string): Promise<void> {
  const { error } = await supabase.from('purchases').delete().eq('id', id).eq('status', 'draft');
  if (error) throw new Error(error.message);
}
