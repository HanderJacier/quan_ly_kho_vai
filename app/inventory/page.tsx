'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, AlertTriangle, Filter, RefreshCw, ChevronLeft, ChevronRight, Archive, Pencil, Save, X } from 'lucide-react';
import { FabricRoll, MasterItem } from '@/lib/types';
import { createCatalogOption, type CatalogCreateKind } from '@/lib/catalog-client';
import SearchableCombobox from '../components/SearchableCombobox';
import type { SearchableComboboxCreateField } from '../components/SearchableCombobox';

interface RollEditForm {
  roll_code: string;
  lot_code: string;
  supplier_name: string;
  barcode: string;
  fabric_id: string;
  color_id: string;
  type_id: string;
  location_id: string;
  unit_id: string;
  quantity_initial: string;
  quantity_remaining: string;
  stock_type: 'REGULAR' | 'REMNANT' | 'SAVING';
  note: string;
}

interface ShelfOption {
  shelf_id: number;
  shelf_code: string;
  shelf_name: string | null;
  warehouse_code: string;
}

function InventoryContent() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [rolls, setRolls] = useState<FabricRoll[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [appliedSearch, setAppliedSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;
  const [masterData, setMasterData] = useState<Record<'fabrics' | 'colors' | 'types' | 'locations' | 'units', MasterItem[]>>({
    fabrics: [],
    colors: [],
    types: [],
    locations: [],
    units: [],
  });
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
  const [customers, setCustomers] = useState<Array<{ customer_id: number; customer_code: string; customer_name: string }>>([]);
  const [editingRoll, setEditingRoll] = useState<FabricRoll | null>(null);
  const [editForm, setEditForm] = useState<RollEditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchInventory = async (targetPage = page, searchTerm = appliedSearch) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pageSize),
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (includeArchived) params.set('includeArchived', 'true');

      const res = await fetch(`/api/inventory?${params}`);
      const json = await res.json();
      if (json.success) {
        setRolls(json.data || []);
        setTotal(json.pagination?.total ?? json.data?.length ?? 0);
      }
    } catch (err) {
      console.error('Lỗi tải tồn kho:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadInventory = async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
        if (statusFilter) params.set('status', statusFilter);
        if (includeArchived) params.set('includeArchived', 'true');
        const response = await fetch(`/api/inventory?${params}`);
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || 'Không thể tải tồn kho.');
        if (!cancelled) {
          setRolls(json.data || []);
          setTotal(json.pagination?.total ?? json.data?.length ?? 0);
        }
      } catch (error) {
        console.error('Lỗi tải tồn kho:', error);
        if (!cancelled) setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Không thể tải tồn kho.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadInventory();
    return () => { cancelled = true; };
  }, [appliedSearch, statusFilter, includeArchived, page]);

  useEffect(() => {
    Promise.all([
      fetch('/api/fabrics/master'),
      fetch('/api/catalog?kind=locations'),
      fetch('/api/customers'),
    ])
      .then(async ([masterResponse, catalogResponse, customerResponse]) => {
        const [masterJson, catalogJson, customerJson] = await Promise.all([
          masterResponse.json(),
          catalogResponse.json(),
          customerResponse.json(),
        ]);
        if (!masterResponse.ok || !masterJson.success) throw new Error(masterJson.error || 'Không thể tải danh mục.');
        if (!catalogResponse.ok || !catalogJson.success) throw new Error(catalogJson.error || 'Không thể tải danh sách kệ.');
        if (!customerResponse.ok || !customerJson.success) throw new Error(customerJson.error || 'Không thể tải khách hàng.');
        setMasterData(masterJson.data);
        setShelves(catalogJson.shelves || []);
        setCustomers(customerJson.data || []);
      })
      .catch((error: unknown) => {
        console.error('Lỗi tải danh mục sửa cuộn:', error);
        setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Không thể tải danh mục để sửa cuộn.' });
      });
  }, []);

  const addCatalogItem = async (kind: Exclude<CatalogCreateKind, 'customers'>, name: string, fields: Record<string, string>) => {
    const option = await createCatalogOption(kind, name, fields);
    const newItem: MasterItem = {
      id: Number(option.value),
      name,
      ...(fields.code ? { code: fields.code } : {}),
    };
    setMasterData((current) => ({
      ...current,
      [kind]: [...current[kind], newItem].sort((left, right) => left.name.localeCompare(right.name, 'vi')),
    }));
    return option;
  };

  const catalogCreateFields = (kind: Exclude<CatalogCreateKind, 'customers'>): SearchableComboboxCreateField[] => (
    kind === 'locations'
      ? [{
          name: 'shelf_id',
          label: 'Kệ',
          required: true,
          options: shelves.map((shelf) => ({
            value: String(shelf.shelf_id),
            label: `${shelf.warehouse_code} / ${shelf.shelf_code}${shelf.shelf_name ? ` - ${shelf.shelf_name}` : ''}`,
          })),
        }]
      : kind === 'fabrics'
        ? [
            { name: 'code', label: 'Mã vải', required: true },
            {
              name: 'customer_id',
              label: 'Khách hàng',
              options: customers.map((customer) => ({
                value: String(customer.customer_id),
                label: `${customer.customer_name} (${customer.customer_code})`,
              })),
            },
          ]
        : [{ name: 'code', label: 'Mã danh mục', required: true }]
  );

  const beginEdit = (roll: FabricRoll) => {
    setEditingRoll(roll);
    setNotice(null);
    setEditForm({
      roll_code: roll.roll_code,
      lot_code: roll.lot_code || '',
      supplier_name: roll.supplier_name || '',
      barcode: roll.barcode || '',
      fabric_id: String(roll.fabric_id),
      color_id: roll.color_id ? String(roll.color_id) : '',
      type_id: roll.type_id ? String(roll.type_id) : '',
      location_id: roll.location_id ? String(roll.location_id) : '',
      unit_id: roll.unit_id ? String(roll.unit_id) : '',
      quantity_initial: String(roll.quantity_initial),
      quantity_remaining: String(roll.quantity_remaining),
      stock_type: roll.stock_type === 'SAVING' || roll.stock_type === 'REMNANT' ? roll.stock_type : 'REGULAR',
      note: roll.note || '',
    });
  };

  const changeInitialQuantity = (quantity_initial: string) => {
    if (!editForm) return;
    const difference = Number(quantity_initial) - Number(editForm.quantity_initial);
    const quantity_remaining = Number.isFinite(difference)
      ? String(Math.max(0, Number(editForm.quantity_remaining) + difference))
      : editForm.quantity_remaining;
    setEditForm({ ...editForm, quantity_initial, quantity_remaining });
  };

  const saveRoll = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingRoll || !editForm) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll_id: editingRoll.roll_id, ...editForm }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể cập nhật cuộn.');
      setEditingRoll(null);
      setEditForm(null);
      setNotice({ type: 'success', text: json.message || 'Đã cập nhật cuộn vải.' });
      await fetchInventory();
    } catch (error) {
      console.error('Lỗi cập nhật cuộn:', error);
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Không thể cập nhật cuộn.' });
    } finally {
      setSaving(false);
    }
  };

  const restoreRoll = async (roll: FabricRoll) => {
    setNotice(null);
    try {
      const response = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll_id: roll.roll_id, is_archived: false }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể khôi phục cuộn.');
      setNotice({ type: 'success', text: json.message || 'Đã khôi phục cuộn.' });
      await fetchInventory();
    } catch (error) {
      console.error('Lỗi khôi phục cuộn:', error);
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Không thể khôi phục cuộn.' });
    }
  };

  const handleSearch = () => {
    setLoading(true);
    setAppliedSearch(search);
    if (page !== 1) {
      setPage(1);
    } else {
      fetchInventory(1, search);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const isOverTwoYears = (inboundDate: string | null) => {
    if (!inboundDate) return false;
    const inbound = new Date(inboundDate).getTime();
    const now = new Date().getTime();
    const diffDays = (now - inbound) / (1000 * 3600 * 24);
    return diffDays > 730;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header trang */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản Lý Tồn Kho Vải</h1>
          <p className="text-sm text-slate-500 mt-0.5">Theo dõi số lượng, vị trí kệ và cảnh báo thời gian lưu kho</p>
        </div>
        <button
          onClick={() => void fetchInventory()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs self-start"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {notice && (
        <div className={`rounded-xl border p-3 text-sm ${
          notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}>{notice.text}</div>
      )}

      {/* Bộ lọc & Tìm kiếm nhanh */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            placeholder="Lọc theo mã cuộn, tên vải, kệ..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setLoading(true);
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">ACTIVE (Còn hàng)</option>
            <option value="EXPIRED">EXPIRED (Quá hạn)</option>
            <option value="OUT_OF_STOCK">OUT_OF_STOCK (Hết hàng)</option>
          </select>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={includeArchived} onChange={(event) => {
            setLoading(true);
            setIncludeArchived(event.target.checked);
          }} />
          Hiện cuộn đã lưu trữ
        </label>
      </div>

      {/* Bảng dữ liệu tồn kho */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-xs">
              <tr>
                <th className="py-3 px-4">Mã Cuộn / Lô / Barcode</th>
                <th className="py-3 px-4">Tên Vải & Màu</th>
                <th className="py-3 px-4 text-center">Vị trí Kệ</th>
                <th className="py-3 px-4 text-right">Ban đầu</th>
                <th className="py-3 px-4 text-right">Còn lại</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-center">Ngày nhập / hết hạn</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    Đang tải dữ liệu tồn kho...
                  </td>
                </tr>
              ) : rolls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    Không tìm thấy cuộn vải nào trong kho.
                  </td>
                </tr>
              ) : (
                rolls.map((roll) => {
                  const qtyRemaining = Number(roll.quantity_remaining) || 0;
                  const isOld = isOverTwoYears(roll.inbound_date);

                  return (
                    <tr key={roll.roll_id} className={`${roll.is_archived ? 'bg-slate-50 opacity-70' : 'hover:bg-slate-50/80'} transition-colors`}>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{roll.roll_code}</div>
                        <div className="text-xs text-slate-500">{roll.lot_code ? `Lô ${roll.lot_code} · ` : ''}{roll.barcode || 'Chưa có barcode'}</div>
                        {roll.supplier_name && <div className="text-xs text-slate-400">{roll.supplier_name}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{roll.fabric_name || 'Chưa phân loại'}</div>
                        <div className="text-xs text-slate-500">
                          {roll.color_name || 'Mặc định'} • {roll.type_name || 'Loại chuẩn'}
                        </div>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          roll.stock_type === 'SAVING'
                            ? 'bg-amber-50 text-amber-800'
                            : roll.stock_type === 'REMNANT'
                              ? 'bg-violet-50 text-violet-800'
                              : 'bg-slate-100 text-slate-700'
                        }`}>
                          {roll.stock_type === 'SAVING' ? 'Vải tiết kiệm' : roll.stock_type === 'REMNANT' ? 'Đầu khúc' : 'Vải thường'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                          {roll.location_code || roll.location_name || 'Chưa xếp kệ'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        {roll.quantity_initial} {roll.unit_name || 'm'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-blue-600">
                        {qtyRemaining.toFixed(2)} {roll.unit_name || 'm'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {roll.is_archived ? (
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">Đã lưu trữ</span>
                          ) : <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              roll.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : roll.status === 'EXPIRED'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {roll.status}
                          </span>}
                          {isOld && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium" title="Lưu kho trên 2 năm">
                              <AlertTriangle className="w-3 h-3" /> {'>'} 2 năm
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-slate-500">
                        {roll.inbound_date ? new Date(roll.inbound_date).toLocaleDateString('vi-VN') : '-'}
                        <div className="text-slate-400">{roll.expiry_date ? `HSD ${new Date(roll.expiry_date).toLocaleDateString('vi-VN')}` : 'Chưa có hạn'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => beginEdit(roll)} disabled={Boolean(roll.is_archived)} title="Sửa thông tin cuộn" className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-30">
                            <Pencil className="h-4 w-4" />
                          </button>
                          {Boolean(roll.is_archived) && (
                            <button type="button" onClick={() => void restoreRoll(roll)} title="Khôi phục cuộn" aria-label={`Khôi phục ${roll.roll_code}`} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50">
                              <Archive className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Đang xem {total === 0 ? 0 : (page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, total)} trong {total.toLocaleString('vi-VN')} cuộn
          </span>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setPage((current) => Math.max(1, current - 1));
              }}
              disabled={loading || page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Trước
            </button>
            <span className="min-w-24 text-center">
              Trang {page} / {Math.max(totalPages, 1)}
            </span>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setPage((current) => current + 1);
              }}
              disabled={loading || page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sau
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {editingRoll && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4">
          <form onSubmit={saveRoll} className="my-8 w-full max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Sửa thông tin cuộn</h2>
                <p className="mt-1 text-xs text-slate-500">Thay đổi tồn sẽ được ghi thêm vào nhật ký điều chỉnh.</p>
              </div>
              <button type="button" onClick={() => { setEditingRoll(null); setEditForm(null); }} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            {notice?.type === 'error' && <p className="text-sm text-rose-700">{notice.text}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <EditField label="Mã cuộn" value={editForm.roll_code} onChange={(roll_code) => setEditForm({ ...editForm, roll_code })} maxLength={100} required />
              <EditField label="Mã lô" value={editForm.lot_code} onChange={(lot_code) => setEditForm({ ...editForm, lot_code })} maxLength={100} />
              <EditField label="Nhà cung cấp / nơi nhập" value={editForm.supplier_name} onChange={(supplier_name) => setEditForm({ ...editForm, supplier_name })} maxLength={160} />
              <EditField label="Barcode" value={editForm.barcode} onChange={(barcode) => setEditForm({ ...editForm, barcode })} maxLength={150} />
              <CatalogSelect
                label="Loại vải"
                value={editForm.fabric_id}
                options={masterData.fabrics}
                fallbackOption={{ id: editingRoll.fabric_id, name: editingRoll.fabric_name || 'Danh mục đã ngừng' }}
                onChange={(fabric_id) => setEditForm({ ...editForm, fabric_id })}
                createFields={catalogCreateFields('fabrics')}
                onCreateOption={(name, fields) => addCatalogItem('fabrics', name, fields)}
                required
              />
              <CatalogSelect
                label="Màu"
                value={editForm.color_id}
                options={masterData.colors}
                fallbackOption={editingRoll.color_id ? { id: editingRoll.color_id, name: editingRoll.color_name || 'Danh mục đã ngừng' } : undefined}
                onChange={(color_id) => setEditForm({ ...editForm, color_id })}
                createFields={catalogCreateFields('colors')}
                onCreateOption={(name, fields) => addCatalogItem('colors', name, fields)}
              />
              <CatalogSelect
                label="Phân loại"
                value={editForm.type_id}
                options={masterData.types}
                fallbackOption={editingRoll.type_id ? { id: editingRoll.type_id, name: editingRoll.type_name || 'Danh mục đã ngừng' } : undefined}
                onChange={(type_id) => setEditForm({ ...editForm, type_id })}
                createFields={catalogCreateFields('types')}
                onCreateOption={(name, fields) => addCatalogItem('types', name, fields)}
              />
              <CatalogSelect
                label="Vị trí"
                value={editForm.location_id}
                options={masterData.locations}
                fallbackOption={editingRoll.location_id ? { id: editingRoll.location_id, name: editingRoll.location_name || editingRoll.location_code || 'Danh mục đã ngừng' } : undefined}
                onChange={(location_id) => setEditForm({ ...editForm, location_id })}
                createFields={catalogCreateFields('locations')}
                onCreateOption={(name, fields) => addCatalogItem('locations', name, fields)}
              />
              <CatalogSelect
                label="Đơn vị"
                value={editForm.unit_id}
                options={masterData.units}
                fallbackOption={editingRoll.unit_id ? { id: editingRoll.unit_id, name: editingRoll.unit_name || 'Danh mục đã ngừng' } : undefined}
                onChange={(unit_id) => setEditForm({ ...editForm, unit_id })}
                createFields={catalogCreateFields('units')}
                onCreateOption={(name, fields) => addCatalogItem('units', name, fields)}
              />
              <EditField
                label="Số lượng ban đầu"
                type="number"
                value={editForm.quantity_initial}
                onChange={changeInitialQuantity}
                required
              />
              <EditField
                label="Số lượng còn lại"
                type="number"
                value={editForm.quantity_remaining}
                onChange={(quantity_remaining) => setEditForm({ ...editForm, quantity_remaining })}
                required
              />
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Phân loại tồn kho
                <select
                  value={editForm.stock_type}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === 'REGULAR' || value === 'SAVING' || value === 'REMNANT') {
                      setEditForm({ ...editForm, stock_type: value });
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
                >
                  <option value="REGULAR">Vải thường</option>
                  <option value="SAVING">Vải tiết kiệm</option>
                  <option value="REMNANT">Đầu khúc</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700 sm:col-span-2">
                Ghi chú
                <textarea value={editForm.note} onChange={(event) => setEditForm({ ...editForm, note: event.target.value })} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
              </label>
            </div>
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              Nếu sửa số lượng còn lại, hệ thống sẽ ghi giao dịch điều chỉnh để nhật ký vẫn theo dõi được thay đổi.
            </p>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => { setEditingRoll(null); setEditForm(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700">Hủy</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function EditField({ label, value, onChange, type = 'text', required = false, maxLength }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'date' | 'number';
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="space-y-1 text-xs font-semibold text-slate-700">
      {label}
      <input type={type} step={type === 'number' ? '0.001' : undefined} min={type === 'number' ? '0' : undefined} maxLength={maxLength} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
    </label>
  );
}

function CatalogSelect({ label, value, options, fallbackOption, onChange, createFields, onCreateOption, required = false }: {
  label: string;
  value: string;
  options: MasterItem[];
  fallbackOption?: MasterItem;
  onChange: (value: string) => void;
  createFields: SearchableComboboxCreateField[];
  onCreateOption: (name: string, fields: Record<string, string>) => Promise<{ value: string; label: string }>;
  required?: boolean;
}) {
  const availableOptions = fallbackOption && !options.some((option) => option.id === fallbackOption.id)
    ? [...options, fallbackOption]
    : options;
  return (
    <label className="space-y-1 text-xs font-semibold text-slate-700">
      {label}
      <SearchableCombobox
        ariaLabel={label}
        value={value}
        onChange={onChange}
        createFields={createFields}
        onCreateOption={onCreateOption}
        required={required}
        placeholder={`Tìm ${label.toLowerCase()}...`}
        options={availableOptions.map((option) => ({
          value: String(option.id),
          label: option.code ? `${option.name} (${option.code})` : option.name,
        }))}
      />
    </label>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-slate-400">Đang tải trang tồn kho...</div>}>
      <InventoryContent />
    </Suspense>
  );
}