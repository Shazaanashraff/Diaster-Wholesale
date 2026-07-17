import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
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

  // Logo lives in /public; BASE_URL keeps it resolvable in dev and the
  // Electron file:// build (vite base is './').
  const logoSrc = `${import.meta.env.BASE_URL}diastar-logo.png`;

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
    // `@page { size: 80mm auto }` isn't reliably honoured by Chromium's
    // print pipeline for continuous-roll widths — it's been observed
    // falling back to a fixed page length regardless, which is what
    // truncates long bills. Measure the actual rendered receipt height
    // (the on-screen preview and the print copy share the same width/
    // font stack) and set an explicit page height instead of "auto".
    const heightPx = printRef.current?.scrollHeight ?? 0;
    const heightMm = Math.ceil(heightPx * 25.4 / 96) + 15; // + buffer for the print copy's slightly larger font-size
    const pageSizeStyle = document.getElementById('pos-receipt-page-size');
    if (pageSizeStyle && heightMm > 15) {
      pageSizeStyle.textContent = `@media print { @page { size: 80mm ${heightMm}mm; margin: 0; } }`;
    }
    window.print();
  };

  // ─── Thermal layout (272px ≈ 72mm printable area of an 80mm printer) ───────
  const s: React.CSSProperties = {
    fontFamily: "'Courier New', Courier, monospace",
    background: 'white',
    color: '#000',
    width: 302,
    padding: '8px 5px',
    margin: '0 auto',
    fontSize: 12,
    lineHeight: '1.42',
    fontWeight: 700,
  };

  const divider = (dashed = false) => (
    <div style={{ borderTop: `1px ${dashed ? 'dashed' : 'solid'} black`, margin: '5px 0' }} />
  );

  const line = (left: string, right?: string, bold = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 900 : 700, fontSize: 12 }}>
      <span>{left}</span>
      {right !== undefined && <span style={{ textAlign: 'right' }}>{right}</span>}
    </div>
  );

  // Shared receipt markup: rendered once for the on-screen preview (inside
  // the success modal's scrollable 80vh box) and once more, unmodified,
  // in a portal appended directly to <body> for printing. The portal copy
  // stays in normal document flow with no ancestor overflow/position
  // constraints in its way, so the printed page can size itself to the
  // full receipt height (position: fixed/absolute here previously fought
  // the modal's own layout and either clipped or mispositioned long bills).
  const receiptBody = (
    <>
      {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <img src={logoSrc} alt="Diastar" style={{ width: '48mm', height: 'auto', display: 'block', margin: '0 auto 4px', filter: 'grayscale(100%) contrast(1.6) brightness(0.5)' }} />
          <div style={{ fontSize: 12 }}>No. 240, Dam Street, Colombo-12</div>
          <div style={{ fontSize: 12 }}>Tel: 0112324066  Mob: 0777495894</div>
        </div>

        {divider()}

        {/* Transaction meta */}
        <div style={{ fontSize: 12, marginBottom: 2 }}>
          {line('Customer', customerName || 'Walk-in')}
          {line(isWholesale ? 'Wholesale' : 'Retail')}
          {salespersonName && line('Sales Rep', salespersonName)}
          {line('Invoice No', invoiceNo)}
          {line('Date', `${dateStr}  ${timeStr}`)}
          {line('Inv Type', invType)}
        </div>

        {divider()}

        {/* Column header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 26px 50px 60px', gap: '0 2px', fontSize: 12, fontWeight: 900, borderBottom: '1px dashed black', paddingBottom: 3, marginBottom: 3 }}>
          <span>Item</span>
          <span style={{ textAlign: 'right' }}>Rate</span>
          <span style={{ textAlign: 'right' }}>Qty</span>
          <span style={{ textAlign: 'right' }}>Disc</span>
          <span style={{ textAlign: 'right' }}>Amt</span>
        </div>

        {/* Items */}
        {cartSnapshot.map((item, i) => {
          const ppc = item.product.pieces_per_carton || 1;
          const qty = item.quantityCartons * ppc + item.quantityPieces;
          const basePrice = Number(isWholesale ? item.product.wholesale_price : item.product.retail_price);
          const rate = Number(item.unitPrice ?? basePrice);
          const perUnitDisc = item.lineDiscount ?? 0;
          const lineDisc = perUnitDisc * qty + Math.max(0, (basePrice - rate) * qty);
          const amt = Math.max(0, rate - perUnitDisc) * qty;
          return (
            <div key={item.product.id} style={{ marginBottom: 5, fontSize: 12 }}>
              <div style={{ fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {i + 1}. {item.product.name.toUpperCase()}
              </div>
              {item.product.item_code && (
                <div style={{ fontSize: 10, color: '#000', marginBottom: 1 }}>{item.product.item_code}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 26px 50px 60px', gap: '0 2px' }}>
                <span />
                <span style={{ textAlign: 'right' }}>{fmt(rate)}</span>
                <span style={{ textAlign: 'right' }}>{qty}</span>
                <span style={{ textAlign: 'right' }}>{lineDisc > 0 ? fmt(lineDisc) : '-'}</span>
                <span style={{ textAlign: 'right', fontWeight: 900 }}>{fmt(amt)}</span>
              </div>
            </div>
          );
        })}

        {divider()}

        {/* Totals block */}
        <div style={{ fontSize: 12 }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 17, margin: '5px 0' }}>
          <span>TOTAL</span>
          <span>LKR {fmt(total)}</span>
        </div>

        {divider()}

        {/* Exchange policy */}
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 900, margin: '4px 0', lineHeight: 1.5 }}>
          <div>EXCHANGE WITHIN 3 DAYS ONLY</div>
          <div>BILL MUST BE PRODUCED</div>
          <div>NO CASH REFUND</div>
        </div>

        {divider(true)}

        {/* Warranty note */}
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 900, margin: '4px 0', lineHeight: 1.5 }}>
          <div>6 MONTHS WARRANTY APPLICABLE</div>
          <div>BILL MUST BE PRODUCED FOR</div>
          <div>WARRANTY CLAIM</div>
        </div>

        <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 14, margin: '5px 0' }}>
          THANK YOU COME AGAIN
        </div>

        {divider()}

        {/* Print footer */}
        <div style={{ fontSize: 11, color: '#000' }}>
          <div>Printed on {dateStr} At {timeStr}</div>
          <div>User Id  POS</div>
          {earnedPoints > 0 && (
            <div style={{ marginTop: 2 }}>Loyalty pts earned: +{earnedPoints}</div>
          )}
        </div>
    </>
  );

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          /* #pos-receipt-printable is a portal appended straight to <body>,
             so hiding everything else that's actually a direct body child
             (the app root) leaves only the receipt, in normal document
             flow, for the page to size itself around. */
          body > *:not(#pos-receipt-printable) { display: none !important; }
          #pos-receipt-printable {
            display: block !important;
            width: 80mm !important;
            margin: 0 auto !important;
            padding: 0 1mm !important;
            font-size: 13px !important;
            line-height: 1.42 !important;
          }
          #pos-receipt-printable, #pos-receipt-printable * {
            /* Force every line bold + pure black so thermal output is dark and legible */
            font-weight: 700 !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #pos-receipt-printable img {
            display: block !important;
            margin: 0 auto 4px !important;
            width: 48mm !important;
            height: auto !important;
            filter: grayscale(100%) contrast(1.6) brightness(0.5) !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>

      {/* Populated by handlePrint with an explicit height right before
          window.print() — overrides the "auto" fallback above, since auto
          isn't reliably respected and was truncating long bills. */}
      <style id="pos-receipt-page-size" />

      {/* Receipt preview on-screen */}
      <div ref={printRef} style={s}>
        {receiptBody}
      </div>

      {/* Print-only copy: portaled to <body>, hidden on screen, shown by
          the @media print rules above. Kept separate from the on-screen
          preview so print isolation doesn't have to fight the modal's own
          layout (see the comment on receiptBody). */}
      {createPortal(
        <div id="pos-receipt-printable" style={{ ...s, display: 'none' }}>
          {receiptBody}
        </div>,
        document.body
      )}

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
