'use client';

import { Fragment, useCallback, useRef, useState, useEffect } from 'react';
import { Scissors, CheckCircle2, AlertCircle, RefreshCw, History, Table2, Search, ChevronLeft, ChevronRight, ChevronDown, Pencil, Save, X } from 'lucide-react';
import PageViewToggle, { type PageViewMode } from '../components/PageViewToggle';
import SearchableCombobox from '../components/SearchableCombobox';

interface FabricRoll {
  roll_id: number;
  roll_code: string;
  barcode?: string | null;
  fabric_name?: string;
  color_name?: string;
  quantity_remaining: string | number;
  quantity_initial: string | number;
  unit_name?: string;
  location_code?: string | null;
  location_name?: string;
  status: string;
}

interface CuttingHistory {
  cutting_id: number;
  cutting_date: string;
  return_completed_at: string | null;
  child_roll_code: string | null;
  child_roll_barcode: string | null;
  saving_roll_id: number | null;
  saving_roll_code: string | null;
  saving_roll_barcode: string | null;
  cut_quantity: string;
  used_quantity: string;
  returned_quantity: string;
  saving_quantity: string;
  remaining_quantity: string;
  note: string | null;
  parent_roll_code: string;
  fabric_name: string;
}

interface CuttingEditValues {
  issued_quantity: string;
  returned_quantity: string;
  is_saving: boolean;
  roll_code: string;
  barcode: string;
  note: string;
}

