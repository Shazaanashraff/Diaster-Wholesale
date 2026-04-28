import { supabase } from '../lib/supabase';
import type { Product } from '../types';

export interface CartItem {
  product: Product;
  quantityCartons: number;
  quantityPieces: number;
}

export const checkout = async (
  cart: CartItem[],
  customerId: string,
  isWholesale: boolean,
  subtotal: number,
  discount: number,
  total: number,
  paymentMethod: string
) => {
  try {
    const productIds = [...new Set(cart.map((item) => item.product.id))];

    // Validate stock from database before writing invoice rows.
    const { data: stockRows, error: stockError } = await supabase
      .from('product_stock')
      .select('product_id, pieces_per_carton, cartons_in, pieces_in, cartons_sold, pieces_sold, carton_adj, piece_adj')
      .in('product_id', productIds);

    if (stockError) {
      throw new Error(`Failed to validate stock: ${stockError.message}`);
    }

    const stockByProduct = new Map(
      ((stockRows ?? []) as Array<{
        product_id: string;
        pieces_per_carton: number;
        cartons_in: number;
        pieces_in: number;
        cartons_sold: number;
        pieces_sold: number;
        carton_adj: number;
        piece_adj: number;
      }>).map((row) => {
        const piecesPerCarton = row.pieces_per_carton || 1;
        const totalIn = row.cartons_in * piecesPerCarton + row.pieces_in;
        const totalOut = row.cartons_sold * piecesPerCarton + row.pieces_sold;
        const totalAdj = row.carton_adj * piecesPerCarton + row.piece_adj;
        const availablePieces = Math.max(0, totalIn - totalOut + totalAdj);
        return [row.product_id, availablePieces];
      })
    );

    for (const item of cart) {
      const piecesPerCarton = item.product.pieces_per_carton || 1;
      const requestedPieces = item.quantityCartons * piecesPerCarton + item.quantityPieces;
      const availablePieces = stockByProduct.get(item.product.id) ?? 0;

      if (requestedPieces > availablePieces) {
        throw new Error(
          `Insufficient stock for ${item.product.name}. Requested ${requestedPieces}, available ${availablePieces}.`
        );
      }
    }

    // 1. Generate Invoice Number
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const invoiceNo = `INV-${randomNum}`;

    // 2. Insert Invoice
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_no: invoiceNo,
        customer_id: customerId,
        mode: isWholesale ? 'wholesale' : 'retail',
        subtotal,
        discount,
        total,
        payment_status: paymentMethod === 'credit' ? 'unpaid' : 'paid',
      })
      .select('id')
      .single();

    if (invoiceError) {
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

    const invoiceId = invoiceData.id;

    // 3. Insert Invoice Items
    const invoiceItems = cart.map((item) => {
      const piecePrice = isWholesale ? item.product.wholesale_price : item.product.retail_price;
      const piecesPerCarton = item.product.pieces_per_carton || 1;
      const totalPieces = item.quantityCartons * piecesPerCarton + item.quantityPieces;
      const itemTotal = piecePrice * totalPieces;
      
      return {
        invoice_id: invoiceId,
        product_id: item.product.id,
        cartons: item.quantityCartons,
        pieces: item.quantityPieces,
        unit_price: piecePrice,
        total: itemTotal,
      };
    });

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems);

    if (itemsError) {
      throw new Error(`Failed to create invoice items: ${itemsError.message}`);
    }

    // 4. Insert Payment (if not credit)
    if (paymentMethod !== 'credit') {
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          invoice_id: invoiceId,
          customer_id: customerId,
          amount: total,
          method: paymentMethod as 'cash' | 'bank_transfer' | 'cheque',
          reference: invoiceNo,
          paid_at: new Date().toISOString(),
        });

      if (paymentError) {
        throw new Error(`Failed to create payment: ${paymentError.message}`);
      }
    }

    // 5. FIFO stock deduction per product
    for (const item of cart) {
      const piecesPerCarton = item.product.pieces_per_carton || 1;
      const totalPieces = item.quantityCartons * piecesPerCarton + item.quantityPieces;
      if (totalPieces > 0) {
        const { error: fifoError } = await supabase.rpc('deduct_stock_fifo', {
          p_product_id: item.product.id,
          p_units: totalPieces,
        });
        if (fifoError) {
          console.warn('FIFO deduction warning:', fifoError.message);
        }
      }
    }

    return invoiceId;
  } catch (error) {
    console.error('Checkout Error:', error);
    throw error;
  }
};
