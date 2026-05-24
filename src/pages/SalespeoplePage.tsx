import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PencilLine,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  UserCheck,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  addSalesperson,
  getAllSalespeople,
  getSalespersonInvoices,
  renameSalesperson,
  setSalespersonActive,
  type Salesperson,
  type SalespersonInvoice,
} from '../services/salespersonService';

const fmtCurrency = (value: number) =>
  `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (value: string) => new Date(value).toLocaleDateString();

const getCustomerName = (customers: SalespersonInvoice['customers']) => {
  if (Array.isArray(customers)) return customers[0]?.name ?? '—';
  return customers?.name ?? '—';
};

export const SalespeoplePage: React.FC = () => {
  const [people, setPeople] = useState<Salesperson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<SalespersonInvoice[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createName, setCreateName] = useState('');
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [error, setError] = useState('');

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    window.setTimeout(() => setToast(null), 2500);
  };

  async function loadPeople() {
    setLoading(true);
    try {
      const fetched = await getAllSalespeople();
      setPeople(fetched);
      setSelectedId((current) => current || fetched[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load salespeople');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeople();
  }, []);

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedId) ?? null,
    [people, selectedId]
  );

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter((person) =>
      person.name.toLowerCase().includes(q) ||
      (person.active ? 'active' : 'inactive').includes(q)
    );
  }, [people, search]);

  const summary = useMemo(() => {
    const count = selectedInvoices.length;
    const revenue = selectedInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const paid = selectedInvoices.filter((invoice) => invoice.payment_status === 'paid').length;
    const partial = selectedInvoices.filter((invoice) => invoice.payment_status === 'partial').length;
    const unpaid = selectedInvoices.filter((invoice) => invoice.payment_status === 'unpaid').length;
    const lastSale = selectedInvoices[0]?.created_at ?? null;

    return { count, revenue, paid, partial, unpaid, lastSale };
  }, [selectedInvoices]);

  useEffect(() => {
    if (!selectedPerson) {
      setSelectedInvoices([]);
      setEditingName('');
      return;
    }

    setEditingName(selectedPerson.name);
    let active = true;

    async function loadInvoices() {
      setDetailLoading(true);
      setError('');
      try {
        const invoices = await getSalespersonInvoices(selectedPerson.id);
        if (!active) return;
        setSelectedInvoices(invoices);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Failed to load salesperson sales');
      } finally {
        if (active) setDetailLoading(false);
      }
    }

    loadInvoices();
    return () => {
      active = false;
    };
  }, [selectedPerson]);

  async function handleCreate() {
    const trimmed = createName.trim();
    if (!trimmed) {
      setError('Enter a salesperson name');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const created = await addSalesperson(trimmed);
      setPeople((prev) => [created, ...prev]);
      setCreateName('');
      setSelectedId(created.id);
      showToast('Salesperson created');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create salesperson');
    } finally {
      setSaving(false);
    }
  }

  async function handleRename() {
    if (!selectedPerson) return;
    const trimmed = editingName.trim();
    if (!trimmed) {
      setError('Salesperson name cannot be empty');
      return;
    }
    if (trimmed === selectedPerson.name) return;

    setDetailSaving(true);
    setError('');
    try {
      const updated = await renameSalesperson(selectedPerson.id, trimmed);
      setPeople((prev) => prev.map((person) => (person.id === updated.id ? updated : person)));
      showToast('Salesperson renamed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename salesperson');
    } finally {
      setDetailSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!selectedPerson) return;

    setDetailSaving(true);
    setError('');
    try {
      const updated = await setSalespersonActive(selectedPerson.id, !selectedPerson.active);
      setPeople((prev) => prev.map((person) => (person.id === updated.id ? updated : person)));
      showToast(updated.active ? 'Salesperson reactivated' : 'Salesperson deactivated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update salesperson');
    } finally {
      setDetailSaving(false);
    }
  }

  return (
    <div className="pos-standard-page p-6 space-y-6 relative">
      {toast && (
        <div
          className={cn(
            'fixed top-5 right-5 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-xl',
            toast.ok
              ? 'bg-green-500/15 border border-green-500/30 text-green-400'
              : 'bg-red-500/15 border border-red-500/30 text-red-400'
          )}
          style={{ animation: 'posFadeIn 180ms ease' }}
        >
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Salespeople</h1>
          <p className="text-xs text-gray-500 mt-0.5">Create, rename, activate, and review salesperson sales history</p>
        </div>
        <button
          type="button"
          onClick={loadPeople}
          className="p-2 bg-[#1d222a] border border-[#2b313a] text-gray-400 rounded-xl hover:text-white transition-all"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">
        <div className="space-y-5">
          <div className="bg-[#171c23] border border-[#2b313a] rounded-3xl p-5 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Create Salesperson</p>
              <h2 className="text-sm font-bold text-white mt-1">Add a new salesperson</h2>
            </div>
            <div className="space-y-2">
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Enter salesperson name"
                className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Create Salesperson
              </button>
            </div>
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search salespeople…"
              className="w-full bg-[#1d222a] border border-[#2b313a] text-gray-300 text-xs rounded-xl py-2.5 pl-9 pr-4 focus:outline-none focus:border-primary/40"
            />
          </div>

          <div className="bg-[#171c23] border border-[#2b313a] rounded-3xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2b313a] flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Salespeople List</p>
                <p className="text-xs text-gray-500 mt-0.5">Click a salesperson to view their sales</p>
              </div>
              <span className="text-[10px] font-bold text-gray-500">{filteredPeople.length}</span>
            </div>
            <div className="max-h-[640px] overflow-y-auto custom-scrollbar divide-y divide-[#2b313a]">
              {loading ? (
                <div className="px-5 py-10 text-center">
                  <Loader2 size={18} className="animate-spin text-primary mx-auto" />
                </div>
              ) : filteredPeople.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-gray-500">No salespeople found.</div>
              ) : (
                filteredPeople.map((person) => {
                  const isSelected = person.id === selectedId;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => setSelectedId(person.id)}
                      className={cn(
                        'w-full text-left px-5 py-4 transition-colors',
                        isSelected ? 'bg-primary/10' : 'hover:bg-[#1d222a]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <UserCheck size={14} className={person.active ? 'text-emerald-400' : 'text-gray-600'} />
                            <p className={cn('text-sm font-semibold truncate', person.active ? 'text-white' : 'text-gray-500')}>{person.name}</p>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">Created {person.created_at ? fmtDate(person.created_at) : '—'}</p>
                        </div>
                        <span className={cn('text-[9px] font-bold uppercase px-2 py-0.5 rounded-md tracking-wide', person.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500')}>
                          {person.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#171c23] border border-[#2b313a] rounded-3xl overflow-hidden min-h-[740px] flex flex-col">
          {error && (
            <div className="m-5 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              <AlertCircle size={12} /> {error}
            </div>
          )}

          {!selectedPerson ? (
            <div className="flex-1 flex items-center justify-center px-6 py-16 text-center">
              <div className="max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mx-auto flex items-center justify-center text-primary">
                  <UserCheck size={24} />
                </div>
                <h2 className="text-lg font-bold text-white mt-4">No salesperson selected</h2>
                <p className="text-sm text-gray-500 mt-2">Pick a salesperson on the left to see their details and the invoices they handled.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-[#2b313a]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Salesperson Details</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                        <UserCheck size={20} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">{selectedPerson.name}</h2>
                        <p className="text-xs text-gray-500 mt-1">Created {selectedPerson.created_at ? fmtDate(selectedPerson.created_at) : '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-[10px] font-bold uppercase px-2.5 py-1 rounded-md tracking-wide', selectedPerson.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500')}>
                      {selectedPerson.active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleActive}
                      disabled={detailSaving}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-colors',
                        selectedPerson.active
                          ? 'border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      )}
                    >
                      {detailSaving ? <Loader2 size={12} className="animate-spin" /> : selectedPerson.active ? <PowerOff size={12} /> : <Power size={12} />}
                      {selectedPerson.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Edit Name</label>
                    <div className="flex gap-2">
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 bg-[#1d222a] border border-[#2b313a] text-gray-300 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/40"
                      />
                      <button
                        type="button"
                        onClick={handleRename}
                        disabled={detailSaving || editingName.trim() === selectedPerson.name}
                        className="px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {detailSaving ? <Loader2 size={12} className="animate-spin" /> : <PencilLine size={12} />}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-b border-[#2b313a]">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    { label: 'Invoices', value: summary.count },
                    { label: 'Revenue', value: fmtCurrency(summary.revenue) },
                    { label: 'Paid', value: summary.paid },
                    { label: 'Partial', value: summary.partial },
                    { label: 'Unpaid', value: summary.unpaid },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-[#2b313a] bg-[#1d222a] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{item.label}</p>
                      <p className="text-lg font-bold text-white mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Last sale: {summary.lastSale ? fmtDate(summary.lastSale) : 'No sales yet'}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="px-6 py-4 border-b border-[#2b313a] flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Sales History</p>
                    <p className="text-xs text-gray-500 mt-0.5">Invoices handled by this salesperson</p>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500">{detailLoading ? 'Loading…' : `${summary.count} invoices`}</span>
                </div>

                {detailLoading ? (
                  <div className="px-6 py-12 text-center">
                    <Loader2 size={18} className="animate-spin text-primary mx-auto" />
                  </div>
                ) : selectedInvoices.length === 0 ? (
                  <div className="px-6 py-16 text-center text-sm text-gray-500">No invoices found for this salesperson.</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#2b313a]">
                        {['Date', 'Invoice', 'Customer', 'Status', 'Amount'].map((header) => (
                          <th key={header} className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest px-6 py-3 last:text-right">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-[#2b313a]/50 hover:bg-[#1d222a] transition-colors">
                          <td className="px-6 py-3 text-xs text-gray-500">{fmtDate(invoice.created_at)}</td>
                          <td className="px-6 py-3 text-xs font-bold text-gray-300 font-mono">{invoice.invoice_no}</td>
                          <td className="px-6 py-3 text-xs text-gray-400">{getCustomerName(invoice.customers)}</td>
                          <td className="px-6 py-3">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase',
                                invoice.payment_status === 'paid'
                                  ? 'bg-green-900/20 text-green-400'
                                  : invoice.payment_status === 'partial'
                                    ? 'bg-amber-900/20 text-amber-400'
                                    : 'bg-red-900/20 text-red-400'
                              )}
                            >
                              {invoice.payment_status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-xs font-bold font-mono text-right text-white">{fmtCurrency(Number(invoice.total))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
