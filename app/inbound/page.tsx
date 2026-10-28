'use client';

import { useState, useEffect } from 'react';
import {
  PackagePlus,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Table2,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import { MasterItem } from '@/lib/types';
import { createCatalogOption, type CatalogCreateKind } from '@/lib/catalog-client';
import PageViewToggle, { type PageViewMode } from '../components/PageViewToggle';
import SearchableCombobox from '../components/SearchableCombobox';
import RollLabelPrinter, { type RollLabelData } from '../components/RollLabelPrinter';

interface ShelfOption {
  shelf_id: number;
  shelf_code: string;
  shelf_name: string | null;
  warehouse_code: string;
}

interface InventoryRoll {
  roll_id: number;
  roll_code: string;
  barcode?: string | null;
  lot_code?: string | null;
  supplier_name?: string | null;
  fabric_name?: string | null;
  color_name?: string | null;
  type_name?: string | null;
  location_id: number | null;
  location_code?: string | null;
  location_name?: string | null;
  quantity_initial: number | string;
  quantity_remaining: number | string;
  inbound_date: string;
  status: string;
  fabric_id: number;
  color_id: number | null;
  type_id: number | null;
  unit_id: number | null;
  unit_name?: string | null;
  stock_type?: string | null;
  note?: string | null;
}

interface InboundRow {
  stock_type: 'REGULAR' | 'REMNANT' | 'SAVING';
  roll_code: string;
  lot_code: string;
  supplier_name: string;
  inbound_date?: string;
  barcode: string;
  fabric_id: string;
  color_id: string;
  type_id: string;
  location_id: string;
  unit_id: string;
  quantity_initial: string;
  note: string;
}

const isStockType = (value: string): value is InboundRow['stock_type'] =>
  value === 'REGULAR' || value === 'REMNANT' || value === 'SAVING';

export default function InboundPage() {
  const [masterData, setMasterData] = useState<{
    fabrics: MasterItem[];
    colors: MasterItem[];
    types: MasterItem[];
    units: MasterItem[];
    locations: MasterItem[];
  }>({
    fabrics: [],
    colors: [],
    types: [],
    units: [],
    locations: [],
  });
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
  const [customers, setCustomers] = useState<Array<{ customer_id: number; customer_code: string; customer_name: string }>>([]);

  const [rows, setRows] = useState<InboundRow[]>([
    {
      stock_type: 'REGULAR',
      roll_code: '',
      lot_code: '',
      supplier_name: '',
      barcode: '',
      fabric_id: '',
      color_id: '',
      type_id: '',
      location_id: '',
      unit_id: '',
      quantity_initial: '',
      note: '',
    },
  ]);
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(0);

  const [inventory, setInventory] = useState<InventoryRoll[]>([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [editingInventoryRoll, setEditingInventoryRoll] = useState<InventoryRoll | null>(null);
  const [editInventoryForm, setEditInventoryForm] = useState({
    roll_code: '',
    lot_code: '',
    supplier_name: '',
    barcode: '',
    fabric_id: '',
    color_id: '',
    type_id: '',
    location_id: '',
    unit_id: '',
    quantity_initial: '',
    quantity_remaining: '',
    stock_type: 'REGULAR' as InboundRow['stock_type'],
    note: '',
  });
  const [savingInventoryEdit, setSavingInventoryEdit] = useState(false);
  const [viewMode, setViewMode] = useState<PageViewMode>('both');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [labelToPrint, setLabelToPrint] = useState<RollLabelData[] | null>(null);

  const beginEditInventoryRoll = (roll: InventoryRoll) => {
    const stockType = roll.stock_type || '';
    setEditingInventoryRoll(roll);
    setEditInventoryForm({
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
      stock_type: isStockType(stockType) ? stockType : 'REGULAR',
      note: roll.note || '',
    });
  };

  const changeEditedInitialQuantity = (quantity_initial: string) => {
    const difference = Number(quantity_initial) - Number(editInventoryForm.quantity_initial);
    const quantity_remaining = Number.isFinite(difference)
      ? String(Math.max(0, Number(editInventoryForm.quantity_remaining) + difference))
      : editInventoryForm.quantity_remaining;
    setEditInventoryForm({ ...editInventoryForm, quantity_initial, quantity_remaining });
  };

  const saveInventoryEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingInventoryRoll) return;
    setSavingInventoryEdit(true);
    setMessage(null);
    try {
      const response = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roll_id: editingInventoryRoll.roll_id,
          roll_code: editInventoryForm.roll_code,
          lot_code: editInventoryForm.lot_code,
          supplier_name: editInventoryForm.supplier_name,
          barcode: editInventoryForm.barcode,
          fabric_id: editInventoryForm.fabric_id,
          color_id: editInventoryForm.color_id,
          type_id: editInventoryForm.type_id,
          location_id: editInventoryForm.location_id,
          unit_id: editInventoryForm.unit_id,
          quantity_initial: Number(editInventoryForm.quantity_initial),
          quantity_remaining: Number(editInventoryForm.quantity_remaining),
          stock_type: editInventoryForm.stock_type,
          note: editInventoryForm.note,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể cập nhật cuộn.');
      setEditingInventoryRoll(null);
      setMessage({ type: 'success', text: json.message || 'Đã cập nhật thông tin cuộn.' });
      await fetchInventory();
    } catch (error) {
      console.error('Lỗi sửa cuộn từ bảng nhập kho:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể cập nhật cuộn.' });
    } finally {
      setSavingInventoryEdit(false);
    }
  };

  // Tải danh mục Master Data động
  const fetchMasterData = async () => {
    setFetching(true);
    try {
      const [masterResponse, catalogResponse, customerResponse] = await Promise.all([
        fetch('/api/fabrics/master'),
        fetch('/api/catalog?kind=locations'),
        fetch('/api/customers'),
      ]);
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
    } catch (err) {
      console.error('Lỗi tải danh mục:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Không thể tải danh mục.' });
    } finally {
      setFetching(false);
    }
  };

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

  const catalogCreateFields = (kind: Exclude<CatalogCreateKind, 'customers'>) => (
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

  const fetchInventory = async (page = inventoryPage) => {
    setInventoryLoading(true);
    try {
      const res = await fetch(`/api/inventory?page=${page}&pageSize=50`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Không thể tải bảng tồn kho.');
      }
      setInventory(json.data || []);
      setInventoryTotal(json.pagination?.total ?? 0);
    } catch (err) {
      console.error('Lỗi tải bảng tồn kho:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Không thể tải bảng tồn kho.' });
    } finally {
      setInventoryLoading(false);
    }
  };

  const changeInventoryPage = (page: number) => {
    setInventoryPage(page);
    fetchInventory(page);
  };

  useEffect(() => {
    fetchMasterData();
    fetchInventory();
  }, []);

  const handleAddRow = () => {
    setExpandedRowIndex(rows.length);
    setRows([
      ...rows,
      {
        stock_type: 'REGULAR',
        roll_code: '',
        lot_code: '',
        supplier_name: '',
        barcode: '',
        fabric_id: '',
        color_id: '',
        type_id: '',
        location_id: '',
        unit_id: '',
        quantity_initial: '',
        note: '',
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
    setExpandedRowIndex((current) => {
      if (current === index) return Math.max(0, index - 1);
      if (current !== null && current > index) return current - 1;
      return current;
    });
  };

  const handleChangeRow = <K extends keyof InboundRow>(index: number, field: K, value: InboundRow[K]) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const invalidRowIndex = rows.findIndex(
      (row) => !row.roll_code.trim() || !row.fabric_id || !row.quantity_initial || Number(row.quantity_initial) <= 0
    );
    if (invalidRowIndex !== -1) {
      setExpandedRowIndex(invalidRowIndex);
      setMessage({
        type: 'error',
        text: `Vui lòng điền đủ mã cuộn, loại vải và số lượng hợp lệ cho cuộn #${invalidRowIndex + 1}.`,
      });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const payload = {
        rolls: rows.map((r) => ({
          stock_type: r.stock_type,
          roll_code: r.roll_code.trim(),
          lot_code: r.lot_code.trim() || undefined,
          supplier_name: r.supplier_name.trim() || undefined,
          barcode: r.barcode.trim() || undefined,
          fabric_id: Number(r.fabric_id),
          color_id: r.color_id ? Number(r.color_id) : undefined,
          type_id: r.type_id ? Number(r.type_id) : undefined,
          location_id: r.location_id ? Number(r.location_id) : undefined,
          unit_id: r.unit_id ? Number(r.unit_id) : undefined,
          quantity_initial: Number(r.quantity_initial),
          note: r.note.trim() || undefined,
        })),
      };

      const res = await fetch('/api/fabric-rolls/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        setMessage({ type: 'success', text: json.message });
        // Reset về 1 dòng trống
        setRows([
          {
            stock_type: 'REGULAR',
            roll_code: '',
            lot_code: '',
            supplier_name: '',
            barcode: '',
            fabric_id: '',
            color_id: '',
            type_id: '',
            location_id: '',
            unit_id: '',
            quantity_initial: '',
            note: '',
          },
        ]);
        setExpandedRowIndex(0);
        await fetchInventory();
      } else {
        setMessage({ type: 'error', text: json.error || 'Có lỗi xảy ra khi nhập kho.' });
      }
    } catch (err) {
      console.error('Lỗi gửi dữ liệu:', err);
      setMessage({ type: 'error', text: 'Không thể kết nối máy chủ.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nhập Kho Vải</h1>
          <p className="text-sm text-slate-500 mt-0.5">Thêm nhiều cuộn vải vào hệ thống trong một giao dịch Transaction duy nhất</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <PageViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
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
      {/* Form Nhập Batch */}
      {viewMode !== 'table' && <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-base">Danh sách cuộn vải nhập kho ({rows.length})</h2>
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> Thêm dòng
            </button>
          </div>

          <div className="space-y-4">
            {rows.map((row, index) => (
              <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    aria-expanded={expandedRowIndex === index}
                    onClick={() => setExpandedRowIndex((current) => current === index ? null : index)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-700 uppercase">Cuộn #{index + 1}</span>
                      {expandedRowIndex !== index && (
                        <span className="mt-1 block truncate text-xs text-slate-500">
                          {row.roll_code || 'Chưa có mã cuộn'}
                          {' · '}
                          {masterData.fabrics.find((fabric) => String(fabric.id) === row.fabric_id)?.name || 'Chưa chọn loại vải'}
                          {' · '}
                          {row.stock_type === 'SAVING' ? 'Vải tiết kiệm' : row.stock_type === 'REMNANT' ? 'Đầu khúc' : 'Vải thường'}
                          {' · '}
                          {row.quantity_initial ? `${row.quantity_initial} ${masterData.units.find((unit) => String(unit.id) === row.unit_id)?.name || 'm'}` : 'Chưa nhập số lượng'}
                        </span>
                      )}
                    </span>
                    {expandedRowIndex === index
                      ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
                      : <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />}
                  </button>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(index)}
                      className="text-rose-500 hover:text-rose-700 p-1 transition-colors"
                      title="Xóa dòng này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {expandedRowIndex === index && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Mã cuộn */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      Mã cuộn <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={row.roll_code}
                      onChange={(e) => handleChangeRow(index, 'roll_code', e.target.value)}
                      placeholder="VD: CV-2026-001"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Mã lô</label>
                    <input
                      maxLength={100}
                      value={row.lot_code}
                      onChange={(event) => handleChangeRow(index, 'lot_code', event.target.value)}
                      placeholder="VD: LÔ-BB12"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Nhà cung cấp / nơi nhập</label>
                    <input
                      maxLength={160}
                      value={row.supplier_name}
                      onChange={(event) => handleChangeRow(index, 'supplier_name', event.target.value)}
                      placeholder="Tên nhà cung cấp"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      Phân loại tồn kho <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={row.stock_type}
                      onChange={(event) => {
                        if (isStockType(event.target.value)) {
                          handleChangeRow(index, 'stock_type', event.target.value);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="REGULAR">Vải thường</option>
                      <option value="SAVING">Vải tiết kiệm (TK)</option>
                      <option value="REMNANT">Đầu vải / Đầu khúc</option>
                    </select>
                  </div>

                  {/* Tên vải */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      Loại vải <span className="text-rose-500">*</span>
                    </label>
                    <SearchableCombobox
                      required
                      ariaLabel="Tên vải"
                      value={row.fabric_id}
                      onChange={(value) => handleChangeRow(index, 'fabric_id', value)}
                      placeholder="Tìm tên hoặc mã vải..."
                      createFields={catalogCreateFields('fabrics')}
                      onCreateOption={(name, fields) => addCatalogItem('fabrics', name, fields)}
                      options={masterData.fabrics.map((fabric) => ({
                        value: String(fabric.id),
                        label: fabric.code ? `${fabric.name} (${fabric.code})` : fabric.name,
                      }))}
                      className="py-2 pl-9 pr-9 text-xs"
                    />
                  </div>

                  {/* Màu sắc */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Màu sắc</label>
                    <SearchableCombobox
                      ariaLabel="Màu sắc"
                      value={row.color_id}
                      onChange={(value) => handleChangeRow(index, 'color_id', value)}
                      placeholder="Tìm màu..."
                      createFields={catalogCreateFields('colors')}
                      onCreateOption={(name, fields) => addCatalogItem('colors', name, fields)}
                      options={masterData.colors.map((color) => ({ value: String(color.id), label: color.name }))}
                      className="py-2 pl-9 pr-9 text-xs"
                    />
                  </div>

                  {/* Kiểu loại */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Kiểu dệt / Loại</label>
                    <SearchableCombobox
                      ariaLabel="Kiểu dệt hoặc loại vải"
                      value={row.type_id}
                      onChange={(value) => handleChangeRow(index, 'type_id', value)}
                      placeholder="Tìm kiểu vải..."
                      createFields={catalogCreateFields('types')}
                      onCreateOption={(name, fields) => addCatalogItem('types', name, fields)}
                      options={masterData.types.map((type) => ({ value: String(type.id), label: type.name }))}
                      className="py-2 pl-9 pr-9 text-xs"
                    />
                  </div>

                  {/* Vị trí kệ */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Vị trí kệ</label>
                    <SearchableCombobox
                      ariaLabel="Vị trí kệ"
                      value={row.location_id}
                      onChange={(value) => handleChangeRow(index, 'location_id', value)}
                      placeholder="Tìm vị trí kệ..."
                      createFields={catalogCreateFields('locations')}
                      onCreateOption={(name, fields) => addCatalogItem('locations', name, fields)}
                      options={masterData.locations.map((location) => ({
                        value: String(location.id),
                        label: location.code && location.name !== location.code
                          ? `${location.code} - ${location.name}`
                          : location.code || location.name,
                      }))}
                      className="py-2 pl-9 pr-9 text-xs"
                    />
                  </div>

                  {/* Số lượng */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                      Số lượng <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      value={row.quantity_initial}
                      onChange={(e) => handleChangeRow(index, 'quantity_initial', e.target.value)}
                      placeholder="VD: 100"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Đơn vị */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Đơn vị</label>
                    <SearchableCombobox
                      ariaLabel="Đơn vị"
                      value={row.unit_id}
                      onChange={(value) => handleChangeRow(index, 'unit_id', value)}
                      placeholder="Tìm đơn vị..."
                      createFields={catalogCreateFields('units')}
                      onCreateOption={(name, fields) => addCatalogItem('units', name, fields)}
                      options={masterData.units.map((unit) => ({ value: String(unit.id), label: unit.name }))}
                      className="py-2 pl-9 pr-9 text-xs"
                    />
                  </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={row.note}
                        onChange={(e) => handleChangeRow(index, 'note', e.target.value)}
                        placeholder="Ghi chú cho cuộn vải này..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> Thêm dòng mới
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-xs disabled:opacity-50"
            >
              <PackagePlus className="w-4 h-4" />
              <span>{loading ? 'Đang xử lý Batch Transaction...' : `Xác nhận Nhập ${rows.length} Cuộn`}</span>
            </button>
          </div>
        </div>
      </form>}

      {viewMode !== 'entry' && (
        <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <Table2 className="h-4 w-4 text-blue-600" />
                Bảng tồn kho ({inventoryTotal.toLocaleString('vi-VN')} cuộn)
              </h2>
              <p className="mt-1 text-xs text-slate-500">Danh sách cuộn hiện có trong kho</p>
            </div>
            <button
              type="button"
              onClick={() => fetchInventory()}
              disabled={inventoryLoading}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${inventoryLoading ? 'animate-spin' : ''}`} />
              Làm mới bảng
            </button>
          </div>
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
                  <th className="px-3 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryLoading ? (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400">Đang tải bảng tồn kho...</td></tr>
                ) : inventory.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400">Chưa có cuộn vải trong kho.</td></tr>
                ) : inventory.map((roll) => (
                  <tr key={roll.roll_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{roll.roll_code}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{roll.barcode || 'Chưa có barcode'}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-800">{roll.fabric_name || 'Chưa phân loại'}</div>
                      <div className="text-[10px] text-slate-500">{roll.color_name || 'Mặc định'}</div>
                      {roll.stock_type === 'SAVING' && <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Vải tiết kiệm</span>}
                      {roll.stock_type === 'REMNANT' && <span className="mt-1 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800">Đầu khúc</span>}
                      {roll.stock_type !== 'SAVING' && roll.stock_type !== 'REMNANT' && <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">Vải thường</span>}
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
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setLabelToPrint([{
                          roll_code: roll.roll_code,
                          barcode: roll.barcode || roll.roll_code,
                          fabric_name: roll.fabric_name || 'Chưa phân loại',
                          color_name: roll.color_name || '',
                          quantity: String(roll.quantity_remaining),
                          unit_name: roll.unit_name || 'm',
                          lot_code: roll.lot_code || '',
                          inbound_date: roll.inbound_date ? new Date(roll.inbound_date).toLocaleDateString('vi-VN') : '',
                        }])}
                        title={`In tem ${roll.roll_code}`}
                        aria-label={`In tem ${roll.roll_code}`}
                        className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => beginEditInventoryRoll(roll)} title={`Sửa ${roll.roll_code}`} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50">
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Trang {inventoryPage} / {Math.max(1, Math.ceil(inventoryTotal / 50))} ·
              {' '}{inventoryTotal.toLocaleString('vi-VN')} cuộn
            </span>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => changeInventoryPage(Math.max(1, inventoryPage - 1))}
                disabled={inventoryLoading || inventoryPage <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" /> Trước
              </button>
              <button
                type="button"
                onClick={() => changeInventoryPage(inventoryPage + 1)}
                disabled={inventoryLoading || inventoryPage >= Math.ceil(inventoryTotal / 50)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50"
              >
                Sau <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {editingInventoryRoll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4">
          <form onSubmit={saveInventoryEdit} className="my-8 w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Sửa cuộn {editingInventoryRoll.roll_code}</h2>
                <p className="mt-1 text-xs text-slate-500">Số lượng sửa sẽ được ghi vào nhật ký điều chỉnh.</p>
              </div>
              <button type="button" onClick={() => setEditingInventoryRoll(null)} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Mã cuộn
                <input required maxLength={100} value={editInventoryForm.roll_code} onChange={(event) => setEditInventoryForm({ ...editInventoryForm, roll_code: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Mã lô
                <input maxLength={100} value={editInventoryForm.lot_code} onChange={(event) => setEditInventoryForm({ ...editInventoryForm, lot_code: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Nhà cung cấp / nơi nhập
                <input maxLength={160} value={editInventoryForm.supplier_name} onChange={(event) => setEditInventoryForm({ ...editInventoryForm, supplier_name: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Barcode
                <input maxLength={150} value={editInventoryForm.barcode} onChange={(event) => setEditInventoryForm({ ...editInventoryForm, barcode: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Tên vải
                <SearchableCombobox
                  required
                  ariaLabel="Tên vải"
                  value={editInventoryForm.fabric_id}
                  onChange={(fabric_id) => setEditInventoryForm({ ...editInventoryForm, fabric_id })}
                  options={[
                    ...masterData.fabrics,
                    ...(masterData.fabrics.some((item) => item.id === editingInventoryRoll.fabric_id)
                      ? []
                      : [{ id: editingInventoryRoll.fabric_id, name: editingInventoryRoll.fabric_name || 'Danh mục hiện tại' }]),
                  ].map((item) => ({ value: String(item.id), label: item.name }))}
                  placeholder="Tìm tên vải..."
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Màu sắc
                <SearchableCombobox
                  ariaLabel="Màu sắc"
                  value={editInventoryForm.color_id}
                  onChange={(color_id) => setEditInventoryForm({ ...editInventoryForm, color_id })}
                  options={[
                    ...masterData.colors,
                    ...(editingInventoryRoll.color_id && !masterData.colors.some((item) => item.id === editingInventoryRoll.color_id)
                      ? [{ id: editingInventoryRoll.color_id, name: editingInventoryRoll.color_name || 'Danh mục hiện tại' }]
                      : []),
                  ].map((item) => ({ value: String(item.id), label: item.name }))}
                  placeholder="Tìm màu..."
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Loại vải
                <SearchableCombobox
                  ariaLabel="Loại vải"
                  value={editInventoryForm.type_id}
                  onChange={(type_id) => setEditInventoryForm({ ...editInventoryForm, type_id })}
                  options={[
                    ...masterData.types,
                    ...(editingInventoryRoll.type_id && !masterData.types.some((item) => item.id === editingInventoryRoll.type_id)
                      ? [{ id: editingInventoryRoll.type_id, name: editingInventoryRoll.type_name || 'Danh mục hiện tại' }]
                      : []),
                  ].map((item) => ({ value: String(item.id), label: item.name }))}
                  placeholder="Tìm loại vải..."
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Vị trí
                <SearchableCombobox
                  ariaLabel="Vị trí"
                  value={editInventoryForm.location_id}
                  onChange={(location_id) => setEditInventoryForm({ ...editInventoryForm, location_id })}
                  options={[
                    ...masterData.locations,
                    ...(editingInventoryRoll.location_id && !masterData.locations.some((item) => item.id === editingInventoryRoll.location_id)
                      ? [{ id: editingInventoryRoll.location_id, name: editingInventoryRoll.location_name || editingInventoryRoll.location_code || 'Danh mục hiện tại' }]
                      : []),
                  ].map((item) => ({ value: String(item.id), label: item.name }))}
                  placeholder="Tìm vị trí..."
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Đơn vị
                <SearchableCombobox
                  ariaLabel="Đơn vị"
                  value={editInventoryForm.unit_id}
                  onChange={(unit_id) => setEditInventoryForm({ ...editInventoryForm, unit_id })}
                  options={[
                    ...masterData.units,
                    ...(editingInventoryRoll.unit_id && !masterData.units.some((item) => item.id === editingInventoryRoll.unit_id)
                      ? [{ id: editingInventoryRoll.unit_id, name: editingInventoryRoll.unit_name || 'Danh mục hiện tại' }]
                      : []),
                  ].map((item) => ({ value: String(item.id), label: item.name }))}
                  placeholder="Tìm đơn vị..."
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Số lượng ban đầu
                <input type="number" min="0.001" step="0.001" required value={editInventoryForm.quantity_initial} onChange={(event) => changeEditedInitialQuantity(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Số lượng còn lại
                <input type="number" min="0" step="0.001" required value={editInventoryForm.quantity_remaining} onChange={(event) => setEditInventoryForm({ ...editInventoryForm, quantity_remaining: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700">
                Phân loại tồn kho
                <select value={editInventoryForm.stock_type} onChange={(event) => {
                  const value = event.target.value;
                  if (isStockType(value)) setEditInventoryForm({ ...editInventoryForm, stock_type: value });
                }} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal">
                  <option value="REGULAR">Vải thường</option>
                  <option value="SAVING">Vải tiết kiệm</option>
                  <option value="REMNANT">Đầu khúc</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-700 sm:col-span-2">
                Ghi chú
                <textarea rows={3} value={editInventoryForm.note} onChange={(event) => setEditInventoryForm({ ...editInventoryForm, note: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => setEditingInventoryRoll(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700">Hủy</button>
              <button type="submit" disabled={savingInventoryEdit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Save className="h-4 w-4" /> {savingInventoryEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      )}
      {labelToPrint && <RollLabelPrinter labels={labelToPrint} onClose={() => setLabelToPrint(null)} />}
      </div>
    </div>
  );
}