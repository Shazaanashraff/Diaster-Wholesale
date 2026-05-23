import React, { useState } from 'react';
import type { SupplierReturn, SupplierReturnItem, Supplier } from '../types';

const fmt = (n: number) =>
  'LKR ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SETTLEMENT_LABELS: Record<string, string> = {
  payable: 'Additional Payable to Supplier',
  refund: 'Refund from Supplier',
  credit_note: 'Credit Note Issued',
  even: 'Even Exchange (No Settlement)',
};

interface SupplierReturnPrintProps {
  ret: SupplierReturn;
  items: SupplierReturnItem[];
  supplier?: Supplier;
  onClose?: () => void;
}

export const SupplierReturnPrint: React.FC<SupplierReturnPrintProps> = ({
  ret,
  items,
  supplier,
  onClose,
}) => {
  const [mode, setMode] = useState<'a4' | 'thermal'>('a4');
  const isA4 = mode === 'a4';

  const returnItems = items.filter(i => i.item_type === 'return');
  const replacementItems = items.filter(i => i.item_type === 'replacement');

  const handlePrint = () => {
    window.print();
    setTimeout(() => { if (onClose) onClose(); }, 500);
  };

  // ── Thermal layout ────────────────────────────────────────────────────────
  const ThermalView = () => (
    <div className="print-return-root" style={{ fontFamily: "'Courier New', monospace", background: 'white', color: 'black', padding: '12px 8px', width: 302, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', borderBottom: '1px solid black', paddingBottom: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 3 }}>DIASTAR</div>
        <div style={{ fontSize: 9 }}>{ret.return_type === 'exchange' ? 'SUPPLIER EXCHANGE NOTE' : 'SUPPLIER RETURN NOTE'}</div>
      </div>
      {[
        ['Ref', ret.reference],
        ['Date', new Date(ret.created_at).toLocaleDateString('en-LK')],
        ['Type', ret.return_type.toUpperCase()],
        ['Status', ret.status.toUpperCase()],
        ...(supplier ? [['Supplier', supplier.name]] : []),
        ...((ret.purchases as any)?.reference ? [['Linked PO', (ret.purchases as any).reference]] : []),
      ].map(([label, val]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
          <span style={{ color: '#555' }}>{label}:</span>
          <span style={{ fontWeight: 600, textAlign: 'right' }}>{val}</span>
        </div>
      ))}
      {returnItems.length > 0 && <>
        <div style={{ borderTop: '1px dashed black', margin: '6px 0', fontSize: 9, fontWeight: 700 }}>RETURNED:</div>
        {returnItems.map((item, i) => {
          const product = item.products as any;
          return (
            <div key={item.id} style={{ fontSize: 9, marginBottom: 3 }}>
              <div style={{ fontWeight: 700 }}>{i + 1}. {product?.name ?? item.product_id}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.quantity} × {fmt(item.unit_value_lkr)}</span>
                <span style={{ fontWeight: 700 }}>{fmt(item.quantity * item.unit_value_lkr)}</span>
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, borderTop: '1px dashed black', marginTop: 3, paddingTop: 3 }}>
          <span>Return Value</span><span>{fmt(ret.return_value_lkr)}</span>
        </div>
      </>}
      {replacementItems.length > 0 && <>
        <div style={{ borderTop: '1px dashed black', margin: '6px 0', fontSize: 9, fontWeight: 700 }}>REPLACEMENT:</div>
        {replacementItems.map((item, i) => {
          const product = item.products as any;
          return (
            <div key={item.id} style={{ fontSize: 9, marginBottom: 3 }}>
              <div style={{ fontWeight: 700 }}>{i + 1}. {product?.name ?? item.product_id}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.quantity} × {fmt(item.unit_value_lkr)}</span>
                <span style={{ fontWeight: 700 }}>{fmt(item.quantity * item.unit_value_lkr)}</span>
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, borderTop: '1px dashed black', marginTop: 3, paddingTop: 3 }}>
          <span>Replacement Value</span><span>{fmt(ret.replacement_value_lkr)}</span>
        </div>
      </>}
      {ret.return_type === 'exchange' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 11, borderTop: '1px solid black', marginTop: 6, paddingTop: 4 }}>
          <span>DIFFERENCE</span><span>{ret.difference_lkr >= 0 ? '+' : ''}{fmt(ret.difference_lkr)}</span>
        </div>
      )}
      {ret.settlement_type && (
        <div style={{ fontSize: 8, marginTop: 4, color: '#555' }}>
          Settlement: {SETTLEMENT_LABELS[ret.settlement_type] ?? ret.settlement_type}
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
          body > *:not(.print-return-root) { display: none !important; }
          .print-return-root { display: block !important; }
          .no-print { display: none !important; }
          @page {
            margin: ${isA4 ? '12mm' : '3mm'};
            size: ${isA4 ? 'A4' : '80mm auto'};
          }
        }
      `}</style>

      {!isA4 ? <ThermalView /> : <div className="print-return-root" style={{ fontFamily: "'Courier New', monospace", background: 'white', color: 'black', padding: 24, borderRadius: 12, maxWidth: 680, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: 12, marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: 4 }}>DIASTAR</h1>
          <p style={{ margin: '4px 0 0', fontSize: 11, letterSpacing: 1 }}>
            {ret.return_type === 'exchange' ? 'SUPPLIER EXCHANGE NOTE' : 'SUPPLIER RETURN NOTE'}
          </p>
        </div>

        {/* Meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 11 }}>
          <div>
            <p style={{ margin: '2px 0', fontWeight: 700 }}>Ref No: {ret.reference}</p>
            <p style={{ margin: '2px 0' }}>Date: {new Date(ret.created_at).toLocaleDateString('en-LK')}</p>
            <p style={{ margin: '2px 0' }}>Type: {ret.return_type.toUpperCase()}</p>
            <p style={{ margin: '2px 0' }}>Status: {ret.status.toUpperCase()}</p>
            {ret.purchases && <p style={{ margin: '2px 0' }}>Linked PO: {(ret.purchases as any).reference}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            {supplier && (
              <>
                <p style={{ margin: '2px 0', fontWeight: 700 }}>{supplier.name}</p>
                {supplier.country && <p style={{ margin: '2px 0' }}>{supplier.country}</p>}
                {supplier.phone && <p style={{ margin: '2px 0' }}>{supplier.phone}</p>}
                {supplier.contact_person && <p style={{ margin: '2px 0' }}>{supplier.contact_person}</p>}
              </>
            )}
          </div>
        </div>

        {/* Returned Items */}
        {returnItems.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 11, margin: '0 0 6px', borderBottom: '1px solid black', paddingBottom: 4 }}>
              Returned Items:
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ccc' }}>
                  <th style={{ padding: '3px 6px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '3px 6px', textAlign: 'left' }}>Product</th>
                  <th style={{ padding: '3px 6px', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '3px 6px', textAlign: 'right' }}>Unit Value</th>
                  <th style={{ padding: '3px 6px', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {returnItems.map((item, i) => {
                  const product = item.products as any;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px dashed #ddd' }}>
                      <td style={{ padding: '3px 6px' }}>{i + 1}</td>
                      <td style={{ padding: '3px 6px' }}>
                        {product?.name ?? item.product_id}
                        {product?.item_code && <span style={{ fontSize: 9, color: '#666' }}> [{product.item_code}]</span>}
                      </td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>{fmt(item.unit_value_lkr)}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>{fmt(item.quantity * item.unit_value_lkr)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid black', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '4px 6px' }}>Return Value</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right' }}>{fmt(ret.return_value_lkr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Replacement Items */}
        {replacementItems.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 11, margin: '0 0 6px', borderBottom: '1px solid black', paddingBottom: 4 }}>
              Replacement Items:
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ccc' }}>
                  <th style={{ padding: '3px 6px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '3px 6px', textAlign: 'left' }}>Product</th>
                  <th style={{ padding: '3px 6px', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '3px 6px', textAlign: 'right' }}>Unit Value</th>
                  <th style={{ padding: '3px 6px', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {replacementItems.map((item, i) => {
                  const product = item.products as any;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px dashed #ddd' }}>
                      <td style={{ padding: '3px 6px' }}>{i + 1}</td>
                      <td style={{ padding: '3px 6px' }}>
                        {product?.name ?? item.product_id}
                        {product?.item_code && <span style={{ fontSize: 9, color: '#666' }}> [{product.item_code}]</span>}
                      </td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>{fmt(item.unit_value_lkr)}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>{fmt(item.quantity * item.unit_value_lkr)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid black', fontWeight: 700 }}>
                  <td colSpan={4} style={{ padding: '4px 6px' }}>Replacement Value</td>
                  <td style={{ padding: '4px 6px', textAlign: 'right' }}>{fmt(ret.replacement_value_lkr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Summary */}
        <div style={{ borderTop: '2px solid black', paddingTop: 10, fontSize: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>Return Value</span>
            <span style={{ fontWeight: 700 }}>{fmt(ret.return_value_lkr)}</span>
          </div>
          {ret.return_type === 'exchange' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Replacement Value</span>
              <span style={{ fontWeight: 700 }}>{fmt(ret.replacement_value_lkr)}</span>
            </div>
          )}
          {ret.return_type === 'exchange' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900, borderTop: '1px solid black', marginTop: 6, paddingTop: 6 }}>
              <span>DIFFERENCE</span>
              <span>{ret.difference_lkr >= 0 ? '+' : ''}{fmt(ret.difference_lkr)}</span>
            </div>
          )}
        </div>

        {/* Settlement */}
        {ret.settlement_type && (
          <div style={{ fontSize: 11, padding: '8px', background: '#f5f5f5', borderRadius: 4, marginBottom: 12 }}>
            <strong>Settlement:</strong> {SETTLEMENT_LABELS[ret.settlement_type] ?? ret.settlement_type}
            {ret.settlement_notes && <p style={{ margin: '4px 0 0' }}>{ret.settlement_notes}</p>}
          </div>
        )}

        {/* Notes */}
        {ret.notes && (
          <div style={{ fontSize: 11, borderTop: '1px dashed black', paddingTop: 8, marginBottom: 12 }}>
            <strong>Notes:</strong> {ret.notes}
          </div>
        )}

        {/* Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32, fontSize: 11 }}>
          <div style={{ borderTop: '1px solid black', paddingTop: 6 }}>Prepared By</div>
          <div style={{ borderTop: '1px solid black', paddingTop: 6 }}>Supplier Representative</div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 10, borderTop: '1px solid black', marginTop: 16, paddingTop: 10, color: '#555' }}>
          Diastar ERP · Generated {new Date().toLocaleString('en-LK')}
        </div>

      </div>}

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