export default function CuttingPage() {
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const parentSearchRequestRef = useRef(0);
  const [rolls, setRolls] = useState<FabricRoll[]>([]);
  const [selectedRollCache, setSelectedRollCache] = useState<FabricRoll | null>(null);
  const [rollSearch, setRollSearch] = useState('');
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [history, setHistory] = useState<CuttingHistory[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFetching, setHistoryFetching] = useState(false);
  const [tableSelection, setTableSelection] = useState<'inventory' | 'history'>('history');
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  
  const [parentRollId, setParentRollId] = useState<string>('');
  const [cutQuantity, setCutQuantity] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [returningCutId, setReturningCutId] = useState<number | null>(null);
  const [returnQuantity, setReturnQuantity] = useState('');
  const [returnAsSaving, setReturnAsSaving] = useState(false);
  const [returnRollCode, setReturnRollCode] = useState('');
  const [returnBarcode, setReturnBarcode] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const [editingCutId, setEditingCutId] = useState<number | null>(null);
  const [cuttingEdit, setCuttingEdit] = useState<CuttingEditValues | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [viewMode, setViewMode] = useState<PageViewMode>('both');
  const [formWidth, setFormWidth] = useState(50);
  const showTableCard = viewMode !== 'entry';

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

  // Lấy danh sách cuộn vải và lịch sử cắt
  const fetchData = async (
    page = inventoryPage,
    search = rollSearch,
    targetHistoryPage = historyPage,
    searchHistory = historySearch
  ) => {
    setFetching(true);
    setHistoryFetching(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (search.trim()) params.set('search', search.trim());
      const historyParams = new URLSearchParams({ page: String(targetHistoryPage), pageSize: '50' });
      if (searchHistory.trim()) historyParams.set('search', searchHistory.trim());
      const [invRes, cutRes] = await Promise.all([
        fetch(`/api/inventory?${params}`),
        fetch(`/api/cutting?${historyParams}`)
      ]);

      const invJson = await invRes.json();
      const cutJson = await cutRes.json();

      if (!invRes.ok || !invJson.success) throw new Error(invJson.error || 'Không thể tải tồn kho.');
      if (!cutRes.ok || !cutJson.success) throw new Error(cutJson.error || 'Không thể tải lịch sử cắt.');
      setRolls(invJson.data || []);
      setInventoryTotal(invJson.pagination?.total ?? 0);
      setHistory(cutJson.data || []);
      setHistoryTotal(cutJson.pagination?.total ?? 0);
    } catch (err) {
      console.error('Lỗi nạp dữ liệu:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Không thể tải dữ liệu cắt vải.' });
    } finally {
      setFetching(false);
      setHistoryFetching(false);
    }
  };

  const changeInventoryPage = (page: number) => {
    setInventoryPage(page);
    fetchData(page);
  };

  const searchInventory = () => {
    setInventoryPage(1);
    fetchData(1);
  };

  const searchParentRolls = useCallback(async (query: string) => {
    setRollSearch(query);
    const requestId = ++parentSearchRequestRef.current;
    const params = new URLSearchParams({ page: '1', pageSize: '50' });
    if (query.trim()) params.set('search', query.trim());

    try {
      const response = await fetch(`/api/inventory?${params}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Không thể tìm cuộn mẹ.');
      }
      if (requestId === parentSearchRequestRef.current) {
        setRolls(json.data || []);
        setInventoryTotal(json.pagination?.total ?? 0);
        setInventoryPage(1);
      }
    } catch (error) {
      if (requestId === parentSearchRequestRef.current) {
        console.error('Lỗi tìm cuộn mẹ:', error);
        setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể tìm cuộn mẹ.' });
      }
    }
  }, []);

  const changeHistoryPage = (page: number) => {
    setHistoryPage(page);
    fetchData(inventoryPage, rollSearch, page);
  };

  const searchHistoryRecords = () => {
    setHistoryPage(1);
    fetchData(inventoryPage, rollSearch, 1, historySearch);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Tự động tạo mã cuộn con gợi ý khi chọn cuộn mẹ
  const handleSelectParent = (id: string) => {
    setParentRollId(id);
    const selected = rolls.find((r) => String(r.roll_id) === id)
      || (String(selectedRollCache?.roll_id) === id ? selectedRollCache : null);
    setSelectedRollCache(selected || null);
  };

  const selectedRoll = rolls.find((r) => String(r.roll_id) === parentRollId) || selectedRollCache;
  const currentQty = selectedRoll ? parseFloat(String(selectedRoll.quantity_remaining)) : 0;
  const cutQtyNum = parseFloat(cutQuantity) || 0;

  const openReturnForm = (item: CuttingHistory) => {
    setEditingCutId(null);
    setCuttingEdit(null);
    setReturningCutId(item.cutting_id);
    setReturnQuantity('');
    setReturnAsSaving(false);
    setReturnRollCode(`${item.parent_roll_code}-R${item.cutting_id}`);
    setReturnBarcode('');
  };

  const openCuttingEdit = (item: CuttingHistory) => {
    setReturningCutId(null);
    setEditingCutId(item.cutting_id);
    setCuttingEdit({
      issued_quantity: String(Number(item.cut_quantity)),
      returned_quantity: String(Number(item.returned_quantity)),
      is_saving: Boolean(item.saving_roll_id) || Number(item.saving_quantity) > 0,
      roll_code: item.child_roll_code || item.saving_roll_code || '',
      barcode: item.child_roll_barcode || item.saving_roll_barcode || '',
      note: item.note || '',
    });
  };

  const handleSaveCuttingEdit = async (item: CuttingHistory) => {
    if (!cuttingEdit) return;
    const issued = Number(cuttingEdit.issued_quantity);
    const returned = Number(cuttingEdit.returned_quantity);
    if (!Number.isFinite(issued) || issued <= 0 || !Number.isFinite(returned) || returned < 0 || returned > issued) {
      setMessage({ type: 'error', text: 'Số mang ra phải lớn hơn 0; số trả về không được vượt quá số mang ra.' });
      return;
    }
    if (returned > 0 && !cuttingEdit.roll_code.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập mã cuộn cho vải trả về.' });
      return;
    }

    setEditLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/cutting', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'correct',
          cutting_id: item.cutting_id,
          issued_quantity: issued,
          returned_quantity: returned,
          is_saving: cuttingEdit.is_saving,
          roll_code: cuttingEdit.roll_code.trim(),
          barcode: cuttingEdit.barcode.trim(),
          note: cuttingEdit.note,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể điều chỉnh lịch sử cắt.');
      setMessage({ type: 'success', text: json.message });
      setEditingCutId(null);
      setCuttingEdit(null);
      await fetchData();
    } catch (error) {
      console.error('Lỗi điều chỉnh lịch sử cắt:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể điều chỉnh lịch sử cắt.' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleRecordReturn = async (item: CuttingHistory) => {
    const quantity = Number(returnQuantity);
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > Number(item.cut_quantity) || (quantity > 0 && !returnRollCode.trim())) {
      setMessage({ type: 'error', text: 'Kiểm tra số mét trả về và mã cuộn. Số trả không được vượt quá số đã mang ra.' });
      return;
    }

    setReturnLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/cutting', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cutting_id: item.cutting_id,
          returned_quantity: quantity,
          is_saving: returnAsSaving,
          roll_code: returnRollCode.trim(),
          barcode: returnBarcode.trim() || undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể ghi nhận vải trả về.');
      setMessage({ type: 'success', text: json.message });
      setReturningCutId(null);
      setReturnQuantity('');
      setReturnRollCode('');
      setReturnBarcode('');
      await fetchData();
    } catch (error) {
      console.error('Lỗi ghi nhận vải trả về:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể ghi nhận vải trả về.' });
    } finally {
      setReturnLoading(false);
    }
  };

  const cuttingHistoryTable = historyFetching ? (
    <p className="py-6 text-center text-xs text-slate-400">Đang tải lịch sử cắt vải...</p>
  ) : history.length === 0 ? (
    <p className="py-6 text-center text-xs text-slate-400">Chưa có lịch sử cắt vải</p>
  ) : (
    <div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
          <tr>
            <th className="px-3 py-2.5">Mã cắt</th>
            <th className="px-3 py-2.5">Cuộn mẹ</th>
            <th className="px-3 py-2.5">Đầu khúc / tiết kiệm</th>
            <th className="px-3 py-2.5">Tên vải</th>
            <th className="px-3 py-2.5 text-right">Mang ra / dùng / trả</th>
            <th className="px-3 py-2.5 text-right">Tồn sau lần cắt</th>
            <th className="px-3 py-2.5">Ghi chú</th>
            <th className="px-3 py-2.5 text-center">Thời gian</th>
            <th className="px-3 py-2.5 text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {history.map((item) => (
            <Fragment key={item.cutting_id}>
              <tr className="hover:bg-slate-50">
                <td className="px-3 py-2.5 font-semibold text-slate-900">#{item.cutting_id}</td>
                <td className="px-3 py-2.5 font-medium text-blue-600">{item.parent_roll_code}</td>
                <td className="px-3 py-2.5 font-medium text-emerald-700">{Number(item.returned_quantity) > 0 ? [item.child_roll_code, item.saving_roll_code].filter(Boolean).join(' / ') || '-' : '-'}</td>
                <td className="px-3 py-2.5 text-slate-700">{item.fabric_name}</td>
                <td className="px-3 py-2.5 text-right text-slate-700">
                  {!item.return_completed_at
                    ? <>{parseFloat(item.cut_quantity)} / Chờ nhập / Chờ trả m</>
                    : <>{parseFloat(item.cut_quantity)} / {parseFloat(item.used_quantity)} / {parseFloat(item.returned_quantity)} m
                      {Number(item.saving_quantity) > 0 && <div className="text-[10px] text-emerald-700">Tiết kiệm {parseFloat(item.saving_quantity)} m</div>}
                    </>}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-800">{parseFloat(item.remaining_quantity)} m</td>
                <td className="px-3 py-2.5 text-slate-500">{item.note || '-'}</td>
                <td className="px-3 py-2.5 text-center text-slate-400">
                  {new Date(item.cutting_date).toLocaleDateString('vi-VN')}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    {item.return_completed_at
                      ? <span className="text-emerald-700">Đã hoàn tất</span>
                      : <button type="button" onClick={() => openReturnForm(item)} className="whitespace-nowrap rounded-lg bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-700 hover:bg-blue-100">Nhập vải trả</button>}
                    <button type="button" onClick={() => openCuttingEdit(item)} title={`Sửa lần cắt #${item.cutting_id}`} aria-label={`Sửa lần cắt #${item.cutting_id}`} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
              {returningCutId === item.cutting_id && !item.return_completed_at && (
                <tr>
                  <td colSpan={9} className="bg-slate-50 p-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label className="space-y-1 text-xs font-semibold text-slate-700">
                        Số mét thực tế còn lại
                        <input type="number" min="0" max={item.cut_quantity} step="0.001" value={returnQuantity} onChange={(event) => setReturnQuantity(event.target.value)} placeholder="Nhập sau khi làm xong" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
                      </label>
                      <label className="space-y-1 text-xs font-semibold text-slate-700">
                        Mã cuộn trả về
                        <input value={returnRollCode} onChange={(event) => setReturnRollCode(event.target.value)} disabled={Number(returnQuantity) === 0} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal disabled:bg-slate-100" />
                      </label>
                      <label className="space-y-1 text-xs font-semibold text-slate-700">
                        Barcode (không bắt buộc)
                        <input value={returnBarcode} onChange={(event) => setReturnBarcode(event.target.value)} disabled={Number(returnQuantity) === 0} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal disabled:bg-slate-100" />
                      </label>
                      <div className="flex flex-col justify-end gap-2">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                          <input type="checkbox" checked={returnAsSaving} onChange={(event) => setReturnAsSaving(event.target.checked)} disabled={Number(returnQuantity) === 0} />
                          Nhập vào tồn vải tiết kiệm
                        </label>
                        <p className="text-[11px] text-slate-500">Tích chọn nếu vải đã qua sản xuất; tồn tiết kiệm được quản lý riêng, không trộn với vải gốc.</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" onClick={() => setReturningCutId(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">Hủy</button>
                      <button type="button" onClick={() => handleRecordReturn(item)} disabled={returnLoading || returnQuantity === '' || (Number(returnQuantity) > 0 && !returnRollCode.trim())} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        {returnLoading ? 'Đang lưu...' : 'Xác nhận nhập lại'}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <span>Trang {historyPage} / {Math.max(1, Math.ceil(historyTotal / 50))} · {historyTotal.toLocaleString('vi-VN')} lần cắt</span>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => changeHistoryPage(Math.max(1, historyPage - 1))} disabled={historyFetching || historyPage <= 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50">
            <ChevronLeft className="h-4 w-4" /> Trước
          </button>
          <button type="button" onClick={() => changeHistoryPage(historyPage + 1)} disabled={historyFetching || historyPage >= Math.ceil(historyTotal / 50)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50">
            Sau <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentRollId) {
      setMessage({ type: 'error', text: 'Vui lòng tìm và chọn cuộn mẹ trước khi ghi nhận.' });
      return;
    }
    if (!Number.isFinite(cutQtyNum) || cutQtyNum <= 0) {
      setMessage({ type: 'error', text: 'Vui lòng nhập số lượng mang ra lớn hơn 0.' });
      return;
    }
    if (cutQtyNum > currentQty) {
      setMessage({ type: 'error', text: `Số lượng mang ra vượt quá tồn kho cuộn mẹ (${currentQty} ${selectedRoll?.unit_name || 'm'}).` });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/cutting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_roll_id: Number(parentRollId),
          issued_quantity: cutQtyNum,
          note: note || undefined,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setMessage({
          type: 'success',
          text: `Đã ghi nhận mang ra ${cutQtyNum}m. Khi hoàn thành sản xuất, nhập số vải thực tế còn lại ở lịch sử cắt. Cuộn mẹ còn ${json.data.parent_remaining_qty}m.`,
        });
        setCutQuantity('');
        setNote('');
        fetchData();
      } else {
        setMessage({ type: 'error', text: json.error || 'Có lỗi xảy ra khi cắt vải' });
      }
    } catch (err) {
      console.error('Lỗi cắt vải:', err);
      setMessage({ type: 'error', text: 'Không thể kết nối máy chủ' });
    } finally {
      setLoading(false);
    }
  };

  const editingCut = history.find((item) => item.cutting_id === editingCutId);

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cắt Vải & Tách Cuộn Con</h1>
          <p className="text-sm text-slate-500 mt-0.5">Trừ số lượng cuộn mẹ và tự động tạo cuộn con mới trong database</p>
        </div>
        <PageViewToggle
          mode={viewMode}
          onChange={(mode) => {
            setViewMode(mode);
            if (mode === 'table') setTableSelection('inventory');
          }}
        />
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div
        ref={splitContainerRef}
        style={{
          '--cutting-form-width': `${formWidth}fr`,
          '--cutting-table-width': `${100 - formWidth}fr`,
        } as React.CSSProperties}
        className={viewMode === 'both' && showTableCard
          ? 'grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(0,var(--cutting-form-width))_10px_minmax(0,var(--cutting-table-width))]'
          : 'space-y-6'}
      >
      {/* Form Cắt vải */}
      {viewMode !== 'table' && <form noValidate onSubmit={handleSubmit} className="min-w-0 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
            <Scissors className="w-5 h-5 text-blue-600" />
            <span>Thao tác tách cuộn</span>
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={fetching}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md transition-colors"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Chọn cuộn mẹ */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Chọn cuộn mẹ (parent_roll_id) <span className="text-rose-500">*</span>
            </label>
            <SearchableCombobox
              required
              ariaLabel="Cuộn mẹ"
              value={parentRollId}
              onChange={(id) => {
                setMessage(null);
                handleSelectParent(id);
              }}
              onQueryChange={searchParentRolls}
              placeholder="Tìm mã cuộn, barcode, tên vải..."
              options={[...rolls, ...(selectedRollCache && !rolls.some((roll) => roll.roll_id === selectedRollCache.roll_id) ? [selectedRollCache] : [])].map((roll) => ({
                value: String(roll.roll_id),
                label: `${roll.roll_code} | ${roll.fabric_name || 'Vải'} - Tồn: ${roll.quantity_remaining} ${roll.unit_name || 'm'}`,
              }))}
              className="px-3.5 py-2.5 pl-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Số lượng mang ra */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Số lượng mang ra khỏi kho <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                required
                min="0.001"
                max={currentQty || undefined}
                value={cutQuantity}
                onChange={(e) => {
                  setMessage(null);
                  setCutQuantity(e.target.value);
                }}
                placeholder="VD: 100"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Ghi chú (note)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập ghi chú hoặc lý do cắt..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
          >
            <Scissors className="w-4 h-4" />
            <span>{loading ? 'Đang ghi nhận...' : 'Ghi nhận mang vải ra cắt'}</span>
          </button>
        </div>
        {(!parentRollId || !cutQuantity || cutQtyNum <= 0 || cutQtyNum > currentQty) && (
          <p className="text-right text-xs text-slate-500">
            {!parentRollId
              ? 'Chọn cuộn mẹ trước khi ghi nhận.'
              : !cutQuantity || cutQtyNum <= 0
                ? 'Nhập số lượng mang ra lớn hơn 0.'
                : `Số lượng không được vượt quá tồn hiện tại (${currentQty} ${selectedRoll?.unit_name || 'm'}).`}
          </p>
        )}
      </form>}

      {viewMode === 'both' && showTableCard && (
        <div
          role="separator"
          aria-label="Điều chỉnh độ rộng giữa biểu mẫu và bảng tồn kho"
          aria-orientation="vertical"
          aria-valuemin={30}
          aria-valuemax={70}
          aria-valuenow={formWidth}
          tabIndex={0}
          onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const bounds = splitContainerRef.current?.getBoundingClientRect();
            if (!bounds || bounds.width === 0) return;
            const nextWidth = ((event.clientX - bounds.left) / bounds.width) * 100;
            setFormWidth(Math.min(70, Math.max(30, nextWidth)));
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') setFormWidth((width) => Math.max(30, width - 3));
            if (event.key === 'ArrowRight') setFormWidth((width) => Math.min(70, width + 3));
          }}
          className="hidden h-full min-h-40 cursor-col-resize touch-none items-center justify-center rounded-full outline-none hover:bg-blue-100 focus-visible:bg-blue-100 xl:flex"
          title="Kéo để thay đổi độ rộng form và bảng"
        >
          <span className="h-12 w-1 rounded-full bg-slate-300" />
        </div>
      )}

      {showTableCard && (
        <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {tableSelection === 'inventory' ? (
                <Table2 className="h-5 w-5 shrink-0 text-blue-600" />
              ) : (
                <History className="h-5 w-5 shrink-0 text-blue-600" />
              )}
              <div ref={tableMenuRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={tableMenuOpen}
                  aria-label={`Bảng đang xem: ${tableSelection === 'inventory' ? 'Tồn kho' : 'Lịch sử cắt vải'}. Chọn bảng`}
                  onClick={() => setTableMenuOpen((open) => !open)}
                  className="inline-flex max-w-full items-center gap-2 rounded-md py-1 text-left text-base font-semibold text-slate-900 transition-colors hover:text-blue-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span className="truncate">
                    {tableSelection === 'inventory'
                      ? `Bảng tồn kho (${inventoryTotal.toLocaleString('vi-VN')} cuộn)`
                      : 'Lịch sử cắt vải'}
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${tableMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {tableMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Chọn bảng hiển thị"
                    className="absolute left-0 top-full z-30 mt-2 min-w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                  >
                    {([
                      { value: 'inventory', label: `Bảng tồn kho (${inventoryTotal.toLocaleString('vi-VN')} cuộn)`, Icon: Table2 },
                      { value: 'history', label: 'Lịch sử cắt vải', Icon: History },
                    ] as const).map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        role="option"
                        aria-selected={tableSelection === value}
                        onClick={() => {
                          setTableSelection(value);
                          setTableMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                          tableSelection === value
                            ? 'bg-blue-50 font-semibold text-blue-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {tableSelection === 'inventory' ? 'Danh sách cuộn hiện có trong kho' : 'Nhật ký các lần cắt vải'}
                </p>
              </div>
            </div>
            {tableSelection === 'inventory' && (
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={rollSearch}
                  onChange={(event) => setRollSearch(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && searchInventory()}
                  placeholder="Tìm mã cuộn, barcode, tên vải..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs"
                />
              </div>
              <button type="button" onClick={searchInventory} disabled={fetching} className="rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:opacity-50">
                Tìm
              </button>
              <button
                type="button"
                onClick={() => fetchData()}
                disabled={fetching}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${fetching ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
            )}
            {tableSelection === 'history' && (
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && searchHistoryRecords()}
                    placeholder="Tìm mã cuộn, tên vải, ghi chú..."
                    className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs"
                  />
                </div>
                <button type="button" onClick={searchHistoryRecords} disabled={historyFetching} className="rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:opacity-50">
                  Tìm
                </button>
                <button
                  type="button"
                  onClick={() => fetchData()}
                  disabled={historyFetching}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${historyFetching ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>
            )}
            </div>
          </div>
          {tableSelection === 'inventory' ? (
          <>
          <div className="max-h-[75vh] flex-1 overflow-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-3">Mã cuộn</th>
                  <th className="px-3 py-3">Vải / Màu</th>
                  <th className="px-3 py-3">Vị trí</th>
                  <th className="px-3 py-3 text-right">Ban đầu</th>
                  <th className="px-3 py-3 text-right">Còn lại</th>
                  <th className="px-3 py-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fetching ? (
                  <tr><td colSpan={6} className="py-10 text-center text-slate-400">Đang tải bảng tồn kho...</td></tr>
                ) : rolls.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-slate-400">Chưa có cuộn vải trong kho.</td></tr>
                ) : rolls.map((roll) => (
                  <tr key={roll.roll_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{roll.roll_code}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{roll.barcode || 'Chưa có barcode'}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-800">{roll.fabric_name || 'Chưa phân loại'}</div>
                      <div className="text-[10px] text-slate-500">{roll.color_name || 'Mặc định'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{roll.location_code || roll.location_name || 'Chưa xếp kệ'}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{roll.quantity_initial} {roll.unit_name || 'm'}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-blue-600">
                      {Number(roll.quantity_remaining).toFixed(2)} {roll.unit_name || 'm'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        roll.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {roll.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>Trang {inventoryPage} / {Math.max(1, Math.ceil(inventoryTotal / 50))} · {inventoryTotal.toLocaleString('vi-VN')} cuộn</span>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => changeInventoryPage(Math.max(1, inventoryPage - 1))} disabled={fetching || inventoryPage <= 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50">
                <ChevronLeft className="h-4 w-4" /> Trước
              </button>
              <button type="button" onClick={() => changeInventoryPage(inventoryPage + 1)} disabled={fetching || inventoryPage >= Math.ceil(inventoryTotal / 50)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50">
                Sau <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          </>
          ) : (
            <div className="max-h-[75vh] flex-1 overflow-auto">{cuttingHistoryTable}</div>
          )}
        </section>
      )}

      </div>
      {editingCut && cuttingEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveCuttingEdit(editingCut);
            }}
            className="my-8 w-full max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Sửa lịch sử cắt vải</h2>
                <p className="mt-1 text-xs text-slate-500">Lần cắt #{editingCut.cutting_id} · Cuộn mẹ {editingCut.parent_roll_code}</p>
              </div>
              <button
                type="button"
                onClick={() => { setEditingCutId(null); setCuttingEdit(null); }}
                disabled={editLoading}
                aria-label="Đóng"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Số mét mang ra
                <input type="number" min="0.001" step="0.001" required value={cuttingEdit.issued_quantity} onChange={(event) => setCuttingEdit({ ...cuttingEdit, issued_quantity: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Số mét trả về
                <input type="number" min="0" step="0.001" required value={cuttingEdit.returned_quantity} onChange={(event) => setCuttingEdit({ ...cuttingEdit, returned_quantity: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Mã cuộn trả về
                <input value={cuttingEdit.roll_code} onChange={(event) => setCuttingEdit({ ...cuttingEdit, roll_code: event.target.value })} disabled={Number(cuttingEdit.returned_quantity) === 0} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal disabled:bg-slate-100" />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Barcode
                <input value={cuttingEdit.barcode} onChange={(event) => setCuttingEdit({ ...cuttingEdit, barcode: event.target.value })} disabled={Number(cuttingEdit.returned_quantity) === 0} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal disabled:bg-slate-100" />
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium text-slate-700">
                <input type="checkbox" checked={cuttingEdit.is_saving} onChange={(event) => setCuttingEdit({ ...cuttingEdit, is_saving: event.target.checked })} disabled={Number(cuttingEdit.returned_quantity) === 0} />
                Phân loại là vải tiết kiệm
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700 sm:col-span-2">
                Ghi chú
                <textarea maxLength={1000} rows={3} value={cuttingEdit.note} onChange={(event) => setCuttingEdit({ ...cuttingEdit, note: event.target.value })} className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">Ngày cắt không thể chỉnh sửa. Nếu tồn cuộn mẹ hoặc cuộn trả về đã được chuyển/dùng sau lần cắt, hệ thống sẽ từ chối thay đổi ảnh hưởng tồn kho.</p>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => { setEditingCutId(null); setCuttingEdit(null); }} disabled={editLoading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:opacity-50">
                Hủy
              </button>
              <button type="submit" disabled={editLoading || (Number(cuttingEdit.returned_quantity) > 0 && !cuttingEdit.roll_code.trim())} className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Save className="h-4 w-4" /> {editLoading ? 'Đang lưu...' : 'Lưu điều chỉnh'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}