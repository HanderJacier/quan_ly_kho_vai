'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  PackagePlus,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  Copy,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import { MasterItem } from '@/lib/types';
import { createCatalogOption, type CatalogCreateKind } from '@/lib/catalog-client';
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

const INVENTORY_PAGE_SIZE = 25;

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
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [noteEditorPosition, setNoteEditorPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [inventorySearch, setInventorySearch] = useState('');
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [inventory, setInventory] = useState<InventoryRoll[]>([]);
  const [selectedInventoryRollId, setSelectedInventoryRollId] = useState<number | null>(null);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const inventoryRequestId = useRef(0);
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
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [labelToPrint, setLabelToPrint] = useState<RollLabelData[] | null>(null);
  const selectedInventoryRoll = inventory.find((roll) => roll.roll_id === selectedInventoryRollId);

  useEffect(() => {
    if (editingNoteIndex === null) return;

    const updatePosition = () => {
      const input = document.getElementById(`inbound-note-${editingNoteIndex}`);
      if (!input) return;
      const rect = input.getBoundingClientRect();
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
      const anchor = document.getElementById(`inbound-note-${editingNoteIndex}`);
      if (
        target instanceof Node &&
        !noteEditorRef.current?.contains(target) &&
        !anchor?.contains(target)
      ) {
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
      await fetchInventory(inventoryPage, inventorySearch);
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

  const fetchInventory = useCallback(async (page: number, searchTerm: string) => {
    const requestId = ++inventoryRequestId.current;
    setSelectedInventoryRollId(null);
    setInventoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(INVENTORY_PAGE_SIZE),
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await fetch(`/api/inventory?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Không thể tải bảng tồn kho.');
      }
      if (requestId === inventoryRequestId.current) {
        setInventory(json.data || []);
        setInventoryTotal(json.pagination?.total ?? 0);
      }
    } catch (err) {
      if (requestId === inventoryRequestId.current) {
        console.error('Lỗi tải bảng tồn kho:', err);
        setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Không thể tải bảng tồn kho.' });
      }
    } finally {
      if (requestId === inventoryRequestId.current) setInventoryLoading(false);
    }
  }, []);

  const changeInventoryPage = (page: number) => {
    setInventoryPage(page);
    void fetchInventory(page, inventorySearch);
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    const delay = inventorySearch.trim() ? 250 : 0;
    const timer = window.setTimeout(() => {
      setInventoryPage(1);
      void fetchInventory(1, inventorySearch);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [fetchInventory, inventorySearch]);

  const handleAddRow = () => {
    setSelectedInventoryRollId(null);
    setSelectedRowIndex(rows.length);
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
    setSelectedRowIndex((current) => {
      if (current === index) return Math.max(0, index - 1);
      if (current > index) return current - 1;
      return current;
    });
  };

  const handleChangeRow = <K extends keyof InboundRow>(index: number, field: K, value: InboundRow[K]) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const printInventoryRoll = (roll: InventoryRoll) => {
    setLabelToPrint([{
      roll_code: roll.roll_code,
      barcode: roll.barcode || roll.roll_code,
      fabric_name: roll.fabric_name || 'Chưa phân loại',
      color_name: roll.color_name || '',
      quantity: String(roll.quantity_remaining),
      unit_name: roll.unit_name || 'm',
      lot_code: roll.lot_code || '',
      inbound_date: roll.inbound_date ? new Date(roll.inbound_date).toLocaleDateString('vi-VN') : '',
    }]);
  };

  const copySelectedRow = () => {
    if (selectedInventoryRoll) {
      const nextIndex = rows.length;
      const stockType = selectedInventoryRoll.stock_type || '';
      const copied: InboundRow = {
        stock_type: isStockType(stockType) ? stockType : 'REGULAR',
        roll_code: '',
        lot_code: selectedInventoryRoll.lot_code || '',
        supplier_name: selectedInventoryRoll.supplier_name || '',
        barcode: '',
        fabric_id: String(selectedInventoryRoll.fabric_id),
        color_id: selectedInventoryRoll.color_id ? String(selectedInventoryRoll.color_id) : '',
        type_id: selectedInventoryRoll.type_id ? String(selectedInventoryRoll.type_id) : '',
        location_id: selectedInventoryRoll.location_id ? String(selectedInventoryRoll.location_id) : '',
        unit_id: selectedInventoryRoll.unit_id ? String(selectedInventoryRoll.unit_id) : '',
        quantity_initial: String(selectedInventoryRoll.quantity_initial),
        note: selectedInventoryRoll.note || '',
      };
      setRows([...rows, copied]);
      setSelectedInventoryRollId(null);
      setSelectedRowIndex(nextIndex);
      setMessage({
        type: 'success',
        text: `Đã sao chép thông tin cuộn ${selectedInventoryRoll.roll_code} xuống dòng nhập ${nextIndex + 1}. Nhập mã cuộn mới cho dòng vừa sao chép.`,
      });
      window.setTimeout(() => {
        const rollCodeInput = document.getElementById(`inbound-roll-code-${nextIndex}`);
        rollCodeInput?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        rollCodeInput?.focus();
      }, 0);
      return;
    }

    const source = rows[selectedRowIndex];
    if (!source) return;
    const copied = { ...source, roll_code: '', barcode: '' };
    const nextIndex = rows.length;
    setSelectedInventoryRollId(null);
    setRows([...rows, copied]);
    setSelectedRowIndex(nextIndex);
    setMessage({
      type: 'success',
      text: `Đã sao chép thông tin dòng ${selectedRowIndex + 1} sang dòng ${nextIndex + 1}. Nhập mã cuộn mới cho dòng vừa sao chép.`,
    });
    window.setTimeout(() => {
      const rollCodeInput = document.getElementById(`inbound-roll-code-${nextIndex}`);
      rollCodeInput?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      rollCodeInput?.focus();
    }, 0);
  };

  const printSelectedRow = () => {
    if (!selectedInventoryRoll) {
      setMessage({
        type: 'error',
        text: 'Vui lòng chọn một cuộn trong bảng tồn kho trước khi in tem.',
      });
      return;
    }
    printInventoryRoll(selectedInventoryRoll);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const invalidRowIndex = rows.findIndex(
      (row) => !row.roll_code.trim() || !row.fabric_id || !row.quantity_initial || Number(row.quantity_initial) <= 0
    );
    if (invalidRowIndex !== -1) {
      setSelectedRowIndex(invalidRowIndex);
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
        setSelectedRowIndex(0);
        await fetchInventory(inventoryPage, inventorySearch);
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
    <div className="mx-auto max-w-screen-2xl space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 border border-slate-400 bg-gradient-to-b from-slate-100 to-slate-300 px-3 py-2 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-sm font-bold text-slate-900">Nhập kho vải</h1>
          <p className="mt-0.5 text-[11px] text-slate-600">Nhập danh sách cuộn vải</p>
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

      <form onSubmit={handleSubmit} className="min-w-0">
        <div className="space-y-0 border border-slate-400 bg-[#f5f5f5] shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 py-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xs font-bold text-slate-800">Danh sách cuộn vải nhập kho</h2>
              <span className="border border-slate-400 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                {inventoryTotal.toLocaleString('vi-VN')} trong kho · {rows.length} dòng mới
              </span>
            </div>
            <div className="flex w-full items-center gap-1.5 sm:w-auto sm:flex-nowrap">
              <input
                type="search"
                value={inventorySearch}
                onChange={(event) => setInventorySearch(event.target.value)}
                placeholder="Tìm cuộn đã có..."
                aria-label="Tìm cuộn vải đã có trong kho"
                className="h-7 w-full min-w-0 border border-slate-400 bg-white px-2 text-[11px] text-slate-900 shadow-inner focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-500 sm:w-56"
              />
              <button
                type="button"
                onClick={() => void fetchInventory(inventoryPage, inventorySearch)}
                disabled={inventoryLoading}
                className="flex h-7 shrink-0 items-center gap-1 border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 text-[11px] font-semibold text-slate-800 hover:to-slate-300 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${inventoryLoading ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border-b border-slate-400 bg-white">
            <div className="min-w-[1000px]">
              <div className="max-h-[54vh] overflow-y-auto">
                <table className="w-full table-fixed border-collapse text-left text-[11px]">
                  <colgroup>
                    <col className="w-[3%]" /><col className="w-[9%]" /><col className="w-[7%]" />
                    <col className="w-[10%]" /><col className="w-[9%]" /><col className="w-[10%]" />
                    <col className="w-[7%]" /><col className="w-[8%]" /><col className="w-[9%]" />
                    <col className="w-[7%]" /><col className="w-[7%]" /><col className="w-[9.5%]" />
                    <col className="w-[4.5%]" />
                  </colgroup>
                <thead className="sticky top-0 z-10 bg-gradient-to-b from-slate-100 to-slate-300 text-[10px] font-semibold uppercase text-slate-700">
                  <tr>
                    <th className="border border-slate-400 px-1 py-1.5">#</th>
                    <th className="border border-slate-400 px-1 py-1.5">Mã cuộn *</th>
                    <th className="border border-slate-400 px-1 py-1.5">Mã lô</th>
                    <th className="border border-slate-400 px-1 py-1.5">Nhà cung cấp / nơi nhập</th>
                    <th className="border border-slate-400 px-1 py-1.5">Phân loại tồn kho *</th>
                    <th className="border border-slate-400 px-1 py-1.5">Loại vải *</th>
                    <th className="border border-slate-400 px-1 py-1.5">Màu sắc</th>
                    <th className="border border-slate-400 px-1 py-1.5">Kiểu dệt / loại</th>
                    <th className="border border-slate-400 px-1 py-1.5">Vị trí kệ</th>
                    <th className="border border-slate-400 px-1 py-1.5">Số lượng *</th>
                    <th className="border border-slate-400 px-1 py-1.5">Đơn vị</th>
                    <th className="border border-slate-400 px-1 py-1.5">Ghi chú</th>
                    <th className="border border-slate-400 px-1 py-1.5"><span className="sr-only">Thao tác</span></th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryLoading ? (
                    <tr><td colSpan={13} className="border border-slate-300 px-3 py-6 text-center text-slate-500">Đang tải cuộn vải đã có...</td></tr>
                  ) : inventory.length === 0 && inventorySearch.trim() ? (
                    <tr><td colSpan={13} className="border border-slate-300 px-3 py-4 text-center text-slate-500">Không tìm thấy cuộn vải phù hợp.</td></tr>
                  ) : inventory.length === 0 ? (
                    <tr><td colSpan={13} className="border border-slate-300 px-3 py-4 text-center text-slate-500">Chưa có cuộn vải trong kho.</td></tr>
                  ) : inventory.map((roll, index) => (
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
                      aria-label={`Chọn cuộn ${roll.roll_code} để in tem`}
                      className={`cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                        selectedInventoryRollId === roll.roll_id
                          ? 'bg-[#dbeafe]'
                          : index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-[#f7f7f7] hover:bg-slate-50'
                      }`}
                    >
                      <td className="border border-slate-300 px-1.5 py-1 text-center text-slate-500">{(inventoryPage - 1) * INVENTORY_PAGE_SIZE + index + 1}</td>
                      <td title={roll.roll_code} className="break-words whitespace-normal border border-slate-300 px-1.5 py-1 font-semibold text-slate-900">{roll.roll_code}</td>
                      <td title={roll.lot_code || ''} className="break-words whitespace-normal border border-slate-300 px-1.5 py-1">{roll.lot_code || '—'}</td>
                      <td title={roll.supplier_name || ''} className="break-words whitespace-normal border border-slate-300 px-1.5 py-1">{roll.supplier_name || '—'}</td>
                      <td title={roll.stock_type === 'SAVING' ? 'Vải tiết kiệm (TK)' : roll.stock_type === 'REMNANT' ? 'Đầu vải / Đầu khúc' : 'Vải thường'} className="break-words whitespace-normal border border-slate-300 px-1.5 py-1">
                        {roll.stock_type === 'SAVING' ? 'Vải tiết kiệm (TK)' : roll.stock_type === 'REMNANT' ? 'Đầu vải / Đầu khúc' : 'Vải thường'}
                      </td>
                      <td title={roll.fabric_name || ''} className="break-words whitespace-normal border border-slate-300 px-1.5 py-1">{roll.fabric_name || '—'}</td>
                      <td title={roll.color_name || ''} className="break-words whitespace-normal border border-slate-300 px-1.5 py-1">{roll.color_name || '—'}</td>
                      <td title={roll.type_name || ''} className="break-words whitespace-normal border border-slate-300 px-1.5 py-1">{roll.type_name || '—'}</td>
                      <td title={roll.location_code || roll.location_name || ''} className="break-words whitespace-normal border border-slate-300 px-1.5 py-1">{roll.location_code || roll.location_name || '—'}</td>
                      <td title={String(roll.quantity_initial)} className="border border-slate-300 px-1.5 py-1 text-right">{roll.quantity_initial}</td>
                      <td title={roll.unit_name || 'm'} className="break-words whitespace-normal border border-slate-300 px-1.5 py-1">{roll.unit_name || 'm'}</td>
                      <td title={roll.note || ''} className="break-words whitespace-normal border border-slate-300 px-1.5 py-1">{roll.note || '—'}</td>
                      <td className="border border-slate-300 px-1 py-1 text-center">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginEditInventoryRoll(roll);
                          }}
                          title={`Sửa ${roll.roll_code}`}
                          aria-label={`Sửa ${roll.roll_code}`}
                          className="border border-transparent p-1 text-blue-700 hover:border-blue-300 hover:bg-blue-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-400">
              <div className="bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Dòng mới — chỉ các dòng bên dưới sẽ được nhập kho
              </div>
              <table className="w-full table-fixed border-collapse text-left text-[11px]">
                <colgroup>
                  <col className="w-[3%]" /><col className="w-[9%]" /><col className="w-[7%]" />
                  <col className="w-[10%]" /><col className="w-[9%]" /><col className="w-[10%]" />
                  <col className="w-[7%]" /><col className="w-[8%]" /><col className="w-[9%]" />
                  <col className="w-[7%]" /><col className="w-[7%]" /><col className="w-[9.5%]" />
                  <col className="w-[4.5%]" />
                </colgroup>
                <tbody>
                  {rows.map((row, index) => (
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
                      className={selectedRowIndex === index ? 'bg-[#e6f0ff]' : index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-[#f7f7f7] hover:bg-slate-50'}
                      aria-selected={selectedRowIndex === index}
                    >
                      <td className="border border-slate-300 px-1 py-1 text-center text-slate-500">{index + 1}</td>
                      <td className="border border-slate-300 px-1 py-1">
                        <input
                          required
                          id={`inbound-roll-code-${index}`}
                          maxLength={100}
                          aria-label={`Mã cuộn dòng ${index + 1}`}
                          value={row.roll_code}
                          onChange={(event) => handleChangeRow(index, 'roll_code', event.target.value)}
                          title={row.roll_code}
                          placeholder="Mã cuộn"
                          className="h-7 w-full border border-slate-300 bg-white px-1 text-[13px] font-medium text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-1">
                        <input
                          maxLength={100}
                          aria-label={`Mã lô dòng ${index + 1}`}
                          value={row.lot_code}
                          onChange={(event) => handleChangeRow(index, 'lot_code', event.target.value)}
                          title={row.lot_code}
                          placeholder="Mã lô"
                          className="h-7 w-full border border-slate-300 bg-white px-1 text-[13px] font-medium text-slate-900 placeholder:text-slate-500"
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-1">
                        <input
                          maxLength={160}
                          aria-label={`Nhà cung cấp hoặc nơi nhập dòng ${index + 1}`}
                          value={row.supplier_name}
                          onChange={(event) => handleChangeRow(index, 'supplier_name', event.target.value)}
                          title={row.supplier_name}
                          placeholder="Nhà cung cấp"
                          className="h-7 w-full border border-slate-300 bg-white px-1 text-[13px] font-medium text-slate-900 placeholder:text-slate-500"
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-1">
                        <select
                          required
                          aria-label={`Phân loại tồn kho dòng ${index + 1}`}
                          value={row.stock_type}
                          onChange={(event) => {
                            if (isStockType(event.target.value)) handleChangeRow(index, 'stock_type', event.target.value);
                          }}
                          title={row.stock_type === 'SAVING' ? 'Vải tiết kiệm (TK)' : row.stock_type === 'REMNANT' ? 'Đầu vải / Đầu khúc' : 'Vải thường'}
                          className="h-7 w-full border border-slate-300 bg-white px-1 text-[12px] font-medium text-slate-900"
                        >
                          <option value="REGULAR">Vải thường</option>
                          <option value="SAVING">Vải tiết kiệm (TK)</option>
                          <option value="REMNANT">Đầu vải / Đầu khúc</option>
                        </select>
                      </td>
                      <td className="border border-slate-300 px-1 py-1">
                        <SearchableCombobox
                          required
                          ariaLabel={`Loại vải dòng ${index + 1}`}
                          value={row.fabric_id}
                          onChange={(value) => handleChangeRow(index, 'fabric_id', value)}
                          placeholder="Loại vải"
                          createFields={catalogCreateFields('fabrics')}
                          onCreateOption={(name, fields) => addCatalogItem('fabrics', name, fields)}
                          showSearchIcon={false}
                          showChevron={false}
                          options={masterData.fabrics.map((fabric) => ({
                            value: String(fabric.id),
                            label: fabric.code ? `${fabric.name} (${fabric.code})` : fabric.name,
                          }))}
                          className="!h-7 !rounded-none !border-slate-300 !py-1 !pl-2 !pr-2 !text-[13px] !font-medium !text-slate-900 placeholder:!text-slate-500"
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-1">
                        <SearchableCombobox
                          ariaLabel={`Màu sắc dòng ${index + 1}`}
                          value={row.color_id}
                          onChange={(value) => handleChangeRow(index, 'color_id', value)}
                          placeholder="Màu sắc"
                          createFields={catalogCreateFields('colors')}
                          onCreateOption={(name, fields) => addCatalogItem('colors', name, fields)}
                          showSearchIcon={false}
                          showChevron={false}
                          options={masterData.colors.map((color) => ({ value: String(color.id), label: color.name }))}
                          className="!h-7 !rounded-none !border-slate-300 !py-1 !pl-2 !pr-2 !text-[13px] !font-medium !text-slate-900 placeholder:!text-slate-500"
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-1">
                        <SearchableCombobox
                          ariaLabel={`Kiểu dệt hoặc loại vải dòng ${index + 1}`}
                          value={row.type_id}
                          onChange={(value) => handleChangeRow(index, 'type_id', value)}
                          placeholder="Kiểu dệt"
                          createFields={catalogCreateFields('types')}
                          onCreateOption={(name, fields) => addCatalogItem('types', name, fields)}
                          showSearchIcon={false}
                          showChevron={false}
                          options={masterData.types.map((type) => ({ value: String(type.id), label: type.name }))}
                          className="!h-7 !rounded-none !border-slate-300 !py-1 !pl-2 !pr-2 !text-[13px] !font-medium !text-slate-900 placeholder:!text-slate-500"
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-1">
                        <SearchableCombobox
                          ariaLabel={`Vị trí kệ dòng ${index + 1}`}
                          value={row.location_id}
                          onChange={(value) => handleChangeRow(index, 'location_id', value)}
                          placeholder="Vị trí"
                          createFields={catalogCreateFields('locations')}
                          onCreateOption={(name, fields) => addCatalogItem('locations', name, fields)}
                          showSearchIcon={false}
                          showChevron={false}
                          options={masterData.locations.map((location) => ({
                            value: String(location.id),
                            label: location.code && location.name !== location.code
                              ? `${location.code} - ${location.name}`
                              : location.code || location.name,
                          }))}
                          className="!h-7 !rounded-none !border-slate-300 !py-1 !pl-2 !pr-2 !text-[13px] !font-medium !text-slate-900 placeholder:!text-slate-500"
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          aria-label={`Số lượng dòng ${index + 1}`}
                          value={row.quantity_initial}
                          onChange={(event) => handleChangeRow(index, 'quantity_initial', event.target.value)}
                          title={row.quantity_initial}
                          placeholder="0.00"
                          className="h-7 w-full border border-slate-300 bg-white px-1 text-right text-[13px] font-medium text-slate-900 placeholder:text-slate-500"
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-1">
                        <SearchableCombobox
                          ariaLabel={`Đơn vị dòng ${index + 1}`}
                          value={row.unit_id}
                          onChange={(value) => handleChangeRow(index, 'unit_id', value)}
                          placeholder="Đơn vị"
                          createFields={catalogCreateFields('units')}
                          onCreateOption={(name, fields) => addCatalogItem('units', name, fields)}
                          showSearchIcon={false}
                          showChevron={false}
                          options={masterData.units.map((unit) => ({ value: String(unit.id), label: unit.name }))}
                          className="!h-7 !rounded-none !border-slate-300 !py-1 !pl-2 !pr-2 !text-[13px] !font-medium !text-slate-900 placeholder:!text-slate-500"
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-1">
                        <input
                          id={`inbound-note-${index}`}
                          type="text"
                          aria-label={`Ghi chú dòng ${index + 1}`}
                          value={row.note}
                          onChange={(event) => handleChangeRow(index, 'note', event.target.value)}
                          onFocus={() => setEditingNoteIndex(index)}
                          onClick={() => noteTextareaRef.current?.focus()}
                          placeholder="Ghi chú"
                          title={row.note}
                          className="h-7 w-full border border-slate-300 bg-white px-1 text-[13px] font-medium leading-5 text-slate-900 placeholder:text-slate-500"
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-1 text-center">
                        <button
                          type="button"
                          disabled={rows.length === 1}
                          onClick={() => handleRemoveRow(index)}
                          className="rounded p-1 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
                          title="Xóa dòng này"
                          aria-label={`Xóa dòng ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white bg-gradient-to-b from-slate-100 to-slate-300 px-2 py-1.5">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[10px] text-slate-600">
                Trang {inventoryPage}/{Math.max(1, Math.ceil(inventoryTotal / INVENTORY_PAGE_SIZE))}
              </span>
              <button
                type="button"
                onClick={() => changeInventoryPage(Math.max(1, inventoryPage - 1))}
                disabled={inventoryLoading || inventoryPage <= 1}
                className="flex h-7 items-center border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-1.5 disabled:opacity-50"
                aria-label="Trang trước"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => changeInventoryPage(inventoryPage + 1)}
                disabled={inventoryLoading || inventoryPage >= Math.ceil(inventoryTotal / INVENTORY_PAGE_SIZE)}
                className="flex h-7 items-center border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-1.5 disabled:opacity-50"
                aria-label="Trang sau"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <span className="mx-1 h-6 border-l border-slate-400" />
              <button
                type="button"
                onClick={handleAddRow}
                className="flex h-7 items-center gap-1 border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 text-[11px] font-semibold text-slate-800 hover:from-slate-50 hover:to-slate-300"
              >
                <Plus className="h-3.5 w-3.5" /> Thêm
              </button>
              <button
                type="button"
                onClick={copySelectedRow}
                className="flex h-7 items-center gap-1 border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 text-[11px] font-semibold text-slate-800 hover:from-slate-50 hover:to-slate-300"
              >
                <Copy className="h-3.5 w-3.5" /> Sao chép
              </button>
              <button
                type="button"
                onClick={printSelectedRow}
                disabled={!selectedInventoryRoll}
                title={selectedInventoryRoll ? `In tem ${selectedInventoryRoll.roll_code}` : 'Chọn cuộn trong bảng tồn kho để in tem'}
                className="flex h-7 items-center gap-1 border border-slate-400 bg-gradient-to-b from-white to-slate-200 px-2 text-[11px] font-semibold text-slate-800 hover:from-slate-50 hover:to-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Printer className="h-3.5 w-3.5" /> In tem
              </button>
              <span className="ml-1 border-l border-slate-400 pl-2 text-[10px] text-slate-600">
                {selectedInventoryRoll
                  ? `Đã chọn ${selectedInventoryRoll.roll_code}`
                  : `Dòng ${selectedRowIndex + 1} / ${rows.length}`}
              </span>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex h-8 items-center gap-1.5 border border-blue-800 bg-gradient-to-b from-blue-500 to-blue-700 px-3 text-xs font-bold text-white shadow-sm hover:from-blue-600 hover:to-blue-800 disabled:opacity-50"
            >
              <PackagePlus className="h-4 w-4" />
              <span>{loading ? 'Đang nhập...' : `Xác nhận nhập ${rows.length} cuộn`}</span>
            </button>
          </div>
        </div>
        </form>

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
      {labelToPrint && <RollLabelPrinter labels={labelToPrint} onClose={() => setLabelToPrint(null)} />}
    </div>
  );
}