'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, Truck, Table2, Search, ChevronLeft, ChevronRight, History, Pencil, X, ChevronDown } from 'lucide-react';
import { FabricRoll } from '@/lib/types';
import { createCatalogOption } from '@/lib/catalog-client';
import PageViewToggle, { type PageViewMode } from '../components/PageViewToggle';
import SearchableCombobox from '../components/SearchableCombobox';

interface ExportRow {
  roll_id: string;
  export_quantity: string;
}

interface CustomerOption {
  customer_id: number;
  customer_code: string;
  customer_name: string;
}

interface IssueSlip {
  code: string;
  customer: string;
  date: string;
  note: string;
  items: Array<{ code: string; fabric: string; color: string; quantity: string; unit: string }>;
}

interface ExportHistoryItem {
  trans_id: number;
  quantity: string | number;
  transaction_date: string;
  note: string | null;
  roll_code: string;
  fabric_name: string;
  order_code: string | null;
  customer_name: string | null;
  from_location: string | null;
}

export default function ExportPage() {
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const [rolls, setRolls] = useState<FabricRoll[]>([]);
  const [rows, setRows] = useState<ExportRow[]>([{ roll_id: '', export_quantity: '' }]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [issueSlip, setIssueSlip] = useState<IssueSlip | null>(null);
  const [note, setNote] = useState('');
  const [viewMode, setViewMode] = useState<PageViewMode>('both');
  const [rollSearch, setRollSearch] = useState('');
  const [selectedRolls, setSelectedRolls] = useState<Record<string, FabricRoll>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [editingHistory, setEditingHistory] = useState<ExportHistoryItem | null>(null);
  const [historyEditForm, setHistoryEditForm] = useState({ quantity: '', note: '' });
  const [historySaving, setHistorySaving] = useState(false);
  const [historyEditError, setHistoryEditError] = useState('');
  const [tableSelection, setTableSelection] = useState<'inventory' | 'history'>('inventory');
  const [tableMenuOpen, setTableMenuOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!tableMenuOpen) return;

    const closeMenuOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !tableMenuRef.current?.contains(event.target)) {
        setTableMenuOpen(false);
      }
    };
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTableMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeMenuOnOutsideClick);
    document.addEventListener('keydown', closeMenuOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenuOnOutsideClick);
      document.removeEventListener('keydown', closeMenuOnEscape);
    };
  }, [tableMenuOpen]);

  const fetchRolls = async (targetPage = page, searchTerm = rollSearch) => {
    setFetching(true);
    try {
      const params = new URLSearchParams({
        status: 'ACTIVE',
        page: String(targetPage),
        pageSize: String(pageSize),
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      const res = await fetch(`/api/inventory?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Không thể tải tồn kho.');
      }
      setRolls(json.data || []);
      setTotal(json.pagination?.total ?? 0);
    } catch (err) {
      console.error('Lỗi tải tồn kho:', err);
    } finally {
      setFetching(false);
    }
  };

  const fetchExportHistory = async (targetPage = historyPage, searchTerm = historySearch) => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        type: 'OUTBOUND',
        page: String(targetPage),
        pageSize: String(pageSize),
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      const response = await fetch(`/api/transactions?${params}`);
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể tải lịch sử xuất kho.');
      setExportHistory(json.data || []);
      setHistoryTotal(json.pagination?.total ?? 0);
    } catch (error) {
      console.error('Lỗi tải lịch sử xuất kho:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể tải lịch sử xuất kho.' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const searchRolls = () => {
    setPage(1);
    fetchRolls(1);
  };

  const changePage = (targetPage: number) => {
    setPage(targetPage);
    fetchRolls(targetPage);
  };

  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    fetchRolls();
    fetchExportHistory(1);
  }, []);

  useEffect(() => {
    fetch('/api/customers')
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || 'Không thể tải khách hàng.');
        setCustomers(json.data || []);
      })
      .catch((error: unknown) => {
        console.error('Lỗi tải khách hàng:', error);
        setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể tải khách hàng.' });
      });
  }, []);

  const handleAddRow = () => {
    setRows([...rows, { roll_id: '', export_quantity: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleChangeRow = (index: number, field: keyof ExportRow, value: string) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setMessage({ type: 'error', text: 'Vui lòng chọn khách hàng nhận vải.' });
      return;
    }
    setLoading(true);
    setMessage(null);

    try {
      const selectedCustomer = customers.find((customer) => String(customer.customer_id) === customerId);
      const submittedItems = rows.map((row) => {
        const roll = rolls.find((item) => String(item.roll_id) === row.roll_id) || selectedRolls[row.roll_id];
        return {
          roll_id: Number(row.roll_id),
          export_quantity: Number(row.export_quantity),
          label: {
            code: roll?.roll_code || '',
            fabric: roll?.fabric_name || '',
            color: roll?.color_name || '',
            quantity: row.export_quantity,
            unit: roll?.unit_name || 'm',
          },
        };
      });
      const payload = {
        items: submittedItems.map(({ label: _label, ...item }) => item),
        customer_id: Number(customerId),
        note: note.trim() || undefined,
      };

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        setMessage({ type: 'success', text: json.message });
        setIssueSlip({
          code: json.data.order_code,
          customer: selectedCustomer?.customer_name || '',
          date: new Date().toLocaleString('vi-VN'),
          note: note.trim(),
          items: submittedItems.map((item) => item.label),
        });
        setRows([{ roll_id: '', export_quantity: '' }]);
        setNote('');
        fetchRolls();
        fetchExportHistory(1);
      } else {
        setMessage({ type: 'error', text: json.error || 'Có lỗi xảy ra khi xuất kho.' });
      }
    } catch (err) {
      console.error('Lỗi kết nối:', err);
      setMessage({ type: 'error', text: 'Không thể kết nối máy chủ.' });
    } finally {
      setLoading(false);
    }
  };

  const addCustomer = async (name: string, fields: Record<string, string>) => {
    const option = await createCatalogOption('customers', name, fields);
    const customer = {
      customer_id: Number(option.value),
      customer_code: fields.code,
      customer_name: name,
    };
    setCustomers((current) => [...current, customer].sort((left, right) => left.customer_name.localeCompare(right.customer_name, 'vi')));
    return option;
  };

  const startEditingHistory = (item: ExportHistoryItem) => {
    setEditingHistory(item);
    setHistoryEditForm({ quantity: String(item.quantity), note: item.note || '' });
    setHistoryEditError('');
  };

  const saveHistoryEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingHistory) return;
    setHistorySaving(true);
    setHistoryEditError('');
    try {
      const response = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trans_id: editingHistory.trans_id,
          quantity: historyEditForm.quantity,
          note: historyEditForm.note,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        setHistoryEditError(json.error || 'Không thể cập nhật giao dịch xuất.');
        return;
      }
      setEditingHistory(null);
      setMessage({ type: 'success', text: json.message || 'Đã cập nhật giao dịch xuất.' });
      await Promise.all([fetchExportHistory(), fetchRolls()]);
    } catch (error) {
      console.error('Lỗi sửa lịch sử xuất kho:', error);
      setHistoryEditError(error instanceof Error ? error.message : 'Không thể cập nhật giao dịch xuất.');
    } finally {
      setHistorySaving(false);
    }
  };

  const historyTotalPages = Math.ceil(historyTotal / pageSize);
  const searchExportHistory = () => {
    setHistoryPage(1);
    void fetchExportHistory(1, historySearch);
  };

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Xuất Kho Vải Hàng Loạt</h1>
          <p className="text-sm text-slate-500 mt-0.5">Tạo phiếu lãnh vải theo khách hàng và ghi nhận xuất kho</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <PageViewToggle mode={viewMode} onChange={setViewMode} />
          <button
            type="button"
            onClick={() => fetchRolls()}
            disabled={fetching}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
            <span>Làm mới danh sách</span>
          </button>
        </div>
      </div>

      {issueSlip && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 print:hidden">
          <span>Đã tạo phiếu {issueSlip.code}.</span>
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-emerald-700 px-3 py-2 font-semibold text-white">In phiếu lãnh</button>
        </div>
      )}

      <style>{`@media print { body * { visibility: hidden !important; } .issue-print, .issue-print * { visibility: visible !important; } .issue-print { display: block !important; position: absolute; inset: 0; width: 100%; padding: 24px; background: #fff; color: #111827; } }`}</style>
      {issueSlip && (
        <section className="issue-print hidden">
          <h1 className="text-center text-2xl font-bold">PHIẾU LÃNH VẢI</h1>
          <p className="mt-4">Mã phiếu: <strong>{issueSlip.code}</strong></p>
          <p>Khách hàng: <strong>{issueSlip.customer}</strong></p>
          <p>Thời gian: {issueSlip.date}</p>
          <table className="mt-5 w-full border-collapse text-sm">
            <thead><tr>{['STT', 'Mã cuộn', 'Tên vải', 'Màu', 'Số lượng'].map((heading) => <th key={heading} className="border p-2 text-left">{heading}</th>)}</tr></thead>
            <tbody>{issueSlip.items.map((item, index) => (
              <tr key={`${item.code}-${index}`}>
                <td className="border p-2">{index + 1}</td><td className="border p-2">{item.code}</td>
                <td className="border p-2">{item.fabric}</td><td className="border p-2">{item.color || '-'}</td>
                <td className="border p-2">{item.quantity} {item.unit}</td>
              </tr>
            ))}</tbody>
          </table>
          {issueSlip.note && <p className="mt-4">Ghi chú: {issueSlip.note}</p>}
          <div className="mt-16 grid grid-cols-2 text-center"><p>Người giao<br /><br /><br />Ký, ghi rõ họ tên</p><p>Người nhận<br /><br /><br />Ký, ghi rõ họ tên</p></div>
        </section>
      )}

      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className={viewMode === 'both' ? 'grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2' : 'space-y-6'}>
      {viewMode !== 'table' && <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-base">Danh sách cuộn xuất kho ({rows.length})</h2>
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> Thêm cuộn
            </button>
          </div>

          <label className="block space-y-1 text-xs font-semibold text-slate-700">
            Khách hàng nhận vải <span className="text-rose-500">*</span>
            <SearchableCombobox
              required
              ariaLabel="Khách hàng nhận vải"
              value={customerId}
              onChange={setCustomerId}
              options={customers.map((customer) => ({
                value: String(customer.customer_id),
                label: `${customer.customer_name} (${customer.customer_code})`,
              }))}
              placeholder="Tìm khách hàng..."
              createFields={[{ name: 'code', label: 'Mã khách hàng', required: true }]}
              onCreateOption={addCustomer}
            />
          </label>

          <div className="space-y-3">
            {rows.map((row, index) => {
              const selectedRoll = rolls.find((r) => String(r.roll_id) === row.roll_id) || selectedRolls[row.roll_id];
              const maxQty = selectedRoll ? Number(selectedRoll.quantity_remaining) : 0;

              return (
                <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-xs font-bold text-slate-500 w-8">#{index + 1}</span>
                  <div className="flex-1">
                    <SearchableCombobox
                      required
                      ariaLabel={`Cuộn xuất kho số ${index + 1}`}
                      value={row.roll_id}
                      onChange={(rollId) => {
                        const selected = rolls.find((roll) => String(roll.roll_id) === rollId)
                          || selectedRolls[rollId];
                        if (selected) {
                          setSelectedRolls((current) => ({ ...current, [rollId]: selected }));
                        }
                        handleChangeRow(index, 'roll_id', rollId);
                      }}
                      placeholder="Tìm mã cuộn, tên vải hoặc vị trí..."
                      options={[...rolls, ...Object.values(selectedRolls).filter((selected) => !rolls.some((roll) => roll.roll_id === selected.roll_id))].map((roll) => ({
                        value: String(roll.roll_id),
                        label: `${roll.roll_code} | ${roll.fabric_name || 'Vải'}${roll.stock_type === 'SAVING' ? ' (Vải tiết kiệm)' : ''} - Tồn: ${roll.quantity_remaining}${roll.unit_name || 'm'} (Kệ: ${roll.location_code || 'Chưa xếp'})`,
                      }))}
                      className="py-2 pl-9 pr-9 text-xs focus:border-rose-500 focus:ring-rose-100"
                    />
                  </div>

                  <div className="w-48">
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      max={maxQty || undefined}
                      value={row.export_quantity}
                      onChange={(e) => handleChangeRow(index, 'export_quantity', e.target.value)}
                      placeholder={`SL xuất (Tồn: ${maxQty})`}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(index)}
                      className="text-rose-500 hover:text-rose-700 p-2 transition-colors"
                      title="Xóa dòng"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Ghi chú phiếu xuất kho / Khách hàng</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Xuất bán đơn hàng KH-8892..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-xs disabled:opacity-50"
            >
              <Truck className="w-4 h-4" />
              <span>{loading ? 'Đang xử lý Transaction...' : `Xác Nhận Xuất ${rows.length} Cuộn`}</span>
            </button>
          </div>
        </div>
      </form>}

      {viewMode !== 'entry' && tableSelection === 'inventory' && (
        <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Table2 className="h-5 w-5 shrink-0 text-blue-600" />
              <div ref={tableMenuRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={tableMenuOpen}
                  aria-label={`Bảng đang xem: Tồn kho có thể xuất (${total.toLocaleString('vi-VN')} cuộn). Chọn bảng`}
                  onClick={() => setTableMenuOpen((open) => !open)}
                  className="inline-flex max-w-full items-center gap-2 rounded-md py-1 text-left text-base font-semibold text-slate-900 transition-colors hover:text-blue-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span className="truncate">Tồn kho có thể xuất ({total.toLocaleString('vi-VN')} cuộn)</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${tableMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {tableMenuOpen && (
                  <div role="listbox" aria-label="Chọn bảng hiển thị" className="absolute left-0 top-full z-30 mt-2 min-w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                    <button type="button" role="option" aria-selected onClick={() => { setTableSelection('inventory'); setTableMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg bg-blue-50 px-3 py-2.5 text-left text-sm font-semibold text-blue-700">
                      <Table2 className="h-4 w-4 shrink-0" /> Tồn kho có thể xuất
                    </button>
                    <button type="button" role="option" aria-selected={false} onClick={() => { setTableSelection('history'); setTableMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                      <History className="h-4 w-4 shrink-0" /> Lịch sử xuất kho ({historyTotal.toLocaleString('vi-VN')})
                    </button>
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-500">Danh sách cuộn đang còn hàng</p>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={rollSearch}
                  onChange={(event) => setRollSearch(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && searchRolls()}
                  placeholder="Tìm mã cuộn, barcode, tên vải..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={searchRolls}
                disabled={fetching}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
              >
                Tìm
              </button>
              <button
                type="button"
                onClick={() => fetchRolls()}
                disabled={fetching}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${fetching ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>
          <div className="max-h-[75vh] flex-1 overflow-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-3">Mã cuộn</th>
                  <th className="px-3 py-3">Vải</th>
                  <th className="px-3 py-3">Vị trí</th>
                  <th className="px-3 py-3 text-right">Ban đầu</th>
                  <th className="px-3 py-3 text-right">Còn lại</th>
                  <th className="px-3 py-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fetching ? (
                  <tr><td colSpan={6} className="py-10 text-center text-slate-400">Đang tải tồn kho...</td></tr>
                ) : rolls.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-slate-400">Không có cuộn nào còn hàng.</td></tr>
                ) : rolls.map((roll) => (
                  <tr key={roll.roll_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{roll.roll_code}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{roll.barcode || 'Chưa có barcode'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{roll.fabric_name || 'Chưa phân loại'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{roll.location_code || roll.location_name || 'Chưa xếp kệ'}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{roll.quantity_initial} {roll.unit_name || 'm'}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-blue-600">
                      {Number(roll.quantity_remaining).toFixed(2)} {roll.unit_name || 'm'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{roll.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>Trang {page} / {Math.max(totalPages, 1)} · {total.toLocaleString('vi-VN')} cuộn</span>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => changePage(Math.max(1, page - 1))} disabled={fetching || page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50">
                <ChevronLeft className="h-4 w-4" /> Trước
              </button>
              <button type="button" onClick={() => changePage(page + 1)} disabled={fetching || page >= totalPages} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50">
                Sau <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}
      {viewMode !== 'entry' && tableSelection === 'history' && (
        <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 shrink-0 text-blue-600" />
              <div ref={tableMenuRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={tableMenuOpen}
                  aria-label={`Bảng đang xem: Lịch sử xuất kho (${historyTotal.toLocaleString('vi-VN')}). Chọn bảng`}
                  onClick={() => setTableMenuOpen((open) => !open)}
                  className="inline-flex max-w-full items-center gap-2 rounded-md py-1 text-left text-base font-semibold text-slate-900 transition-colors hover:text-blue-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span className="truncate">Lịch sử xuất kho ({historyTotal.toLocaleString('vi-VN')})</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${tableMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {tableMenuOpen && (
                  <div role="listbox" aria-label="Chọn bảng hiển thị" className="absolute left-0 top-full z-30 mt-2 min-w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                    <button type="button" role="option" aria-selected={false} onClick={() => { setTableSelection('inventory'); setTableMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                      <Table2 className="h-4 w-4 shrink-0" /> Tồn kho có thể xuất ({total.toLocaleString('vi-VN')} cuộn)
                    </button>
                    <button type="button" role="option" aria-selected onClick={() => { setTableSelection('history'); setTableMenuOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg bg-blue-50 px-3 py-2.5 text-left text-sm font-semibold text-blue-700">
                      <History className="h-4 w-4 shrink-0" /> Lịch sử xuất kho
                    </button>
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-500">Các cuộn đã xuất và thông tin phiếu lãnh</p>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && searchExportHistory()}
                  placeholder="Tìm mã cuộn, tên vải, ghi chú..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs"
                />
              </div>
              <button type="button" onClick={searchExportHistory} disabled={historyLoading} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium disabled:opacity-50">Tìm</button>
              <button type="button" onClick={() => void fetchExportHistory()} disabled={historyLoading} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} /> Làm mới
              </button>
            </div>
          </div>
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-3">Mã phiếu / giao dịch</th>
                  <th className="px-3 py-3">Khách hàng</th>
                  <th className="px-3 py-3">Mã cuộn / vải</th>
                  <th className="px-3 py-3 text-right">Số lượng</th>
                  <th className="px-3 py-3">Ghi chú</th>
                  <th className="px-3 py-3 text-center">Ngày xuất</th>
                  <th className="px-3 py-3 text-right">Sửa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyLoading ? (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400">Đang tải lịch sử xuất kho...</td></tr>
                ) : exportHistory.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400">Chưa có lịch sử xuất kho khớp với tìm kiếm.</td></tr>
                ) : exportHistory.map((item) => (
                  <tr key={item.trans_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{item.order_code || `GD #${item.trans_id}`}</div>
                      <div className="text-[10px] text-slate-400">#{item.trans_id}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{item.customer_name || '-'}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-blue-600">{item.roll_code}</div>
                      <div className="text-slate-500">{item.fabric_name}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{Number(item.quantity).toFixed(2)} m</td>
                    <td className="max-w-xs truncate px-3 py-2.5 text-slate-500" title={item.note || ''}>{item.note || '-'}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{new Date(item.transaction_date).toLocaleDateString('vi-VN')}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button type="button" onClick={() => startEditingHistory(item)} title="Sửa giao dịch xuất" className="rounded-lg p-2 text-blue-600 hover:bg-blue-50">
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>Trang {historyPage} / {Math.max(historyTotalPages, 1)} · {historyTotal.toLocaleString('vi-VN')} giao dịch xuất</span>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { const next = Math.max(1, historyPage - 1); setHistoryPage(next); void fetchExportHistory(next); }} disabled={historyLoading || historyPage <= 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50">
                <ChevronLeft className="h-4 w-4" /> Trước
              </button>
              <button type="button" onClick={() => { const next = historyPage + 1; setHistoryPage(next); void fetchExportHistory(next); }} disabled={historyLoading || historyPage >= historyTotalPages} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50">
                Sau <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}
      </div>
        {editingHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4">
            <form onSubmit={saveHistoryEdit} className="my-8 w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Sửa giao dịch xuất</h2>
                  <p className="mt-1 text-xs text-slate-500">{editingHistory.order_code || `Giao dịch #${editingHistory.trans_id}`} · {editingHistory.roll_code}</p>
                </div>
                <button type="button" onClick={() => setEditingHistory(null)} disabled={historySaving} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-4 w-4" /></button>
              </div>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Số lượng xuất (m)
                <input type="number" min="0.001" step="0.001" required value={historyEditForm.quantity} onChange={(event) => setHistoryEditForm({ ...historyEditForm, quantity: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Ghi chú
                <textarea rows={3} maxLength={1000} value={historyEditForm.note} onChange={(event) => setHistoryEditForm({ ...historyEditForm, note: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
              </label>
              {historyEditError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{historyEditError}</p>}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setEditingHistory(null)} disabled={historySaving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:opacity-50">Hủy</button>
                <button type="submit" disabled={historySaving} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {historySaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        )}
    </div>
  );
}