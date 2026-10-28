'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeftRight, CheckCircle2, AlertCircle, RefreshCw, MapPin, History, ChevronLeft, ChevronRight, Pencil, Save, X } from 'lucide-react';
import { createCatalogOption } from '@/lib/catalog-client';
import PageViewToggle, { type PageViewMode } from '../../components/PageViewToggle';
import SearchableCombobox from '../../components/SearchableCombobox';

interface ShelfOption {
  shelf_id: number;
  shelf_code: string;
  shelf_name: string | null;
  warehouse_code: string;
}

interface FabricRoll {
  roll_id: number;
  roll_code: string;
  fabric_name?: string;
  quantity_remaining: string | number;
  unit_name?: string;
  location_id?: number;
  location_name?: string;
}

interface LocationItem {
  location_id: number;
  location_code: string;
  location_name?: string;
}

interface TransactionLog {
  trans_id: number;
  roll_code: string;
  fabric_name: string;
  quantity: string;
  from_location: string;
  to_location: string;
  transaction_date: string;
  note: string;
}

interface TransferEdit {
  trans_id: number;
  to_location_id: string;
  note: string;
}

export default function LocationTransferPage() {
  const [rolls, setRolls] = useState<FabricRoll[]>([]);
  const [selectedRollCache, setSelectedRollCache] = useState<FabricRoll | null>(null);
  const [rollSearch, setRollSearch] = useState('');
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [inventoryPage, setInventoryPage] = useState(1);
  const inventorySearchRequestRef = useRef(0);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
  const [history, setHistory] = useState<TransactionLog[]>([]);

  const [selectedRollId, setSelectedRollId] = useState<string>('');
  const [newLocationId, setNewLocationId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [viewMode, setViewMode] = useState<PageViewMode>('both');

  const [loading, setLoading] = useState(false);
  const [savingTransferId, setSavingTransferId] = useState<number | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<TransferEdit | null>(null);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async (page = inventoryPage, search = rollSearch) => {
    setFetching(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (search.trim()) params.set('search', search.trim());
      const [invRes, locRes, transRes, catalogRes] = await Promise.all([
        fetch(`/api/inventory?${params}`),
        fetch('/api/locations'),
        fetch('/api/transactions?type=TRANSFER'),
        fetch('/api/catalog?kind=locations'),
      ]);

      const invJson = await invRes.json();
      const locJson = await locRes.json();
      const transJson = await transRes.json();
      const catalogJson = await catalogRes.json();

      if (!invRes.ok || !invJson.success) throw new Error(invJson.error || 'Không thể tải tồn kho.');
      if (!locRes.ok || !locJson.success) throw new Error(locJson.error || 'Không thể tải vị trí kho.');
      if (!transRes.ok || !transJson.success) throw new Error(transJson.error || 'Không thể tải lịch sử điều chuyển.');
      if (!catalogRes.ok || !catalogJson.success) throw new Error(catalogJson.error || 'Không thể tải danh sách kệ.');
      setRolls(invJson.data || []);
      setInventoryTotal(invJson.pagination?.total ?? 0);
      setLocations(locJson.data || []);
      setShelves(catalogJson.shelves || []);
      setHistory(transJson.data || []);
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    } finally {
      setFetching(false);
    }
  };

  const changeInventoryPage = (page: number) => {
    setInventoryPage(page);
    fetchData(page);
  };

  const searchInventoryRolls = useCallback(async (query: string) => {
    const requestId = ++inventorySearchRequestRef.current;
    setRollSearch(query);
    setInventoryPage(1);
    setFetching(true);

    try {
      const params = new URLSearchParams({ page: '1', pageSize: '50' });
      if (query.trim()) params.set('search', query.trim());
      const response = await fetch(`/api/inventory?${params}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Không thể tìm cuộn vải.');
      }
      if (requestId === inventorySearchRequestRef.current) {
        setRolls(json.data || []);
        setInventoryTotal(json.pagination?.total ?? 0);
      }
    } catch (error) {
      if (requestId === inventorySearchRequestRef.current) {
        console.error('Lỗi tìm cuộn vải:', error);
        setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể tìm cuộn vải.' });
      }
    } finally {
      if (requestId === inventorySearchRequestRef.current) setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const selectedRoll = rolls.find((r) => String(r.roll_id) === selectedRollId) || selectedRollCache;

  const addLocation = async (name: string, fields: Record<string, string>) => {
    const option = await createCatalogOption('locations', name, fields);
    setLocations((current) => [...current, {
      location_id: Number(option.value),
      location_code: name,
      location_name: name,
    }].sort((left, right) => left.location_code.localeCompare(right.location_code, 'vi')));
    return option;
  };
  const locationCreateFields = [{
    name: 'shelf_id',
    label: 'Kệ',
    required: true,
    options: shelves.map((shelf) => ({
      value: String(shelf.shelf_id),
      label: `${shelf.warehouse_code} / ${shelf.shelf_code}${shelf.shelf_name ? ` - ${shelf.shelf_name}` : ''}`,
    })),
  }];

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
    if (!selectedRollId) {
      setMessage({ type: 'error', text: 'Vui lòng tìm và chọn cuộn vải cần đổi kệ.' });
      return;
    }
    if (!newLocationId) {
      setMessage({ type: 'error', text: 'Vui lòng chọn kệ lưu trữ mới.' });
      return;
    }

  setLoading(true);
  setMessage(null);

  try {
    const res = await fetch('/api/locations/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roll_id: Number(selectedRollId),
        to_location_id: Number(newLocationId),
        note,
      }),
    });

    const json = await res.json();

    if (json.success) {
      setMessage({ type: 'success', text: json.message });
      setSelectedRollId('');
      setNewLocationId('');
      setNote('');
      fetchData(); // Tải lại danh sách tồn kho & nhật ký giao dịch
    } else {
      setMessage({ type: 'error', text: json.error || 'Có lỗi xảy ra' });
    }
  } catch {
    setMessage({ type: 'error', text: 'Không thể kết nối máy chủ' });
  } finally {
    setLoading(false);
  }
};

  const startEditingTransfer = (item: TransactionLog) => {
    const location = locations.find((entry) => entry.location_code === item.to_location);
    setEditingTransfer({
      trans_id: item.trans_id,
      to_location_id: location ? String(location.location_id) : '',
      note: item.note || '',
    });
  };

  const handleSaveTransfer = async () => {
    if (!editingTransfer) return;
    setSavingTransferId(editingTransfer.trans_id);
    setMessage(null);

    try {
      const res = await fetch('/api/locations/transfer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trans_id: editingTransfer.trans_id,
          to_location_id: Number(editingTransfer.to_location_id),
          note: editingTransfer.note,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setMessage({ type: 'error', text: json.error || 'Không thể cập nhật giao dịch.' });
        return;
      }

      setMessage({ type: 'success', text: json.message || 'Đã cập nhật giao dịch điều chuyển.' });
      setEditingTransfer(null);
      await fetchData();
    } catch {
      setMessage({ type: 'error', text: 'Không thể kết nối máy chủ' });
    } finally {
      setSavingTransferId(null);
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Điều Chuyển Vị Trí Kệ</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cập nhật vị trí lưu kho mới và lưu vết giao dịch TRANSFER</p>
        </div>
        <PageViewToggle mode={viewMode} onChange={setViewMode} />
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

      <div className={viewMode === 'both' ? 'grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2' : 'space-y-6'}>
      {viewMode !== 'table' && <form noValidate onSubmit={handleSubmit} className="min-w-0 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            <span>Thao tác đổi kệ lưu trữ</span>
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={fetching}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:text-slate-800"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Chọn cuộn vải <span className="text-rose-500">*</span>
            </label>
            <SearchableCombobox
              required
              ariaLabel="Cuộn cần chuyển vị trí"
              value={selectedRollId}
              onChange={(rollId) => {
                setMessage(null);
                const selected = rolls.find((roll) => String(roll.roll_id) === rollId)
                  || (String(selectedRollCache?.roll_id) === rollId ? selectedRollCache : null);
                setSelectedRollCache(selected || null);
                setSelectedRollId(rollId);
              }}
              onQueryChange={searchInventoryRolls}
              placeholder="Tìm mã cuộn, tên vải hoặc vị trí..."
              options={[...rolls, ...(selectedRollCache && !rolls.some((roll) => roll.roll_id === selectedRollCache.roll_id) ? [selectedRollCache] : [])].map((roll) => ({
                value: String(roll.roll_id),
                label: `${roll.roll_code} | ${roll.fabric_name || 'Vải'} - Vị trí hiện tại: ${roll.location_name || 'Chưa xếp kệ'}`,
              }))}
              className="px-3.5 py-2.5 pl-9 text-sm"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Trang {inventoryPage} / {Math.max(1, Math.ceil(inventoryTotal / 50))} · {inventoryTotal.toLocaleString('vi-VN')} cuộn</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => changeInventoryPage(Math.max(1, inventoryPage - 1))} disabled={fetching || inventoryPage <= 1} className="inline-flex items-center gap-1 rounded border px-2 py-1 disabled:opacity-50">
                  <ChevronLeft className="h-3.5 w-3.5" /> Trước
                </button>
                <button type="button" onClick={() => changeInventoryPage(inventoryPage + 1)} disabled={fetching || inventoryPage >= Math.ceil(inventoryTotal / 50)} className="inline-flex items-center gap-1 rounded border px-2 py-1 disabled:opacity-50">
                  Sau <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {selectedRoll && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm text-blue-800">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Kệ hiện tại của <strong>{selectedRoll.roll_code}</strong>: <strong>{selectedRoll.location_name || 'Chưa xếp kệ'}</strong>
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Chọn kệ lưu trữ mới <span className="text-rose-500">*</span>
            </label>
            <SearchableCombobox
              required
              ariaLabel="Vị trí kệ đích"
              value={newLocationId}
              onChange={(locationId) => {
                setMessage(null);
                setNewLocationId(locationId);
              }}
              placeholder="Tìm vị trí kệ..."
              createFields={locationCreateFields}
              onCreateOption={addLocation}
              options={locations.map((location) => ({
                value: String(location.location_id),
                label: `${location.location_code} (${location.location_name || 'Kệ kho'})`,
              }))}
              className="px-3.5 py-2.5 pl-9 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Ghi chú điều chuyển
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Sắp xếp lại dãy A, dời kệ ưu tiên cắt..."
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
            <ArrowLeftRight className="w-4 h-4" />
            <span>{loading ? 'Đang ghi nhận Transaction...' : 'Xác nhận Đổi Kệ'}</span>
          </button>
        </div>
        {(!selectedRollId || !newLocationId) && (
          <p className="text-right text-xs text-slate-500">
            {!selectedRollId ? 'Chọn cuộn vải trước khi xác nhận.' : 'Chọn kệ lưu trữ mới trước khi xác nhận.'}
          </p>
        )}
      </form>}

      {/* Nhật ký di chuyển kệ */}
      {viewMode !== 'entry' && (
      <div className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2 text-slate-900 font-semibold text-base border-b border-slate-100 pb-3">
          <History className="w-5 h-5 text-slate-600" />
          <span>Nhật ký di chuyển kệ (inventory_transactions)</span>
        </div>

        {history.length === 0 ? (
          <p className="flex flex-1 items-center justify-center py-6 text-center text-xs text-slate-400">Chưa có lịch sử chuyển vị trí kệ</p>
        ) : (
          <div className="max-h-[75vh] flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-xs">
                <tr>
                  <th className="py-2.5 px-3">Mã GD</th>
                  <th className="py-2.5 px-3">Mã cuộn</th>
                  <th className="py-2.5 px-3">Tên vải</th>
                  <th className="py-2.5 px-3 text-center">Kệ cũ</th>
                  <th className="py-2.5 px-3 text-center">Kệ mới</th>
                  <th className="py-2.5 px-3">Ghi chú</th>
                  <th className="py-2.5 px-3 text-center">Thời gian</th>
                  <th className="py-2.5 px-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {history.map((item) => (
                  <tr key={item.trans_id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">#{item.trans_id}</td>
                    <td className="py-2.5 px-3 font-medium text-blue-600">{item.roll_code}</td>
                    <td className="py-2.5 px-3 text-slate-700">{item.fabric_name}</td>
                    <td className="py-2.5 px-3 text-center text-slate-500">{item.from_location || 'Chưa có'}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-600">{item.to_location}</td>
                    <td className="py-2.5 px-3 text-slate-500">{item.note || '-'}</td>
                    <td className="py-2.5 px-3 text-center text-slate-400">
                      {new Date(item.transaction_date).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => startEditingTransfer(item)}
                        disabled={savingTransferId !== null || !locations.length}
                        className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        title="Sửa giao dịch điều chuyển"
                        aria-label={`Sửa giao dịch ${item.trans_id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
      </div>

    {editingTransfer && (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSaveTransfer();
        }}
        className="my-8 w-full max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Sửa giao dịch điều chuyển</h2>
            <p className="mt-1 text-xs text-slate-500">Mã giao dịch #{editingTransfer.trans_id}; ngày điều chuyển không thay đổi.</p>
          </div>
          <button
            type="button"
            onClick={() => setEditingTransfer(null)}
            disabled={savingTransferId === editingTransfer.trans_id}
            aria-label="Đóng"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="block space-y-1 text-xs font-semibold text-slate-700">
          Vị trí kệ mới <span className="text-rose-500">*</span>
          <select
            required
            value={editingTransfer.to_location_id}
            onChange={(event) => setEditingTransfer({ ...editingTransfer, to_location_id: event.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
          >
            <option value="">Chọn vị trí</option>
            {locations.map((location) => (
              <option key={location.location_id} value={location.location_id}>
                {location.location_code} ({location.location_name || 'Kệ kho'})
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-xs font-semibold text-slate-700">
          Ghi chú
          <textarea
            rows={3}
            maxLength={1000}
            value={editingTransfer.note}
            onChange={(event) => setEditingTransfer({ ...editingTransfer, note: event.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
          />
        </label>
        {message?.type === 'error' && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{message.text}</p>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setEditingTransfer(null)}
            disabled={savingTransferId === editingTransfer.trans_id}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={savingTransferId === editingTransfer.trans_id || !editingTransfer.to_location_id}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {savingTransferId === editingTransfer.trans_id ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
    )}
    </div>
  );
}