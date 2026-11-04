'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, Truck, Search, ChevronLeft, ChevronRight, Pencil, X, Copy } from 'lucide-react';
import { FabricRoll } from '@/lib/types';
import { createCatalogOption } from '@/lib/catalog-client';
import SearchableCombobox from '../components/SearchableCombobox';

interface ExportRow {
  roll_id: string;
  export_quantity: string;
  note: string;
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
  const [rolls, setRolls] = useState<FabricRoll[]>([]);
  const [rows, setRows] = useState<ExportRow[]>([{ roll_id: '', export_quantity: '', note: '' }]);
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [issueSlip, setIssueSlip] = useState<IssueSlip | null>(null);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [noteEditorPosition, setNoteEditorPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [rollSearch, setRollSearch] = useState('');
  const [selectedRolls, setSelectedRolls] = useState<Record<string, FabricRoll>>({});
  const [selectedInventoryRollId, setSelectedInventoryRollId] = useState<number | null>(null);
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
  const [selectedHistoryTransId, setSelectedHistoryTransId] = useState<number | null>(null);
  const [copyingSelectedRoll, setCopyingSelectedRoll] = useState(false);
  const [tableSelection, setTableSelection] = useState<'inventory' | 'history'>('inventory');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const selectedInventoryRoll = rolls.find((roll) => roll.roll_id === selectedInventoryRollId);

  useEffect(() => {
    if (editingNoteIndex === null) return;

    const updatePosition = () => {
      const anchor = document.getElementById(`export-note-${editingNoteIndex}`);
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 16);
      const height = 180;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const top = rect.bottom + height + 8 <= window.innerHeight
        ? rect.bottom + 4
        : Math.max(8, rect.top - height - 4);
      setNoteEditorPosition({ top, left, width });
    };

    updatePosition();
    window.requestAnimationFrame(() => noteTextareaRef.current?.focus());
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      const anchor = document.getElementById(`export-note-${editingNoteIndex}`);
      if (target instanceof Node && !noteEditorRef.current?.contains(target) && !anchor?.contains(target)) {
        setEditingNoteIndex(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditingNoteIndex(null);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [editingNoteIndex]);

  const fetchRolls = async (targetPage = page, searchTerm = rollSearch) => {
    setSelectedInventoryRollId(null);
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
    setSelectedInventoryRollId(null);
    setSelectedRowIndex(rows.length);
    setRows([...rows, { roll_id: '', export_quantity: '', note: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
    setEditingNoteIndex((current) => {
      if (current === index) return null;
      return current !== null && current > index ? current - 1 : current;
    });
    setSelectedRowIndex((current) => {
      if (current === index) return Math.max(0, index - 1);
      return current > index ? current - 1 : current;
    });
  };

  const handleChangeRow = (index: number, field: keyof ExportRow, value: string) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const copySelectedRow = () => {
    const roll = selectedInventoryRoll
      || rolls.find((item) => String(item.roll_id) === rows[selectedRowIndex]?.roll_id)
      || selectedRolls[rows[selectedRowIndex]?.roll_id];
    if (!roll) {
      setMessage({ type: 'error', text: 'Vui lòng chọn một cuộn tồn kho để sao chép vào danh sách xuất.' });
      return;
    }

    const rollId = String(roll.roll_id);
    const currentRow = rows[selectedRowIndex];
    const targetIndex = currentRow && !currentRow.roll_id && !currentRow.export_quantity
      ? selectedRowIndex
      : rows.length;
    setSelectedRolls((current) => ({ ...current, [rollId]: roll }));
    setRows(targetIndex === rows.length
      ? [...rows, { roll_id: rollId, export_quantity: '', note: '' }]
      : rows.map((row, index) => index === targetIndex ? { roll_id: rollId, export_quantity: '', note: '' } : row));
    setSelectedInventoryRollId(null);
    setSelectedRowIndex(targetIndex);
    setMessage({
      type: 'success',
      text: `Đã đưa cuộn ${roll.roll_code} vào dòng xuất ${targetIndex + 1}. Nhập số lượng cần xuất.`,
    });
  };

  const copySelectedHistoryRoll = async () => {
    const historyItem = exportHistory.find((item) => item.trans_id === selectedHistoryTransId);
    if (!historyItem) {
      setMessage({ type: 'error', text: 'Vui lòng chọn một giao dịch trong lịch sử xuất kho để sao chép.' });
      return;
    }

    setCopyingSelectedRoll(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({
        status: 'ACTIVE',
        search: historyItem.roll_code,
        page: '1',
        pageSize: '100',
      });
      const response = await fetch(`/api/inventory?${params}`);
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Không thể kiểm tra tồn kho của cuộn đã chọn.');
      }
      const roll = (json.data as FabricRoll[]).find((item) => item.roll_code === historyItem.roll_code);
      if (!roll) {
        setMessage({
          type: 'error',
          text: `Cuộn ${historyItem.roll_code} hiện không còn tồn kho khả dụng để xuất.`,
        });
        return;
      }

      const rollId = String(roll.roll_id);
      const currentRow = rows[selectedRowIndex];
      const targetIndex = currentRow && !currentRow.roll_id && !currentRow.export_quantity
        ? selectedRowIndex
        : rows.length;
      setSelectedRolls((current) => ({ ...current, [rollId]: roll }));
      setRows(targetIndex === rows.length
        ? [...rows, { roll_id: rollId, export_quantity: '', note: '' }]
        : rows.map((row, index) => index === targetIndex ? { roll_id: rollId, export_quantity: '', note: '' } : row));
      setSelectedHistoryTransId(null);
      setSelectedRowIndex(targetIndex);
      setMessage({
        type: 'success',
        text: `Đã đưa cuộn ${roll.roll_code} vào dòng xuất ${targetIndex + 1}. Nhập số lượng cần xuất.`,
      });
    } catch (error) {
      console.error('Lỗi sao chép cuộn từ lịch sử xuất kho:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể sao chép cuộn từ lịch sử xuất kho.',
      });
    } finally {
      setCopyingSelectedRoll(false);
    }
  };

  const handleCopySelectedRow = () => {
    if (tableSelection === 'history' && selectedHistoryTransId !== null) {
      void copySelectedHistoryRoll();
      return;
    }
    copySelectedRow();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setMessage({ type: 'error', text: 'Vui lòng chọn khách hàng nhận vải.' });
      return;
    }
    const invalidRowIndex = rows.findIndex((row) => {
      const quantity = Number(row.export_quantity);
      const roll = rolls.find((item) => String(item.roll_id) === row.roll_id) || selectedRolls[row.roll_id];
      return !row.roll_id || !Number.isFinite(quantity) || quantity <= 0 || !roll || quantity > Number(roll.quantity_remaining);
    });
    if (invalidRowIndex !== -1) {
      setSelectedRowIndex(invalidRowIndex);
      setSelectedInventoryRollId(null);
      setMessage({
        type: 'error',
        text: `Kiểm tra lại cuộn và số lượng xuất ở dòng ${invalidRowIndex + 1}. Số lượng phải lớn hơn 0 và không vượt tồn kho.`,
      });
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
          note: row.note.trim(),
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
        note: rows[0]?.note.trim() || undefined,
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
          note: rows.map((row, index) => row.note.trim() ? `Dòng ${index + 1}: ${row.note.trim()}` : '').filter(Boolean).join('\n'),
          items: submittedItems.map((item) => item.label),
        });
        setRows([{ roll_id: '', export_quantity: '', note: '' }]);
        setSelectedRowIndex(0);
        setEditingNoteIndex(null);
        setSelectedRolls({});
        await Promise.all([fetchRolls(1), fetchExportHistory(1)]);
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
    <div className="mx-auto max-w-screen-2xl space-y-4">
      <div className="flex flex-col gap-3 border border-slate-400 bg-gradient-to-b from-slate-100 to-slate-300 px-3 py-2 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-sm font-bold text-slate-900">Xuất kho vải</h1>
          <p className="mt-0.5 text-[11px] text-slate-600">Xuất danh sách cuộn vải theo khách hàng</p>
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

      <div className="flex flex-col gap-0">
      <form onSubmit={handleSubmit} className="order-2 min-w-0 border-x border-b border-slate-400 bg-[#f5f5f5] shadow-md">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 py-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[11px] font-bold uppercase text-slate-800">
                Dòng mới — chỉ các dòng cuộn bên dưới sẽ được xuất kho
              </h2>
              <span className="border border-slate-400 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                {rows.length} dòng mới
              </span>
            </div>
          </div>

          <div className="w-full min-w-0 overflow-hidden border-b border-slate-400 bg-white">
            <div className="min-w-0">
              <div className="max-h-[36vh] overflow-y-auto">
                <table className="w-full table-fixed border-collapse text-left text-[11px]">
                  <colgroup>
                    <col className="w-[3%]" />
                    <col className="w-[15%]" />
                    <col className="w-[21%]" />
                    <col className="w-[10%]" />
                    <col className="w-[8%]" />
                    <col className="w-[10%]" />
                    <col className="w-[11%]" />
                    <col className="w-[18%]" />
                    <col className="w-[4%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-gradient-to-b from-slate-100 to-slate-300 text-[10px] font-semibold uppercase text-slate-700">
                    <tr>
                      <th className="border border-slate-400 px-1 py-1.5">#</th>
                      <th className="border border-slate-400 px-1 py-1.5">Khách hàng *</th>
                      <th className="border border-slate-400 px-1 py-1.5">Mã cuộn *</th>
                      <th className="border border-slate-400 px-1 py-1.5">Loại vải</th>
                      <th className="border border-slate-400 px-1 py-1.5">Vị trí</th>
                      <th className="border border-slate-400 px-1 py-1.5 text-right">Tồn hiện tại</th>
                      <th className="border border-slate-400 px-1 py-1.5">Số lượng xuất *</th>
                      <th className="border border-slate-400 px-1 py-1.5">Ghi chú</th>
                      <th className="border border-slate-400 px-1 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
            {rows.map((row, index) => {
              const selectedRoll = rolls.find((r) => String(r.roll_id) === row.roll_id) || selectedRolls[row.roll_id];
              const maxQty = selectedRoll ? Number(selectedRoll.quantity_remaining) : 0;

              return (
                <tr
                  key={index}
                  onClick={() => {
                    setSelectedRowIndex(index);
                    setSelectedInventoryRollId(null);
                  }}
                  onFocusCapture={() => {
                    setSelectedRowIndex(index);
                    setSelectedInventoryRollId(null);
                  }}
                  className={selectedRowIndex === index && !selectedInventoryRollId ? 'bg-[#dbeafe]' : index % 2 === 0 ? 'bg-white' : 'bg-[#f7f7f7]'}
                >
                  <td className="border border-slate-300 px-1 py-1 text-center text-slate-500">{index + 1}</td>
                  {index === 0 && (
                    <td rowSpan={rows.length} className="align-top border border-slate-300 px-1 py-1">
                      <SearchableCombobox
                        required
                        ariaLabel="Khách hàng nhận vải"
                        value={customerId}
                        onChange={setCustomerId}
                        options={customers.map((customer) => ({
                          value: String(customer.customer_id),
                          label: `${customer.customer_name} (${customer.customer_code})`,
                        }))}
                        placeholder="Khách hàng nhận vải *"
                        createFields={[{ name: 'code', label: 'Mã khách hàng', required: true }]}
                        onCreateOption={addCustomer}
                        showSearchIcon={false}
                        showChevron={false}
                        className="!h-7 !w-full !rounded-none !border-slate-300 !py-1 !pl-2 !pr-2 !text-[12px] !font-medium !text-slate-900 placeholder:!text-slate-500"
                      />
                    </td>
                  )}
                  <td className="border border-slate-300 px-1 py-1">
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
                      showSearchIcon={false}
                      showChevron={false}
                      className="!h-7 !rounded-none !border-slate-300 !py-1 !pl-2 !pr-2 !text-[12px] !font-medium !text-slate-900 placeholder:!text-slate-500"
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-slate-700">{selectedRoll?.fabric_name || '—'}</td>
                  <td className="border border-slate-300 px-2 py-1 text-slate-700">{selectedRoll?.location_code || selectedRoll?.location_name || '—'}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right text-slate-700">
                    {selectedRoll ? `${Number(selectedRoll.quantity_remaining).toFixed(2)} ${selectedRoll.unit_name || 'm'}` : '—'}
                  </td>
                  <td className="border border-slate-300 px-1 py-1">
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      max={maxQty || undefined}
                      value={row.export_quantity}
                      onChange={(e) => handleChangeRow(index, 'export_quantity', e.target.value)}
                      aria-label={`Số lượng xuất dòng ${index + 1}`}
                      placeholder="0.00"
                      className="h-7 w-full border border-slate-300 bg-white px-1 text-right text-[12px] font-medium text-slate-900 placeholder:text-slate-500"
                    />
                  </td>
                  <td className="border border-slate-300 px-1 py-1">
                    <input
                      id={`export-note-${index}`}
                      type="text"
                      readOnly
                      aria-label={`Ghi chú dòng ${index + 1}`}
                      value={row.note}
                      onFocus={() => setEditingNoteIndex(index)}
                      onClick={() => setEditingNoteIndex(index)}
                      placeholder="Ghi chú"
                      title={row.note}
                      className="h-7 w-full min-w-0 cursor-text border border-slate-300 bg-white px-1 text-[11px] font-medium leading-5 text-slate-900 placeholder:text-slate-500"
                    />
                  </td>
                  <td className="border border-slate-300 px-1 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(index)}
                      disabled={rows.length === 1}
                      aria-label={`Xóa dòng xuất ${index + 1}`}
                      title={rows.length === 1 ? 'Cần ít nhất một dòng xuất kho' : 'Xóa dòng'}
                      className="text-rose-500 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="mx-auto h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex flex-nowrap items-center justify-between gap-2 border-t border-white bg-gradient-to-b from-slate-100 to-slate-300 px-2 py-1.5">
            <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
              <span className="mr-1 shrink-0 text-[10px] text-slate-600">
                Trang {tableSelection === 'inventory' ? page : historyPage}/{Math.max(1, tableSelection === 'inventory' ? totalPages : historyTotalPages)}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (tableSelection === 'inventory') changePage(Math.max(1, page - 1));
                  else {
                    const next = Math.max(1, historyPage - 1);
                    setHistoryPage(next);
                    void fetchExportHistory(next);
                  }
                }}
                disabled={tableSelection === 'inventory' ? fetching || page <= 1 : historyLoading || historyPage <= 1}
                className="flex h-7 shrink-0 items-center border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-1.5 disabled:opacity-50"
                aria-label="Trang trước"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (tableSelection === 'inventory') changePage(page + 1);
                  else {
                    const next = historyPage + 1;
                    setHistoryPage(next);
                    void fetchExportHistory(next);
                  }
                }}
                disabled={tableSelection === 'inventory' ? fetching || page >= totalPages : historyLoading || historyPage >= historyTotalPages}
                className="flex h-7 shrink-0 items-center border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-1.5 disabled:opacity-50"
                aria-label="Trang sau"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <span className="mx-1 h-6 shrink-0 border-l border-slate-400" />
              <button
                type="button"
                onClick={handleAddRow}
                className="flex h-7 shrink-0 items-center gap-1 border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 text-[11px] font-semibold text-slate-800 hover:to-slate-300"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm
              </button>
              <button
                type="button"
                onClick={handleCopySelectedRow}
                disabled={copyingSelectedRoll}
                className="flex h-7 shrink-0 items-center gap-1 border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 text-[11px] font-semibold text-slate-800 hover:to-slate-300 disabled:opacity-50"
              >
                <Copy className="h-3.5 w-3.5" /> Sao chép
              </button>
              <span className="ml-1 shrink-0 border-l border-slate-400 pl-2 text-[10px] text-slate-600">
                Dòng {selectedRowIndex + 1} / {rows.length}
              </span>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex h-8 shrink-0 items-center justify-center gap-1.5 border border-rose-800 bg-gradient-to-b from-rose-500 to-rose-700 px-3 text-xs font-bold text-white shadow-sm hover:from-rose-600 hover:to-rose-800 disabled:opacity-50"
            >
              <Truck className="h-3.5 w-3.5" />
              <span>{loading ? 'Đang xuất...' : `Xác nhận xuất ${rows.length} cuộn`}</span>
            </button>
          </div>
        </div>
      </form>

      {tableSelection === 'inventory' && (
        <section className="order-1 flex h-full min-w-0 flex-col overflow-hidden border border-slate-400 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div role="tablist" aria-label="Bảng xuất kho" className="flex flex-nowrap items-end gap-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tableSelection === 'inventory'}
                  onClick={() => { setTableSelection('inventory'); setSelectedHistoryTransId(null); setSelectedInventoryRollId(null); }}
                  className={`shrink-0 border px-2.5 py-1.5 text-[11px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    tableSelection === 'inventory'
                      ? 'relative z-10 -mb-px border-slate-400 border-b-white bg-white font-semibold text-slate-900'
                      : 'border-slate-300 bg-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tồn kho có thể xuất ({total.toLocaleString('vi-VN')})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={false}
                  onClick={() => { setTableSelection('history'); setSelectedInventoryRollId(null); }}
                  className="shrink-0 border border-slate-300 bg-slate-200 px-2.5 py-1.5 text-[11px] text-slate-700 hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Lịch sử xuất kho ({historyTotal.toLocaleString('vi-VN')})
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-600">Chọn cuộn trong danh sách để sao chép vào dòng xuất kho</p>
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={rollSearch}
                  onChange={(event) => setRollSearch(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && searchRolls()}
                  placeholder="Tìm cuộn đã có..."
                  aria-label="Tìm cuộn tồn kho có thể xuất"
                  className="h-7 w-full min-w-0 border border-slate-400 bg-white pl-7 pr-2 text-[11px] text-slate-900 shadow-inner focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={searchRolls}
                disabled={fetching}
                className="h-7 shrink-0 border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 text-[11px] font-semibold text-slate-800 disabled:opacity-50"
              >
                Tìm
              </button>
              <button
                type="button"
                onClick={() => fetchRolls()}
                disabled={fetching}
                className="flex h-7 shrink-0 items-center gap-1 border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 text-[11px] font-semibold text-slate-800 hover:to-slate-300 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${fetching ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>
          <div className="max-h-[54vh] flex-1 overflow-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-gradient-to-b from-slate-100 to-slate-300 text-[10px] font-semibold uppercase text-slate-700">
                <tr>
                  <th className="border border-slate-400 px-1 py-1.5">#</th>
                  <th className="border border-slate-400 px-1 py-1.5">Mã cuộn</th>
                  <th className="border border-slate-400 px-1 py-1.5">Loại vải</th>
                  <th className="border border-slate-400 px-1 py-1.5">Vị trí kệ</th>
                  <th className="border border-slate-400 px-1 py-1.5 text-right">Số lượng ban đầu</th>
                  <th className="border border-slate-400 px-1 py-1.5 text-right">Còn lại</th>
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr><td colSpan={6} className="border border-slate-300 py-8 text-center text-slate-500">Đang tải tồn kho...</td></tr>
                ) : rolls.length === 0 ? (
                  <tr><td colSpan={6} className="border border-slate-300 py-8 text-center text-slate-500">Không có cuộn nào còn hàng.</td></tr>
                ) : rolls.map((roll, index) => (
                  <tr
                    key={roll.roll_id}
                    onClick={() => setSelectedInventoryRollId(roll.roll_id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedInventoryRollId(roll.roll_id);
                      }
                    }}
                    tabIndex={0}
                    aria-selected={selectedInventoryRollId === roll.roll_id}
                    aria-label={`Chọn cuộn ${roll.roll_code} để xuất`}
                    className={`cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                      selectedInventoryRollId === roll.roll_id
                        ? 'bg-[#dbeafe]'
                        : index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-[#f7f7f7] hover:bg-slate-50'
                    }`}
                  >
                    <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-500">{(page - 1) * pageSize + index + 1}</td>
                    <td className="border border-slate-300 px-2 py-1.5">
                      <div className="font-semibold text-slate-900">{roll.roll_code}</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">{roll.barcode || 'Chưa có barcode'}</div>
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-slate-700">{roll.fabric_name || 'Chưa phân loại'}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-slate-600">{roll.location_code || roll.location_name || 'Chưa xếp kệ'}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right text-slate-700">{roll.quantity_initial} {roll.unit_name || 'm'}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right font-semibold text-blue-600">
                      {Number(roll.quantity_remaining).toFixed(2)} {roll.unit_name || 'm'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tableSelection === 'history' && (
        <section className="order-1 flex h-full min-w-0 flex-col overflow-hidden border border-slate-400 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div role="tablist" aria-label="Bảng xuất kho" className="flex flex-nowrap items-end gap-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={false}
                  onClick={() => { setTableSelection('inventory'); setSelectedHistoryTransId(null); setSelectedInventoryRollId(null); }}
                  className="shrink-0 border border-slate-300 bg-slate-200 px-2.5 py-1.5 text-[11px] text-slate-700 hover:bg-slate-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Tồn kho có thể xuất ({total.toLocaleString('vi-VN')})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tableSelection === 'history'}
                  onClick={() => { setTableSelection('history'); setSelectedInventoryRollId(null); }}
                  className={`shrink-0 border px-2.5 py-1.5 text-[11px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    tableSelection === 'history'
                      ? 'relative z-10 -mb-px border-slate-400 border-b-white bg-white font-semibold text-slate-900'
                      : 'border-slate-300 bg-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Lịch sử xuất kho ({historyTotal.toLocaleString('vi-VN')})
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-600">Các cuộn đã xuất và thông tin phiếu lãnh</p>
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && searchExportHistory()}
                  placeholder="Tìm cuộn đã xuất..."
                  aria-label="Tìm lịch sử xuất kho"
                  className="h-7 w-full min-w-0 border border-slate-400 bg-white pl-7 pr-2 text-[11px] text-slate-900 shadow-inner focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button type="button" onClick={searchExportHistory} disabled={historyLoading} className="h-7 shrink-0 border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 text-[11px] font-semibold text-slate-800 disabled:opacity-50">Tìm</button>
              <button type="button" onClick={() => void fetchExportHistory()} disabled={historyLoading} className="inline-flex h-7 shrink-0 items-center gap-1 border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 text-[11px] font-semibold text-slate-800 disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} /> Làm mới
              </button>
            </div>
          </div>
          <div className="max-h-[54vh] flex-1 overflow-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-gradient-to-b from-slate-100 to-slate-300 text-[10px] font-semibold uppercase text-slate-700">
                <tr>
                  <th className="border border-slate-400 px-1 py-1.5">Mã phiếu / giao dịch</th>
                  <th className="border border-slate-400 px-1 py-1.5">Khách hàng</th>
                  <th className="border border-slate-400 px-1 py-1.5">Mã cuộn / vải</th>
                  <th className="border border-slate-400 px-1 py-1.5 text-right">Số lượng</th>
                  <th className="border border-slate-400 px-1 py-1.5">Ghi chú</th>
                  <th className="border border-slate-400 px-1 py-1.5 text-center">Ngày xuất</th>
                  <th className="border border-slate-400 px-1 py-1.5 text-center">Sửa</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr><td colSpan={7} className="border border-slate-300 py-8 text-center text-slate-500">Đang tải lịch sử xuất kho...</td></tr>
                ) : exportHistory.length === 0 ? (
                  <tr><td colSpan={7} className="border border-slate-300 py-8 text-center text-slate-500">Chưa có lịch sử xuất kho khớp với tìm kiếm.</td></tr>
                ) : exportHistory.map((item, index) => (
                  <tr
                    key={item.trans_id}
                    onClick={() => {
                      setSelectedHistoryTransId(item.trans_id);
                      setSelectedInventoryRollId(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedHistoryTransId(item.trans_id);
                        setSelectedInventoryRollId(null);
                      }
                    }}
                    tabIndex={0}
                    aria-selected={selectedHistoryTransId === item.trans_id}
                    aria-label={`Chọn giao dịch xuất ${item.order_code || item.trans_id} cuộn ${item.roll_code}`}
                    className={`cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                      selectedHistoryTransId === item.trans_id
                        ? 'bg-[#dbeafe]'
                        : index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-[#f7f7f7] hover:bg-slate-50'
                    }`}
                  >
                    <td className="border border-slate-300 px-2 py-1.5">
                      <div className="font-semibold text-slate-900">{item.order_code || `GD #${item.trans_id}`}</div>
                      <div className="text-[10px] text-slate-500">#{item.trans_id}</div>
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-slate-700">{item.customer_name || '-'}</td>
                    <td className="border border-slate-300 px-2 py-1.5">
                      <div className="font-semibold text-blue-600">{item.roll_code}</div>
                      <div className="text-slate-500">{item.fabric_name}</div>
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right font-semibold text-slate-800">{Number(item.quantity).toFixed(2)} m</td>
                    <td className="max-w-xs truncate border border-slate-300 px-2 py-1.5 text-slate-600" title={item.note || ''}>{item.note || '-'}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">{new Date(item.transaction_date).toLocaleDateString('vi-VN')}</td>
                    <td className="border border-slate-300 px-1 py-1 text-center">
                      <button type="button" onClick={(event) => { event.stopPropagation(); startEditingHistory(item); }} title="Sửa giao dịch xuất" aria-label={`Sửa giao dịch ${item.trans_id}`} className="text-blue-600 hover:text-blue-800">
                        <Pencil className="mx-auto h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        {editingNoteIndex !== null && noteEditorPosition && typeof document !== 'undefined' && createPortal(
          <div
            ref={noteEditorRef}
            className="fixed z-[1100] rounded-md border border-blue-500 bg-white p-2 shadow-xl"
            style={{
              top: noteEditorPosition.top,
              left: noteEditorPosition.left,
              width: noteEditorPosition.width,
            }}
          >
            <div className="mb-1 text-xs font-semibold text-slate-700">
              Ghi chú dòng {editingNoteIndex + 1}
            </div>
            <textarea
              ref={noteTextareaRef}
              aria-label={`Nội dung ghi chú dòng ${editingNoteIndex + 1}`}
              value={rows[editingNoteIndex]?.note ?? ''}
              onChange={(event) => handleChangeRow(editingNoteIndex, 'note', event.target.value)}
              onBlur={() => {
                window.setTimeout(() => {
                  if (!noteEditorRef.current?.contains(document.activeElement)) {
                    setEditingNoteIndex(null);
                  }
                }, 0);
              }}
              rows={5}
              className="w-full resize-y rounded border border-slate-300 px-2 py-1.5 text-sm leading-5 text-slate-900 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>,
          document.body,
        )}
    </div>
  );
}