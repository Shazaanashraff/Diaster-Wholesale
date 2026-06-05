import React, { useRef } from 'react';
import type { CartItem } from '../pages/POSPage';

export interface SaleReceiptData {
  invoiceNo: string;
  cartSnapshot: CartItem[];
  customerName: string;
  salespersonName: string;
  paymentSplits: { method: string; amount: number }[];
  subtotal: number;
  discount: number;
  redeemedPoints: number;
  total: number;
  isWholesale: boolean;
  earnedPoints: number;
  timestamp: Date;
}

interface POSSaleReceiptProps {
  data: SaleReceiptData;
  onClose?: () => void;
}

const fmt = (n: number) =>
  Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const POSSaleReceipt: React.FC<POSSaleReceiptProps> = ({ data, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const {
    invoiceNo, cartSnapshot, customerName, salespersonName,
    paymentSplits, subtotal, discount, redeemedPoints, total,
    isWholesale, earnedPoints, timestamp,
  } = data;

  const totalPaid = paymentSplits.reduce((s, p) => s + p.amount, 0);
  const balanceDue = Math.max(0, total - totalPaid);

  const totalQty = cartSnapshot.reduce((s, item) => {
    const ppc = item.product.pieces_per_carton || 1;
    return s + item.quantityCartons * ppc + item.quantityPieces;
  }, 0);

  const dateStr = timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeStr = timestamp.toLocaleTimeString('en-LK', { hour12: false });

  const primaryMethod = paymentSplits[0]?.method?.toUpperCase().replace('_', ' ') ?? 'CASH';
  const invType = paymentSplits.length > 1 ? 'SPLIT' : primaryMethod;

  const handlePrint = () => {
    window.print();
  };

  // ─── Thermal layout (302px ≈ 80mm) ────────────────────────────────────────
  const s: React.CSSProperties = {
    fontFamily: "'Courier New', Courier, monospace",
    background: 'white',
    color: 'black',
    width: 302,
    padding: '10px 8px',
    margin: '0 auto',
    fontSize: 10,
    lineHeight: '1.35',
  };

  const divider = (dashed = false) => (
    <div style={{ borderTop: `1px ${dashed ? 'dashed' : 'solid'} black`, margin: '5px 0' }} />
  );

  const line = (left: string, right?: string, bold = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 700 : 400, fontSize: 10 }}>
      <span>{left}</span>
      {right !== undefined && <span style={{ textAlign: 'right' }}>{right}</span>}
    </div>
  );

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #pos-receipt-printable, #pos-receipt-printable * { visibility: visible !important; }
          #pos-receipt-printable {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 80mm !important;
            padding: 3mm 2mm !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>

      {/* Receipt preview on-screen */}
      <div id="pos-receipt-printable" ref={printRef} style={s}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 2 }}>DIASTAR DAM 63</div>
          <div style={{ fontSize: 9 }}>63, Damstreet Col-12</div>
          <div style={{ fontSize: 9 }}>0112445597 | 0777171199</div>
        </div>

        {divider()}

        {/* Transaction meta */}
        <div style={{ fontSize: 9, marginBottom: 2 }}>
          {line('Customer', customerName || 'Walk-in')}
          {line('', isWholesale ? 'Wholesale' : 'Retail')}
          {salespersonName && line('Sales Rep', salespersonName)}
          {line('Invoice No', invoiceNo)}
          {line('Date', `${dateStr}  ${timeStr}`)}
          {line('Inv Type', invType)}
        </div>

        {divider()}

        {/* Column header */}
        <div style={{ display: 'grid', gridTemplateColumns: '14px 1fr 52px 40px 52px', gap: '0 2px', fontSize: 9, fontWeight: 700, borderBottom: '1px dashed black', paddingBottom: 3, marginBottom: 3 }}>
          <span>#</span>
          <span>Product</span>
          <span style={{ textAlign: 'right' }}>Rate</span>
          <span style={{ textAlign: 'right' }}>Qty</span>
          <span style={{ textAlign: 'right' }}>Amt</span>
        </div>

        {/* Items */}
        {cartSnapshot.map((item, i) => {
          const ppc = item.product.pieces_per_carton || 1;
          const qty = item.quantityCartons * ppc + item.quantityPieces;
          const rate = Number(item.unitPrice ?? (isWholesale ? item.product.wholesale_price : item.product.retail_price));
          const amt = rate * qty;
          return (
            <div key={item.product.id} style={{ marginBottom: 4, fontSize: 9 }}>
              <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {i + 1}. {item.product.name.toUpperCase()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '14px 1fr 52px 40px 52px', gap: '0 2px' }}>
                <span style={{ color: '#666' }}>{item.product.item_code || ''}</span>
                <span />
                <span style={{ textAlign: 'right' }}>{fmt(rate)}</span>
                <span style={{ textAlign: 'right' }}>{qty}</span>
                <span style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(amt)}</span>
              </div>
            </div>
          );
        })}

        {divider()}

        {/* Totals block */}
        <div style={{ fontSize: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>No. of Item  {cartSnapshot.length}</span>
            <span>Net Total  {fmt(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total Qty  {totalQty}</span>
            <span />
          </div>
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span />
              <span>Discount  -{fmt(discount)}</span>
            </div>
          )}
          {redeemedPoints > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span />
              <span>Points Redeemed  -{fmt(redeemedPoints)}</span>
            </div>
          )}

          {/* Payment lines */}
          {paymentSplits.map((sp, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span />
              <span>Payment {sp.method.charAt(0).toUpperCase() + sp.method.slice(1).replace('_', ' ')}  {fmt(sp.amount)}</span>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span />
            <span>Balance to be paid  {fmt(balanceDue)}</span>
          </div>
        </div>

        {divider()}

        {/* Grand total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 12, margin: '4px 0' }}>
          <span>TOTAL</span>
          <span>LKR {fmt(total)}</span>
        </div>

        {divider()}

        {/* Footer note */}
        <div style={{ textAlign: 'center', fontSize: 8, fontWeight: 700, margin: '4px 0', lineHeight: 1.5 }}>
          <div>6 MONTHS WARRANTY APPLICABLE</div>
          <div>BILL MUST BE PRODUCED FOR</div>
          <div>WARRANTY CLAIM</div>
        </div>

        <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 10, margin: '5px 0' }}>
          THANK YOU COME AGAIN
        </div>

        {divider()}

        {/* Print footer */}
        <div style={{ fontSize: 8, color: '#444' }}>
          <div>Printed on {dateStr} At {timeStr}</div>
          <div>User Id  POS</div>
          {earnedPoints > 0 && (
            <div style={{ marginTop: 2 }}>Loyalty pts earned: +{earnedPoints}</div>
          )}
        </div>
      </div>

      {/* Screen-only controls */}
      <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 12, maxWidth: 302, margin: '12px auto 0' }}>
        <button
          onClick={handlePrint}
          style={{ flex: 1, padding: '10px', background: 'black', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >
          Print Receipt
        </button>
        {onClose && (
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px', background: '#eee', color: '#333', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            Back to POS
          </button>
        )}
      </div>
    </>
  );
};
