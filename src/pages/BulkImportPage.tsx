import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TopBar } from '../components/TopBar';
import { Modal } from '../components/Modal';
import {
  FileUp, Box, CheckCircle2, History, Trash2, ArrowRight,
  Loader2, AlertTriangle, ArrowLeft, Download, RotateCcw, Package,
  Hash, FileSpreadsheet,
} from 'lucide-react';
import type { ImportRow, ImportSummary } from '../types/import';
import type { Shipment } from '../types';
import {
  parseExcelFile,
  classifyRows,
  confirmImport,
  getRollbackableShipments,
  rollbackShipment,
  downloadSampleTemplate,
} from '../services/importService';

type Step = 'upload' | 'preview' | 'done';

export const BulkImportPage: React.FC = () => {
  // ── State ──────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [shipmentCode, setShipmentCode] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rollback state
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackMessage, setRollbackMessage] = useState<string | null>(null);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load rollbackable shipments on mount ───────────────
  const loadShipments = useCallback(async () => {
    try {
      const data = await getRollbackableShipments();
      setShipments(data);
    } catch {
      // silently fail — non-critical
    }
  }, []);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  // ── File handling ──────────────────────────────────────
  const handleFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const parsed = await parseExcelFile(selectedFile);
      const classified = await classifyRows(parsed);
      setParsedRows(classified);
      setStep('preview');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse file';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
  };

  // ── Confirm import ────────────────────────────────────
  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const summary = await confirmImport(parsedRows, shipmentCode, supplierName);
      setImportSummary(summary);
      setStep('done');
      await loadShipments(); // refresh rollback list
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────
  const resetAll = () => {
    setFile(null);
    setShipmentCode('');
    setParsedRows([]);
    setImportSummary(null);
    setStep('upload');
    setLoading(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Rollback ──────────────────────────────────────────
  const handleRollback = async () => {
    setShowRollbackConfirm(false);
    setRollbackLoading(true);
    setRollbackMessage(null);
    setRollbackError(null);

    try {
      await rollbackShipment(selectedShipmentId);
      const rolledBack = shipments.find((s) => s.id === selectedShipmentId);
      setRollbackMessage(`Shipment "${rolledBack?.reference ?? selectedShipmentId}" rolled back successfully.`);
      setSelectedShipmentId('');
      await loadShipments();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rollback failed';
      setRollbackError(message);
    } finally {
      setRollbackLoading(false);
    }
  };

  // ── Computed counts ───────────────────────────────────
  const matchedCount = parsedRows.filter((r) => r.status === 'match_code' || r.status === 'match_name').length;
  const newCount = parsedRows.filter((r) => r.status === 'new').length;
  const errorCount = parsedRows.filter((r) => r.status === 'error').length;

  // ── Status badge renderer ─────────────────────────────
  const renderStatusBadge = (row: ImportRow) => {
    switch (row.status) {
      case 'match_code':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-50 text-green-600 border border-green-100">
            <CheckCircle2 size={12} /> Matched by Code
          </span>
        );
      case 'match_name':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100">
            <CheckCircle2 size={12} /> Matched by Name
          </span>
        );
      case 'new':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100">
            <Package size={12} /> New Product
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-100" title={row.error_message}>
            <AlertTriangle size={12} /> Error
          </span>
        );
    }
  };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div className="flex flex-col min-h-screen bg-accent">
      <TopBar />

      <div className="p-10 max-w-6xl mx-auto w-full">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-dark tracking-tight">Bulk Import</h1>
          <p className="text-gray-400 text-sm font-semibold mt-1">Upload inventory files to sync digital product inventory.</p>
        </div>

        {/* ── Global error banner ─────────────────────── */}
        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
            <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700">Something went wrong</p>
              <p className="text-xs text-red-500 mt-1 font-semibold">{error}</p>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            STEP: UPLOAD
        ════════════════════════════════════════════════ */}
        {step === 'upload' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-8">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload-input"
              />

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={handleBrowse}
                className="bg-white rounded-[3rem] border-4 border-dashed border-orange-50 p-16 flex flex-col items-center justify-center group hover:border-primary/20 hover:bg-orange-50/10 transition-all cursor-pointer shadow-sm"
                id="file-drop-zone"
              >
                {loading ? (
                  <>
                    <div className="w-24 h-24 bg-primary rounded-[2rem] flex items-center justify-center text-white mb-6 shadow-sm">
                      <Loader2 size={48} strokeWidth={2.5} className="animate-spin" />
                    </div>
                    <h3 className="text-xl font-bold text-dark">Processing file…</h3>
                    <p className="text-sm text-gray-400 font-semibold mt-2">Parsing and classifying rows</p>
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 bg-accent rounded-[2rem] flex items-center justify-center text-gray-300 group-hover:bg-primary group-hover:text-white transition-all duration-500 mb-6 shadow-sm border border-border/50">
                      <FileUp size={48} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-xl font-bold text-dark">
                      {file ? file.name : 'Drop your Excel file here'}
                    </h3>
                    <p className="text-sm text-gray-400 font-semibold mt-2">
                      Supports .xlsx, .xls, and .csv • Maximum file size: 10MB
                    </p>
                    <button
                      className="mt-10 px-10 py-4 bg-white border-2 border-border/50 rounded-2xl text-sm font-bold text-dark hover:border-primary/20 transition-all shadow-sm"
                      id="browse-files-btn"
                    >
                      BROWSE FILES
                    </button>
                  </>
                )}
              </div>

              {/* Shipment information */}
              <div className="bg-white rounded-[2.5rem] border border-border/50 p-10 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-dark">Shipment Information</h3>
                  <Box size={22} className="text-primary" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Shipment Tracking ID</label>
                    <input
                      type="text"
                      placeholder="e.g. TRK-BIJ-2024"
                      value={shipmentCode}
                      onChange={(e) => setShipmentCode(e.target.value)}
                      className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
                      id="shipment-code-input"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Supplier Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Digital Distro Ltd."
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all"
                      id="supplier-name-input"
                    />
                  </div>
                </div>
              </div>

              <button
                disabled={!file || loading}
                onClick={() => file && handleFile(file)}
                className="w-full py-5 bg-primary text-white rounded-3xl font-bold shadow-2xl shadow-orange-100 flex items-center justify-center gap-4 hover:bg-orange-600 transition-all active:scale-[0.98] group tracking-widest text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                id="start-import-btn"
              >
                START IMPORT PROCESSING <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Right sidebar */}
            <div className="space-y-8">
              <div className="bg-white rounded-[2.5rem] border border-border/50 p-8 shadow-sm">
                <h3 className="font-bold text-dark mb-6 flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-primary" strokeWidth={2.5} /> Quality Check
                </h3>
                <ul className="space-y-6">
                  {[
                    "Ensure product IDs exactly match current catalog.",
                    "Price values must be up to 2 decimal places.",
                    "Keys must be unique and non-duplicate."
                  ].map((note, idx) => (
                    <li key={idx} className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-orange-50 text-primary text-[11px] flex-shrink-0 flex items-center justify-center font-bold border border-orange-100">{idx + 1}</div>
                      <p className="text-xs text-gray-400 leading-relaxed font-semibold">{note}</p>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={downloadSampleTemplate}
                  className="w-full mt-10 py-4 rounded-2xl border-2 border-border/50 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-dark hover:border-primary/20 transition-all flex items-center justify-center gap-2"
                  id="download-template-btn"
                >
                  <Download size={14} /> Download Template
                </button>
              </div>

              <div className="bg-orange-50/30 rounded-[2.5rem] border border-orange-100/50 p-8">
                <h3 className="font-bold text-dark mb-6 flex items-center gap-3">
                  <History size={20} className="text-primary" /> Last 48 Hours
                </h3>
                <div className="space-y-4">
                  {shipments.length === 0 ? (
                    <p className="text-xs text-gray-400 font-semibold text-center py-4">No recent imports</p>
                  ) : (
                    shipments.slice(0, 5).map((s) => (
                      <div key={s.id} className="bg-white p-4 rounded-2xl border border-border/50 flex items-center justify-between group shadow-sm">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-dark truncate">{s.reference}</p>
                          <p className="text-[10px] text-gray-400 font-bold mt-1">
                            {new Date(s.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedShipmentId(s.id);
                            setShowRollbackConfirm(true);
                          }}
                          className="w-8 h-8 rounded-xl bg-accent text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center"
                          id={`rollback-quick-${s.id}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            STEP: PREVIEW
        ════════════════════════════════════════════════ */}
        {step === 'preview' && (
          <div className="space-y-8">
            {/* Summary counts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-border/50 p-5 shadow-sm text-center">
                <p className="text-2xl font-bold text-dark">{parsedRows.length}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total Rows</p>
              </div>
              <div className="bg-green-50 rounded-2xl border border-green-100 p-5 shadow-sm text-center">
                <p className="text-2xl font-bold text-green-600">{matchedCount}</p>
                <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mt-1">Matched</p>
              </div>
              <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5 shadow-sm text-center">
                <p className="text-2xl font-bold text-amber-600">{newCount}</p>
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-1">New Products</p>
              </div>
              <div className="bg-red-50 rounded-2xl border border-red-100 p-5 shadow-sm text-center">
                <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-1">Errors</p>
              </div>
            </div>

            {/* Error warning */}
            {errorCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
                <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
                <p className="text-sm font-semibold text-amber-700">
                  {errorCount} row{errorCount > 1 ? 's have' : ' has'} errors and will be skipped during import.
                </p>
              </div>
            )}

            {/* Preview table */}
            <div className="bg-white rounded-[2.5rem] border border-border/50 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-border/50 flex items-center justify-between">
                <h3 className="text-lg font-bold text-dark flex items-center gap-3">
                  <FileSpreadsheet size={20} className="text-primary" /> Import Preview
                </h3>
                <p className="text-xs font-semibold text-gray-400">{file?.name}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full" id="preview-table">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest p-5 pl-8">#</th>
                      <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest p-5">Item Code</th>
                      <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest p-5">Name</th>
                      <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest p-5">Model</th>
                      <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest p-5">Cartons</th>
                      <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest p-5">Units/Carton</th>
                      <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest p-5 pr-8">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, idx) => (
                      <React.Fragment key={idx}>
                        <tr className={`border-b border-border/30 hover:bg-accent/50 transition-colors ${row.status === 'error' ? 'bg-red-50/30' : ''}`}>
                          <td className="p-5 pl-8 text-xs font-bold text-gray-300">{idx + 1}</td>
                          <td className="p-5 text-xs font-semibold text-dark font-mono">{row.item_code || '—'}</td>
                          <td className="p-5 text-xs font-semibold text-dark max-w-[200px] truncate">{row.name}</td>
                          <td className="p-5 text-xs font-semibold text-gray-500">{row.model}</td>
                          <td className="p-5 text-xs font-bold text-dark text-right">{row.cartons}</td>
                          <td className="p-5 text-xs font-semibold text-gray-500 text-right">{row.units_per_carton}</td>
                          <td className="p-5 pr-8">{renderStatusBadge(row)}</td>
                        </tr>
                        {/* Show error message as a sub-row */}
                        {row.status === 'error' && row.error_message && (
                          <tr className="bg-red-50/30">
                            <td />
                            <td colSpan={6} className="px-5 pb-4 pt-0">
                              <p className="text-[11px] font-semibold text-red-500 flex items-center gap-2">
                                <AlertTriangle size={11} /> {row.error_message}
                              </p>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-4">
              <button
                onClick={resetAll}
                className="px-8 py-5 bg-white border-2 border-border/50 rounded-3xl text-sm font-bold text-dark hover:border-primary/20 transition-all shadow-sm flex items-center gap-3"
                id="back-btn"
              >
                <ArrowLeft size={18} /> BACK
              </button>
              <button
                onClick={handleConfirm}
                disabled={!shipmentCode.trim() || loading}
                className="flex-1 py-5 bg-primary text-white rounded-3xl font-bold shadow-2xl shadow-orange-100 flex items-center justify-center gap-4 hover:bg-orange-600 transition-all active:scale-[0.98] group tracking-widest text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                id="confirm-import-btn"
              >
                {loading ? (
                  <>
                    <Loader2 size={22} className="animate-spin" /> IMPORTING…
                  </>
                ) : (
                  <>
                    CONFIRM IMPORT <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
            {!shipmentCode.trim() && (
              <p className="text-xs font-semibold text-amber-500 text-center -mt-4">
                Please enter a Shipment Tracking ID before confirming.
              </p>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            STEP: DONE
        ════════════════════════════════════════════════ */}
        {step === 'done' && importSummary && (
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Success header */}
            <div className="bg-white rounded-[2.5rem] border border-border/50 p-12 shadow-sm text-center">
              <div className="w-20 h-20 bg-green-50 rounded-[1.5rem] flex items-center justify-center text-green-500 mx-auto mb-6 border border-green-100">
                <CheckCircle2 size={44} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-bold text-dark">Import Complete!</h2>
              <p className="text-sm text-gray-400 font-semibold mt-2">
                Shipment <span className="text-dark font-bold">{shipmentCode}</span> has been processed successfully.
              </p>
            </div>

            {/* Summary grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-border/50 p-5 shadow-sm text-center">
                <Hash size={16} className="text-gray-300 mx-auto mb-2" />
                <p className="text-2xl font-bold text-dark">{importSummary.total}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total Rows</p>
              </div>
              <div className="bg-green-50 rounded-2xl border border-green-100 p-5 shadow-sm text-center">
                <CheckCircle2 size={16} className="text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{importSummary.matched_by_code + importSummary.matched_by_name}</p>
                <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mt-1">Matched</p>
              </div>
              <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5 shadow-sm text-center">
                <Package size={16} className="text-amber-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-amber-600">{importSummary.new_products}</p>
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-1">New Products</p>
              </div>
              <div className="bg-red-50 rounded-2xl border border-red-100 p-5 shadow-sm text-center">
                <AlertTriangle size={16} className="text-red-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-600">{importSummary.errors}</p>
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-1">Skipped</p>
              </div>
            </div>

            {/* Import another */}
            <button
              onClick={resetAll}
              className="w-full py-5 bg-primary text-white rounded-3xl font-bold shadow-2xl shadow-orange-100 flex items-center justify-center gap-4 hover:bg-orange-600 transition-all active:scale-[0.98] group tracking-widest text-sm"
              id="import-another-btn"
            >
              IMPORT ANOTHER <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            ROLLBACK SECTION (always visible)
        ════════════════════════════════════════════════ */}
        <div className="mt-16 bg-white rounded-[2.5rem] border border-border/50 p-10 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-dark flex items-center gap-3">
              <RotateCcw size={20} className="text-primary" /> Rollback Shipment
            </h3>
            <p className="text-xs text-gray-400 font-semibold">Undo a recent import if stock hasn&apos;t been sold</p>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-end gap-4">
            <div className="flex-1 space-y-3">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">Select Shipment</label>
              <select
                value={selectedShipmentId}
                onChange={(e) => {
                  setSelectedShipmentId(e.target.value);
                  setRollbackMessage(null);
                  setRollbackError(null);
                }}
                className="w-full bg-accent border-2 border-transparent focus:border-primary/20 rounded-2xl py-4 px-6 text-sm font-semibold outline-none transition-all appearance-none cursor-pointer"
                id="rollback-select"
              >
                <option value="">Choose a shipment to rollback…</option>
                {shipments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.reference} — {new Date(s.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowRollbackConfirm(true)}
              disabled={!selectedShipmentId || rollbackLoading}
              className="px-8 py-4 bg-red-500 text-white rounded-2xl font-bold text-sm hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 min-w-[160px]"
              id="rollback-btn"
            >
              {rollbackLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Trash2 size={16} /> ROLLBACK
                </>
              )}
            </button>
          </div>

          {/* Rollback success/error messages */}
          {rollbackMessage && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-green-700">{rollbackMessage}</p>
            </div>
          )}
          {rollbackError && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-red-700">{rollbackError}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Rollback confirmation modal ──────────────────── */}
      <Modal
        isOpen={showRollbackConfirm}
        onClose={() => setShowRollbackConfirm(false)}
        title="Confirm Rollback"
      >
        <div className="space-y-6">
          <p className="text-sm text-gray-500 font-semibold">
            This will delete all stock batches associated with this shipment. This action cannot be undone.
          </p>
          <p className="text-sm font-bold text-dark">
            Shipment: {shipments.find((s) => s.id === selectedShipmentId)?.reference ?? '—'}
          </p>
          <div className="flex gap-4 pt-2">
            <button
              onClick={() => setShowRollbackConfirm(false)}
              className="flex-1 py-4 bg-accent rounded-2xl text-sm font-bold text-dark hover:bg-gray-100 transition-all"
              id="rollback-cancel-btn"
            >
              Cancel
            </button>
            <button
              onClick={handleRollback}
              className="flex-1 py-4 bg-red-500 text-white rounded-2xl text-sm font-bold hover:bg-red-600 transition-all active:scale-[0.98]"
              id="rollback-confirm-btn"
            >
              Yes, Rollback
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
