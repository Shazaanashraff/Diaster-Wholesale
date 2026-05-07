import React, { useState } from 'react';
import type { Purchase, PurchaseItem, PurchaseCost, PurchaseReceive, Supplier, Location, SupplierPayment } from '../types';

const fmt = (n: number) =>
  'LKR ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtRmb = (n: number) =>
  '¥ ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface PurchaseBillPrintProps {
  purchase: Purchase;
  items: PurchaseItem[];
  costs: PurchaseCost[];
  received: PurchaseReceive[];
  supplier?: Supplier;
  location?: Location;
  payments?: SupplierPayment[];
  onClose?: () => void;
}

export const PurchaseBillPrint: React.FC<PurchaseBillPrintProps> = ({
  purchase, items, costs, received, supplier, location, payments, onClose,
}) => {
  const [mode, setMode] = useState<'a4' | 'thermal'>('a4');

  const totalCosts = costs.reduce((s, c) => s + Number(c.amount_lkr), 0);
  const totalSellable = received.reduce((s, r) => s + Math.max(0, r.received_units - r.damaged_units), 0);
  const estimatedCPU = totalSellable > 0 ? (Number(purchase.total_lkr) + totalCosts) / totalSellable : 0;
  const grandTotal = Number(purchase.total_lkr) + totalCosts - Number(purchase.discount_amount ?? 0);
  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const handlePrint = () => {
    window.print();
    setTimeout(() => { if (onClose) onClose(); }, 500);
  };

  const isA4 = mode === 'a4';

  // ── Shared data sections ──────────────────────────────────────────────────

  const metaRows = [
    ['Bill No', purchase.reference],
    ['Date', new Date(purchase.created_at).toLocaleDateString('en-LK')],
    ['Status', purchase.status.toUpperCase()],
    ...(purchase.rep_name ? [['Purchase Rep', purchase.rep_name]] : []),
    ...(supplier ? [['Supplier', supplier.name], ...(supplier.country ? [['Country', supplier.country]] : [])] : []),
    ...(location ? [['Destination', location.name]] : []),
    [`Rate`, `1 RMB = ${Number(purchase.exchange_rate).toFixed(4)} LKR`],
  ];

  // ── A4 Layout ─────────────────────────────────────────────────────────────
  const A4Bill = () => (
    <div className="print-bill-root" style={{ fontFamily: "'Courier New', monospace", background: 'white', color: 'black', padding: 24, borderRadius: 12, maxWidth: 680, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: 4 }}>DIASTAR</h1>
        <p style={{ margin: '4px 0 0', fontSize: 11, letterSpacing: 1 }}>PURCHASE ORDER / BILL</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 11 }}>
        <div>
          <p style={{ margin: '2px 0', fontWeight: 700 }}>Bill No: {purchase.reference}</p>
          <p style={{ margin: '2px 0' }}>Date: {new Date(purchase.created_at).toLocaleDateString('en-LK')}</p>
          <p style={{ margin: '2px 0' }}>Status: {purchase.status.toUpperCase()}</p>
          {purchase.rep_name && <p style={{ margin: '2px 0' }}>Purchase Rep: {purchase.rep_name}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          {supplier && <>
            <p style={{ margin: '2px 0', fontWeight: 700 }}>{supplier.name}</p>
            {supplier.country && <p style={{ margin: '2px 0' }}>{supplier.country}</p>}
            {supplier.phone && <p style={{ margin: '2px 0' }}>{supplier.phone}</p>}
            {supplier.contact_person && <p style={{ margin: '2px 0' }}>{supplier.contact_person}</p>}
          </>}
          {location && <p style={{ margin: '2px 0' }}>Destination: {location.name}</p>}
        </div>
      </div>

      <div style={{ fontSize: 11, marginBottom: 12, padding: '6px 8px', background: '#f5f5f5', borderRadius: 4 }}>
        Exchange Rate: 1 RMB = {Number(purchase.exchange_rate).toFixed(4)} LKR
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid black', borderTop: '1px solid black' }}>
            {['#', 'Product', 'Qty', 'Price (RMB)', 'Total (LKR)'].map(h => (
              <th key={h} style={{ padding: '4px 6px', textAlign: h === '#' || h === 'Qty' || h === 'Price (RMB)' || h === 'Total (LKR)' ? 'right' : 'left', fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const product = item.products as any;
            const lineLkr = item.quantity_units * item.unit_price_rmb * Number(purchase.exchange_rate);
            return (
              <tr key={item.id} style={{ borderBottom: '1px dashed #ccc' }}>
                <td style={{ padding: '4px 6px', textAlign: 'right' }}>{i + 1}</td>
                <td style={{ padding: '4px 6px' }}>
                  {product?.name ?? item.product_id}
                  {product?.item_code && <span style={{ fontSize: 9, color: '#666' }}> [{product.item_code}]</span>}
                </td>
                <td style={{ padding: '4px 6px', textAlign: 'right' }}>{item.quantity_units.toLocaleString()}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right' }}>{fmtRmb(item.unit_price_rmb)}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right' }}>{fmt(lineLkr)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '1px solid black', fontWeight: 700 }}>
            <td colSpan={3} style={{ padding: '4px 6px' }}>SUBTOTAL</td>
            <td style={{ padding: '4px 6px', textAlign: 'right' }}>{fmtRmb(purchase.total_rmb)}</td>
            <td style={{ padding: '4px 6px', textAlign: 'right' }}>{fmt(purchase.total_lkr)}</td>
          </tr>
        </tfoot>
      </table>

      {costs.length > 0 && (
        <div style={{ marginBottom: 12, fontSize: 11 }}>
          <p style={{ fontWeight: 700, margin: '0 0 4px' }}>Additional Costs:</p>
          {costs.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ textTransform: 'capitalize' }}>{c.cost_type}{c.notes ? ` — ${c.notes}` : ''}</span>
              <span>{fmt(c.amount_lkr)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed black', marginTop: 4, paddingTop: 4, fontWeight: 700 }}>
            <span>Total Add. Costs</span><span>{fmt(totalCosts)}</span>
          </div>
        </div>
      )}

      <div style={{ borderTop: '2px solid black', paddingTop: 10, fontSize: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>Purchase Total (LKR)</span><span style={{ fontWeight: 700 }}>{fmt(purchase.total_lkr)}</span>
        </div>
        {costs.length > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>Additional Costs</span><span style={{ fontWeight: 700 }}>{fmt(totalCosts)}</span>
        </div>}
        {(purchase.discount_amount ?? 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span>Discount</span><span style={{ fontWeight: 700 }}>-{fmt(purchase.discount_amount ?? 0)}</span>
        </div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900, borderTop: '1px solid black', marginTop: 6, paddingTop: 6 }}>
          <span>GRAND TOTAL</span><span>{fmt(grandTotal)}</span>
        </div>
      </div>

      {received.length > 0 && (
        <div style={{ fontSize: 11, marginBottom: 12 }}>
          <p style={{ fontWeight: 700, margin: '0 0 4px', borderBottom: '1px dashed black', paddingBottom: 4 }}>Receive Summary:</p>
          {received.map(r => {
            const product = r.products as any;
            return (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>{product?.name ?? r.product_id}</span>
                <span>Ord: {r.ordered_units} | Rcvd: {r.received_units} | Dmg: {r.damaged_units}</span>
              </div>
            );
          })}
          {totalSellable > 0 && estimatedCPU > 0 && (
            <div style={{ marginTop: 6, fontWeight: 700 }}>Sellable: {totalSellable} | Est. CPU: {fmt(estimatedCPU)}</div>
          )}
        </div>
      )}

      {payments && payments.length > 0 && (
        <div style={{ fontSize: 11, marginBottom: 12 }}>
          <p style={{ fontWeight: 700, margin: '0 0 4px', borderBottom: '1px dashed black', paddingBottom: 4 }}>Payment Breakdown:</p>
          {payments.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span style={{ textTransform: 'capitalize' }}>
                {p.method.replace('_', ' ')}{p.cheque_number ? ` (Chq: ${p.cheque_number}, ${p.bank_name})` : ''}
                {' — '}{new Date(p.paid_at).toLocaleDateString('en-LK')}
              </span>
              <span style={{ fontWeight: 600 }}>{fmt(p.amount)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed black', marginTop: 4, paddingTop: 4, fontWeight: 700 }}>
            <span>Total Paid</span><span>{fmt(totalPaid)}</span>
          </div>
        </div>
      )}

      {purchase.notes && (
        <div style={{ fontSize: 11, borderTop: '1px dashed black', paddingTop: 8, marginBottom: 12 }}>
          <strong>Notes:</strong> {purchase.notes}
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 10, borderTop: '1px solid black', paddingTop: 10, color: '#555' }}>
        Diastar ERP · Generated {new Date().toLocaleString('en-LK')}
      </div>
    </div>
  );

  // ── Thermal Layout (80mm ≈ 302px) ────────────────────────────────────────
  const ThermalBill = () => (
    <div className="print-bill-root" style={{ fontFamily: "'Courier New', monospace", background: 'white', color: 'black', padding: '12px 8px', width: 302, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', borderBottom: '1px solid black', paddingBottom: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 3 }}>DIASTAR</div>
        <div style={{ fontSize: 9 }}>PURCHASE ORDER / BILL</div>
      </div>

      {metaRows.map(([label, val]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
          <span style={{ color: '#555' }}>{label}:</span>
          <span style={{ fontWeight: 600, maxWidth: 180, textAlign: 'right', wordBreak: 'break-all' }}>{val}</span>
        </div>
      ))}

      <div style={{ borderTop: '1px dashed black', margin: '6px 0' }} />

      {items.map((item, i) => {
        const product = item.products as any;
        const lineLkr = item.quantity_units * item.unit_price_rmb * Number(purchase.exchange_rate);
        return (
          <div key={item.id} style={{ marginBottom: 4, fontSize: 9 }}>
            <div style={{ fontWeight: 700 }}>{i + 1}. {product?.name ?? item.product_id}</div>
            {product?.item_code && <div style={{ color: '#555' }}>[{product.item_code}]</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{item.quantity_units} units × {fmtRmb(item.unit_price_rmb)}</span>
              <span style={{ fontWeight: 700 }}>{fmt(lineLkr)}</span>
            </div>
          </div>
        );
      })}

      <div style={{ borderTop: '1px dashed black', margin: '6px 0' }} />

      {[
        ['Subtotal', fmt(purchase.total_lkr)],
        ...(totalCosts > 0 ? [['Add. Costs', fmt(totalCosts)]] : []),
        ...((purchase.discount_amount ?? 0) > 0 ? [['Discount', `-${fmt(purchase.discount_amount ?? 0)}`]] : []),
      ].map(([label, val]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
          <span>{label}</span><span>{val}</span>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 12, borderTop: '1px solid black', marginTop: 4, paddingTop: 4 }}>
        <span>TOTAL</span><span>{fmt(grandTotal)}</span>
      </div>

      {payments && payments.length > 0 && <>
        <div style={{ borderTop: '1px dashed black', margin: '6px 0' }} />
        <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 3 }}>PAYMENTS:</div>
        {payments.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
            <span style={{ textTransform: 'capitalize' }}>{p.method.replace('_', ' ')}</span>
            <span>{fmt(p.amount)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, borderTop: '1px dashed black', marginTop: 3, paddingTop: 3 }}>
          <span>Paid</span><span>{fmt(totalPaid)}</span>
        </div>
        {grandTotal - totalPaid > 0.01 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: '#c00' }}>
            <span>Balance Due</span><span>{fmt(grandTotal - totalPaid)}</span>
          </div>
        )}
      </>}

      {purchase.notes && (
        <div style={{ fontSize: 8, borderTop: '1px dashed black', marginTop: 6, paddingTop: 4, color: '#555' }}>
          Note: {purchase.notes}
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 8, borderTop: '1px solid black', marginTop: 8, paddingTop: 6, color: '#555' }}>
        Diastar ERP · {new Date().toLocaleString('en-LK')}
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          body > *:not(.print-bill-root) { display: none !important; }
          .print-bill-root { display: block !important; }
          .no-print { display: none !important; }
          @page {
            margin: ${isA4 ? '12mm' : '3mm'};
            size: ${isA4 ? 'A4' : '80mm auto'};
          }
        }
      `}</style>

      {isA4 ? <A4Bill /> : <ThermalBill />}

      {/* Screen-only controls */}
      <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 16, maxWidth: isA4 ? 680 : 302, margin: '16px auto 0' }}>
        <button
          onClick={() => setMode(isA4 ? 'thermal' : 'a4')}
          style={{ flex: 1, padding: '10px', background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >
          {isA4 ? '🧾 Switch to Thermal (80mm)' : '📄 Switch to A4'}
        </button>
        <button
          onClick={handlePrint}
          style={{ flex: 1, padding: '10px', background: 'black', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >
          🖨️ Print
        </button>
        {onClose && (
          <button
            onClick={onClose}
            style={{ padding: '10px 16px', background: '#eee', color: '#333', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            Close
          </button>
        )}
      </div>
    </>
  );
};
