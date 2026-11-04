'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Scissors, CheckCircle2, AlertCircle, RefreshCw, Search, ChevronLeft, ChevronRight, Pencil, Save, X } from 'lucide-react';
import type { PageViewMode } from '../components/PageViewToggle';
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
  stock_type?: string | null;
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
  additional_remnant_note: string | null;
  additional_saving_note: string | null;
  remaining_quantity: string;
  note: string | null;
  parent_roll_code: string;
  fabric_name: string;
}

interface CuttingEditValues {
  issued_quantity: string;
  note: string;
}

export default function CuttingPage() {
  const parentSearchRequestRef = useRef(0);
  const [rolls, setRolls] = useState<FabricRoll[]>([]);
  const [selectedRollCache, setSelectedRollCache] = useState<FabricRoll | null>(null);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [history, setHistory] = useState<CuttingHistory[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFetching, setHistoryFetching] = useState(false);
  const [tableSelection, setTableSelection] = useState<'inventory' | 'history'>('history');
  
  const [parentRollId, setParentRollId] = useState<string>('');
  const [cutQuantity, setCutQuantity] = useState<string>('');
  const [useRemnantRoll, setUseRemnantRoll] = useState(false);
  const [remnantRollId, setRemnantRollId] = useState('');
  const [remnantRollCache, setRemnantRollCache] = useState<FabricRoll | null>(null);
  const [remnantQuantity, setRemnantQuantity] = useState('');
  const [remnantAvailability, setRemnantAvailability] = useState<'idle' | 'loading' | 'available' | 'unavailable'>('idle');
  const [useSavingRoll, setUseSavingRoll] = useState(false);
  const [savingRollId, setSavingRollId] = useState('');
  const [savingRollCache, setSavingRollCache] = useState<FabricRoll | null>(null);
  const [savingQuantity, setSavingQuantity] = useState('');
  const [savingAvailability, setSavingAvailability] = useState<'idle' | 'loading' | 'available' | 'unavailable'>('idle');
  const additionalRollRequestRef = useRef(0);
  const [note, setNote] = useState<string>('');
  const [editingCutId, setEditingCutId] = useState<number | null>(null);
  const [cuttingEdit, setCuttingEdit] = useState<CuttingEditValues | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [viewMode] = useState<PageViewMode>('both');
  const showTableCard = viewMode !== 'entry';
  const initialSearchRender = useRef(true);

  // Lấy danh sách cuộn vải và lịch sử cắt
  const fetchData = async (
    page = inventoryPage,
    search = inventorySearch,
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

  const searchParentRolls = useCallback(async (query: string) => {
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
    fetchData(inventoryPage, inventorySearch, page);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (initialSearchRender.current) {
      initialSearchRender.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      setInventoryPage(1);
      setHistoryPage(1);
      void fetchData(1, inventorySearch, 1, historySearch);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [inventorySearch, historySearch]);

  // Tự động tạo mã cuộn con gợi ý khi chọn cuộn mẹ
  const handleSelectParent = async (id: string) => {
    setParentRollId(id);
    const selected = rolls.find((r) => String(r.roll_id) === id)
      || (String(selectedRollCache?.roll_id) === id ? selectedRollCache : null);
    setSelectedRollCache(selected || null);
    setUseRemnantRoll(false);
    setUseSavingRoll(false);
    setRemnantRollId('');
    setSavingRollId('');
    setRemnantRollCache(null);
    setSavingRollCache(null);
    setRemnantQuantity('');
    setSavingQuantity('');
    const requestId = ++additionalRollRequestRef.current;
    if (!selected || !id) {
      setRemnantAvailability('idle');
      setSavingAvailability('idle');
      return;
    }

    setRemnantAvailability('loading');
    setSavingAvailability('loading');
    try {
      const lookup = async (stockType: 'REMNANT' | 'SAVING') => {
        const params = new URLSearchParams({
          page: '1',
          pageSize: '10',
          status: 'ACTIVE',
          stockType,
          exactRollCode: selected.roll_code,
        });
        const response = await fetch(`/api/inventory?${params}`, { cache: 'no-store' });
        const json = await response.json();
        if (!response.ok || !json.success) {
          throw new Error(json.error || `Không thể kiểm tra tồn ${stockType === 'REMNANT' ? 'đầu khúc' : 'tiết kiệm'}.`);
        }
        return (json.data || []) as FabricRoll[];
      };
      const [remnantMatches, savingMatches] = await Promise.all([
        lookup('REMNANT'),
        lookup('SAVING'),
      ]);
      if (requestId !== additionalRollRequestRef.current) return;

      const remnantMatch = remnantMatches.find((roll) => roll.roll_code === selected.roll_code) || null;
      const savingMatch = savingMatches.find((roll) => roll.roll_code === selected.roll_code) || null;
      setRemnantRollCache(remnantMatch);
      setSavingRollCache(savingMatch);
      setRemnantRollId(remnantMatch ? String(remnantMatch.roll_id) : '');
      setSavingRollId(savingMatch ? String(savingMatch.roll_id) : '');
      setRemnantAvailability(remnantMatch ? 'available' : 'unavailable');
      setSavingAvailability(savingMatch ? 'available' : 'unavailable');
    } catch (error) {
      if (requestId !== additionalRollRequestRef.current) return;
      console.error('Lỗi kiểm tra cuộn đầu khúc/tiết kiệm cùng mã:', error);
      setRemnantAvailability('unavailable');
      setSavingAvailability('unavailable');
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể kiểm tra tồn đầu khúc/tiết kiệm.' });
    }
  };

  const selectedRoll = rolls.find((r) => String(r.roll_id) === parentRollId) || selectedRollCache;
  const currentQty = selectedRoll ? parseFloat(String(selectedRoll.quantity_remaining)) : 0;
  const cutQtyNum = parseFloat(cutQuantity) || 0;
  const selectedRemnantRoll = String(remnantRollCache?.roll_id) === remnantRollId ? remnantRollCache : null;
  const selectedSavingRoll = String(savingRollCache?.roll_id) === savingRollId ? savingRollCache : null;

  const openCuttingEdit = (item: CuttingHistory) => {
    setEditingCutId(item.cutting_id);
    setCuttingEdit({
      issued_quantity: String(Number(item.cut_quantity)),
      note: item.note || '',
    });
  };

  const handleSaveCuttingEdit = async (item: CuttingHistory) => {
    if (!cuttingEdit) return;
    const issued = Number(cuttingEdit.issued_quantity);
    const returned = Number(item.returned_quantity);
    if (!Number.isFinite(issued) || issued <= 0 || !Number.isFinite(returned) || returned < 0 || returned > issued) {
      setMessage({ type: 'error', text: 'Số mang ra phải lớn hơn 0 và không được thấp hơn số đã ghi nhận còn lại.' });
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
          is_saving: Boolean(item.saving_roll_id) || Number(item.saving_quantity) > 0,
          roll_code: item.child_roll_code || item.saving_roll_code || '',
          barcode: item.child_roll_barcode || item.saving_roll_barcode || '',
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

  const cuttingHistoryTable = historyFetching ? (
    <p className="py-6 text-center text-xs text-slate-400">Đang tải lịch sử cắt vải...</p>
  ) : history.length === 0 ? (
    <p className="py-6 text-center text-xs text-slate-400">Chưa có lịch sử cắt vải</p>
  ) : (
    <div className="bg-white">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-left text-[11px]">
        <thead className="sticky top-0 z-10 bg-gradient-to-b from-slate-100 to-slate-300 text-[10px] font-semibold uppercase text-slate-700">
          <tr>
            <th className="border border-slate-400 px-1 py-1.5">Mã cắt</th>
            <th className="border border-slate-400 px-1 py-1.5">Cuộn mẹ</th>
            <th className="border border-slate-400 px-1 py-1.5">Đầu khúc</th>
            <th className="border border-slate-400 px-1 py-1.5">Tiết kiệm</th>
            <th className="border border-slate-400 px-1 py-1.5">Tên vải</th>
            <th className="border border-slate-400 px-1 py-1.5 text-right">Số lượng mang ra</th>
            <th className="border border-slate-400 px-1 py-1.5 text-right">Tồn sau lần cắt</th>
            <th className="border border-slate-400 px-1 py-1.5">Ghi chú</th>
            <th className="border border-slate-400 px-1 py-1.5 text-center">Thời gian</th>
            <th className="border border-slate-400 px-1 py-1.5 text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody className="text-[11px]">
          {history.map((item, index) => (
              <tr key={item.cutting_id} className={index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-[#f7f7f7] hover:bg-slate-50'}>
                <td className="border border-slate-300 px-2 py-1.5 font-semibold text-slate-900">#{item.cutting_id}</td>
                <td className="border border-slate-300 px-2 py-1.5 font-medium text-blue-600">{item.parent_roll_code}</td>
                <td className="max-w-48 border border-slate-300 px-2 py-1.5 font-medium text-amber-700" title={item.additional_remnant_note || item.child_roll_code || undefined}>
                  {[item.child_roll_code, item.additional_remnant_note].filter(Boolean).join(' / ') || '-'}
                </td>
                <td className="max-w-48 border border-slate-300 px-2 py-1.5 font-medium text-emerald-700" title={item.additional_saving_note || item.saving_roll_code || undefined}>
                  {[item.saving_roll_code, item.additional_saving_note].filter(Boolean).join(' / ') || '-'}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-slate-700">{item.fabric_name}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-right text-slate-700">
                  {Number(item.cut_quantity) > 0 ? `${parseFloat(item.cut_quantity)} m` : 'Chỉ lấy nguồn phụ'}
                </td>
                <td className="border border-slate-300 px-2 py-1.5 text-right text-slate-800">{parseFloat(item.remaining_quantity)} m</td>
                <td className="max-w-40 truncate border border-slate-300 px-2 py-1.5 text-slate-500" title={item.note || ''}>{item.note || '-'}</td>
                <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">
                  {new Date(item.cutting_date).toLocaleDateString('vi-VN')}
                </td>
                <td className="border border-slate-300 px-1 py-1 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {Number(item.cut_quantity) > 0 && (
                      <button type="button" onClick={() => openCuttingEdit(item)} title={`Sửa lần cắt #${item.cutting_id}`} aria-label={`Sửa lần cắt #${item.cutting_id}`} className="border border-slate-300 bg-white p-1 text-blue-600 hover:bg-blue-50">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentRollId) {
      setMessage({ type: 'error', text: 'Vui lòng tìm và chọn cuộn mẹ trước khi ghi nhận.' });
      return;
    }
    const hasAdditionalSource = useRemnantRoll || useSavingRoll;
    if (!Number.isFinite(cutQtyNum) || cutQtyNum < 0 || (cutQtyNum === 0 && !hasAdditionalSource)) {
      setMessage({ type: 'error', text: 'Vui lòng nhập số lượng mang ra lớn hơn 0.' });
      return;
    }
    if (cutQtyNum > 0 && cutQtyNum > currentQty) {
      setMessage({ type: 'error', text: `Số lượng mang ra vượt quá tồn kho cuộn mẹ (${currentQty} ${selectedRoll?.unit_name || 'm'}).` });
      return;
    }
    if (useRemnantRoll && (!selectedRemnantRoll || selectedRemnantRoll.roll_code !== selectedRoll?.roll_code || Number(remnantQuantity) <= 0 || Number(remnantQuantity) > Number(selectedRemnantRoll.quantity_remaining))) {
      setMessage({ type: 'error', text: 'Vui lòng chọn cuộn đầu khúc và nhập số mét hợp lệ trong giới hạn tồn kho.' });
      return;
    }
    if (useSavingRoll && (!selectedSavingRoll || selectedSavingRoll.roll_code !== selectedRoll?.roll_code || Number(savingQuantity) <= 0 || Number(savingQuantity) > Number(selectedSavingRoll.quantity_remaining))) {
      setMessage({ type: 'error', text: 'Vui lòng chọn cuộn tiết kiệm và nhập số mét hợp lệ trong giới hạn tồn kho.' });
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
          additional_rolls: [
            ...(useRemnantRoll ? [{
              roll_id: Number(remnantRollId),
              quantity: Number(remnantQuantity),
              stock_type: 'REMNANT',
            }] : []),
            ...(useSavingRoll ? [{
              roll_id: Number(savingRollId),
              quantity: Number(savingQuantity),
              stock_type: 'SAVING',
            }] : []),
          ],
          note: note || undefined,
        }),
      });

      const json = await res.json();

      if (json.success) {
        const additionalSources = [
          useRemnantRoll && `${remnantQuantity}m đầu khúc`,
          useSavingRoll && `${savingQuantity}m vải tiết kiệm`,
        ].filter(Boolean);
        setMessage({
          type: 'success',
          text: cutQtyNum > 0
            ? `Đã ghi nhận mang ra ${cutQtyNum}m${additionalSources.length ? `, lấy thêm ${additionalSources.join(' và ')}` : ''}. Vải thừa sau khi cắt, nhập tại mục Nhập kho. Cuộn mẹ còn ${json.data.parent_remaining_qty}m.`
            : `Đã ghi nhận lấy ${additionalSources.join(' và ')}. Không trừ tồn cuộn mẹ.`,
        });
        setCutQuantity('');
        setUseRemnantRoll(false);
        setRemnantRollId('');
        setRemnantRollCache(null);
        setRemnantQuantity('');
        setUseSavingRoll(false);
        setSavingRollId('');
        setSavingRollCache(null);
        setSavingQuantity('');
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
    <div className="mx-auto max-w-screen-2xl space-y-4">
      <div className="flex flex-col gap-2 border border-slate-400 bg-gradient-to-b from-slate-100 to-slate-300 px-3 py-2 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-sm font-bold text-slate-900">Cắt vải &amp; Tách cuộn</h1>
          <p className="mt-0.5 text-[11px] text-slate-600">Ghi nhận vải mang ra cắt; vải thừa nhập tại mục Nhập kho</p>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 border px-3 py-2 text-xs font-medium ${
            message.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-rose-300 bg-rose-50 text-rose-800'
          }`}
        >
          {message.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            : <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-0">
      {viewMode !== 'table' && <form noValidate onSubmit={handleSubmit} className="order-2 min-w-0 overflow-hidden border-x border-b border-slate-400 bg-[#f5f5f5] shadow-md">
        <div className="flex items-center justify-between border-b border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-800">
            <Scissors className="h-3.5 w-3.5 text-blue-700" />
            <span>Thao tác tách cuộn</span>
          </div>
        </div>

        <div className="grid items-end gap-2 p-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,2fr)_minmax(150px,1fr)_minmax(180px,1.3fr)_minmax(130px,auto)_minmax(150px,auto)]">
          <div className="min-w-0">
            <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-700">
              Chọn cuộn mẹ <span className="text-rose-600">*</span>
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
              showSearchIcon={false}
              showChevron={false}
              className="!h-7 !rounded-none !border-slate-300 !py-1 !pl-2 !pr-2 !text-[11px] !font-medium !text-slate-900"
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-700">
              Số lượng mang ra <span className="text-rose-600">*</span>
            </label>
            <input
              type="number"
              step="0.001"
              required={!useRemnantRoll && !useSavingRoll}
              min={useRemnantRoll || useSavingRoll ? '0' : '0.001'}
              max={currentQty || undefined}
              value={cutQuantity}
              onChange={(event) => {
                setMessage(null);
                setCutQuantity(event.target.value);
              }}
              placeholder={useRemnantRoll || useSavingRoll
                ? `Có thể để trống nếu chỉ lấy nguồn phụ (tồn ${currentQty} ${selectedRoll?.unit_name || 'm'})`
                : `Số lượng (tồn ${currentQty} ${selectedRoll?.unit_name || 'm'})`}
              className="h-7 w-full border border-slate-300 bg-white px-2 text-[11px] text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-700">Ghi chú</label>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nhập ghi chú hoặc lý do cắt..."
              className="h-7 w-full border border-slate-300 bg-white px-2 text-[11px] text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex min-h-7 items-center">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={useRemnantRoll}
                disabled={remnantAvailability !== 'available'}
                onChange={(event) => {
                  setUseRemnantRoll(event.target.checked);
                  if (!event.target.checked) {
                    setRemnantQuantity('');
                  }
                }}
              />
              {remnantAvailability === 'loading'
                ? 'Đang kiểm tra đầu khúc...'
                : remnantAvailability === 'unavailable'
                  ? 'Không có đầu khúc cùng mã'
                  : 'Lấy thêm từ đầu khúc'}
            </label>
          </div>
          <div className="flex min-h-7 items-center">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={useSavingRoll}
                disabled={savingAvailability !== 'available'}
                onChange={(event) => {
                  setUseSavingRoll(event.target.checked);
                  if (!event.target.checked) {
                    setSavingQuantity('');
                  }
                }}
              />
              {savingAvailability === 'loading'
                ? 'Đang kiểm tra vải tiết kiệm...'
                : savingAvailability === 'unavailable'
                  ? 'Không có vải tiết kiệm cùng mã'
                  : 'Lấy thêm từ vải tiết kiệm'}
            </label>
          </div>
        </div>

        {(useRemnantRoll || useSavingRoll) && (
          <div className="grid gap-2 px-2 pb-2 sm:grid-cols-2">
            {useRemnantRoll && (
              <div className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(110px,1fr)] items-end gap-2 border border-amber-200 bg-amber-50/60 p-2">
              <div className="min-w-0">
                <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-700">Cuộn đầu khúc (cùng mã cuộn mẹ)</label>
                <input
                  aria-label="Cuộn đầu khúc"
                  readOnly
                  value={selectedRemnantRoll ? `${selectedRemnantRoll.roll_code} | Tồn: ${selectedRemnantRoll.quantity_remaining} ${selectedRemnantRoll.unit_name || 'm'}` : ''}
                  className="h-7 w-full cursor-not-allowed border border-slate-300 bg-slate-100 px-2 text-[11px] text-slate-700"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-700">Số mét lấy</label>
                <input
                  aria-label="Số mét lấy từ đầu khúc"
                  type="number"
                  min="0.001"
                  step="0.001"
                  max={selectedRemnantRoll?.quantity_remaining || undefined}
                  value={remnantQuantity}
                  onChange={(event) => setRemnantQuantity(event.target.value)}
                  placeholder={`Tồn ${selectedRemnantRoll?.quantity_remaining || 0} m`}
                  className="h-7 w-full border border-slate-300 bg-white px-2 text-[11px] text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
              </div>
            )}
            {useSavingRoll && (
              <div className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(110px,1fr)] items-end gap-2 border border-emerald-200 bg-emerald-50/60 p-2">
              <div className="min-w-0">
                <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-700">Cuộn tiết kiệm (cùng mã cuộn mẹ)</label>
                <input
                  aria-label="Cuộn tiết kiệm"
                  readOnly
                  value={selectedSavingRoll ? `${selectedSavingRoll.roll_code} | Tồn: ${selectedSavingRoll.quantity_remaining} ${selectedSavingRoll.unit_name || 'm'}` : ''}
                  className="h-7 w-full cursor-not-allowed border border-slate-300 bg-slate-100 px-2 text-[11px] text-slate-700"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-700">Số mét lấy</label>
                <input
                  aria-label="Số mét lấy từ vải tiết kiệm"
                  type="number"
                  min="0.001"
                  step="0.001"
                  max={selectedSavingRoll?.quantity_remaining || undefined}
                  value={savingQuantity}
                  onChange={(event) => setSavingQuantity(event.target.value)}
                  placeholder={`Tồn ${selectedSavingRoll?.quantity_remaining || 0} m`}
                  className="h-7 w-full border border-slate-300 bg-white px-2 text-[11px] text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-nowrap items-center justify-between gap-2 border-t border-white bg-gradient-to-b from-slate-100 to-slate-300 px-2 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {showTableCard && (
              <>
                <span className="shrink-0 text-[10px] text-slate-600">
                  Trang {tableSelection === 'inventory' ? inventoryPage : historyPage}/{Math.max(1, Math.ceil((tableSelection === 'inventory' ? inventoryTotal : historyTotal) / 50))}
                </span>
                <button
                  type="button"
                  onClick={() => tableSelection === 'inventory'
                    ? changeInventoryPage(Math.max(1, inventoryPage - 1))
                    : changeHistoryPage(Math.max(1, historyPage - 1))}
                  disabled={tableSelection === 'inventory' ? fetching || inventoryPage <= 1 : historyFetching || historyPage <= 1}
                  aria-label="Trang trước"
                  className="flex h-7 shrink-0 items-center border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-1.5 disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => tableSelection === 'inventory'
                    ? changeInventoryPage(inventoryPage + 1)
                    : changeHistoryPage(historyPage + 1)}
                  disabled={tableSelection === 'inventory'
                    ? fetching || inventoryPage >= Math.ceil(inventoryTotal / 50)
                    : historyFetching || historyPage >= Math.ceil(historyTotal / 50)}
                  aria-label="Trang sau"
                  className="flex h-7 shrink-0 items-center border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-1.5 disabled:opacity-50"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <span className="h-6 shrink-0 border-l border-slate-400" />
              </>
            )}
            <p className="min-w-0 truncate text-[10px] text-slate-600">
              {!parentRollId
                ? 'Chọn cuộn mẹ trước khi ghi nhận.'
                : !cutQuantity || cutQtyNum <= 0
                  ? 'Nhập số lượng mang ra lớn hơn 0.'
                  : cutQtyNum > currentQty
                    ? `Số lượng không được vượt quá tồn hiện tại (${currentQty} ${selectedRoll?.unit_name || 'm'}).`
                    : 'Kiểm tra thông tin trước khi ghi nhận.'}
            </p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex h-8 shrink-0 items-center justify-center gap-1.5 border border-rose-800 bg-gradient-to-b from-rose-500 to-rose-700 px-3 text-xs font-bold text-white shadow-sm hover:from-rose-600 hover:to-rose-800 disabled:opacity-50"
          >
            <Scissors className="h-4 w-4" />
            <span>{loading ? 'Đang ghi nhận...' : 'Ghi nhận mang vải ra cắt'}</span>
          </button>
        </div>
      </form>}

      {showTableCard && (
        <section className="order-1 flex h-full min-w-0 flex-col overflow-hidden border border-slate-400 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div role="tablist" aria-label="Bảng cắt vải" className="flex flex-nowrap items-end gap-1">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tableSelection === 'inventory'}
                  onClick={() => setTableSelection('inventory')}
                  className={`shrink-0 border px-2.5 py-1.5 text-[11px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    tableSelection === 'inventory'
                      ? 'relative z-10 -mb-px border-slate-400 border-b-white bg-white font-semibold text-slate-900'
                      : 'border-slate-300 bg-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tồn kho ({inventoryTotal.toLocaleString('vi-VN')})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tableSelection === 'history'}
                  onClick={() => setTableSelection('history')}
                  className={`shrink-0 border px-2.5 py-1.5 text-[11px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    tableSelection === 'history'
                      ? 'relative z-10 -mb-px border-slate-400 border-b-white bg-white font-semibold text-slate-900'
                      : 'border-slate-300 bg-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Lịch sử cắt ({historyTotal.toLocaleString('vi-VN')})
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-600">
                {tableSelection === 'inventory' ? 'Danh sách cuộn hiện có trong kho' : 'Nhật ký các lần cắt vải'}
              </p>
            </div>
            {tableSelection === 'inventory' && (
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={inventorySearch}
                  onChange={(event) => setInventorySearch(event.target.value)}
                  placeholder="Tìm mã cuộn, barcode, tên vải..."
                  aria-label="Tìm cuộn tồn kho"
                  className="h-7 w-full min-w-0 border border-slate-400 bg-white pl-7 pr-2 text-[11px] text-slate-900 shadow-inner focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={() => fetchData()}
                disabled={fetching}
                className="flex h-7 shrink-0 items-center gap-1 border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 text-[11px] font-semibold text-slate-800 hover:to-slate-300 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${fetching ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
            )}
            {tableSelection === 'history' && (
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                    placeholder="Tìm mã cuộn, tên vải, ghi chú..."
                    aria-label="Tìm lịch sử cắt"
                    className="h-7 w-full min-w-0 border border-slate-400 bg-white pl-7 pr-2 text-[11px] text-slate-900 shadow-inner focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchData()}
                  disabled={historyFetching}
                  className="flex h-7 shrink-0 items-center gap-1 border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 text-[11px] font-semibold text-slate-800 hover:to-slate-300 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${historyFetching ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>
            )}
          </div>
          {tableSelection === 'inventory' ? (
          <>
          <div className="max-h-[54vh] flex-1 overflow-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-gradient-to-b from-slate-100 to-slate-300 text-[10px] font-semibold uppercase text-slate-700">
                <tr>
                  <th className="border border-slate-400 px-1 py-1.5">Mã cuộn</th>
                  <th className="border border-slate-400 px-1 py-1.5">Vải / Màu</th>
                  <th className="border border-slate-400 px-1 py-1.5">Vị trí</th>
                  <th className="border border-slate-400 px-1 py-1.5 text-right">Ban đầu</th>
                  <th className="border border-slate-400 px-1 py-1.5 text-right">Còn lại</th>
                  <th className="border border-slate-400 px-1 py-1.5 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {fetching ? (
                  <tr><td colSpan={6} className="border border-slate-300 py-8 text-center text-slate-500">Đang tải bảng tồn kho...</td></tr>
                ) : rolls.length === 0 ? (
                  <tr><td colSpan={6} className="border border-slate-300 py-8 text-center text-slate-500">Chưa có cuộn vải trong kho.</td></tr>
                ) : rolls.map((roll, index) => (
                  <tr key={roll.roll_id} className={index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-[#f7f7f7] hover:bg-slate-50'}>
                    <td className="border border-slate-300 px-2 py-1.5">
                      <div className="font-semibold text-slate-900">{roll.roll_code}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{roll.barcode || 'Chưa có barcode'}</div>
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5">
                      <div className="font-medium text-slate-800">{roll.fabric_name || 'Chưa phân loại'}</div>
                      <div className="text-[10px] text-slate-500">{roll.color_name || 'Mặc định'}</div>
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-slate-600">{roll.location_code || roll.location_name || 'Chưa xếp kệ'}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right text-slate-600">{roll.quantity_initial} {roll.unit_name || 'm'}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-right font-semibold text-blue-600">
                      {Number(roll.quantity_remaining).toFixed(2)} {roll.unit_name || 'm'}
                    </td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center">
                      <span className={`border px-1.5 py-0.5 text-[10px] font-semibold ${
                        roll.status === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}>
                        {roll.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
          ) : (
            <div className="max-h-[75vh] flex-1 overflow-auto">{cuttingHistoryTable}</div>
          )}
          {viewMode === 'table' && (
            <div className="flex flex-nowrap items-center justify-between gap-2 border-t border-white bg-gradient-to-b from-slate-100 to-slate-300 px-2 py-1.5 text-[10px] text-slate-600">
              <span className="shrink-0">
                Trang {tableSelection === 'inventory' ? inventoryPage : historyPage}/{Math.max(1, Math.ceil((tableSelection === 'inventory' ? inventoryTotal : historyTotal) / 50))}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => tableSelection === 'inventory'
                    ? changeInventoryPage(Math.max(1, inventoryPage - 1))
                    : changeHistoryPage(Math.max(1, historyPage - 1))}
                  disabled={tableSelection === 'inventory' ? fetching || inventoryPage <= 1 : historyFetching || historyPage <= 1}
                  aria-label="Trang trước"
                  className="flex h-7 items-center border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-1.5 disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => tableSelection === 'inventory'
                    ? changeInventoryPage(inventoryPage + 1)
                    : changeHistoryPage(historyPage + 1)}
                  disabled={tableSelection === 'inventory'
                    ? fetching || inventoryPage >= Math.ceil(inventoryTotal / 50)
                    : historyFetching || historyPage >= Math.ceil(historyTotal / 50)}
                  aria-label="Trang sau"
                  className="flex h-7 items-center border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-1.5 disabled:opacity-50"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
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
              <label className="space-y-1 text-xs font-semibold text-slate-700 sm:col-span-2">
                Ghi chú
                <textarea maxLength={1000} rows={3} value={cuttingEdit.note} onChange={(event) => setCuttingEdit({ ...cuttingEdit, note: event.target.value })} className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">Ngày cắt không thể chỉnh sửa. Nếu tồn cuộn mẹ đã phát sinh giao dịch sau lần cắt, hệ thống sẽ từ chối thay đổi ảnh hưởng tồn kho.</p>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => { setEditingCutId(null); setCuttingEdit(null); }} disabled={editLoading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:opacity-50">
                Hủy
              </button>
              <button type="submit" disabled={editLoading} className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Save className="h-4 w-4" /> {editLoading ? 'Đang lưu...' : 'Lưu điều chỉnh'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}