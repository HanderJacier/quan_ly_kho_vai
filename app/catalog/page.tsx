'use client';

import { useEffect, useState } from 'react';
import { Archive, CheckCircle2, Pencil, Plus, RefreshCw, Save, X } from 'lucide-react';

const catalogs = [
  { kind: 'fabrics', label: 'Tên vải' },
  { kind: 'colors', label: 'Màu vải' },
  { kind: 'types', label: 'Loại vải' },
  { kind: 'units', label: 'Đơn vị tính' },
  { kind: 'customers', label: 'Khách hàng' },
  { kind: 'locations', label: 'Vị trí kệ' },
] as const;

type CatalogKind = (typeof catalogs)[number]['kind'];

interface CatalogItem {
  id: number;
  code: string | null;
  name: string;
  is_active: number;
  detail: string | null;
  address: string | null;
  width: string | null;
  grammage: string | null;
  shelf_id: number | null;
  shelf_code: string | null;
  warehouse_code: string | null;
  floor_number: string | null;
  side: string | null;
  customer_id: number | null;
  customer_name: string | null;
}

interface CustomerOption {
  customer_id: number;
  customer_code: string;
  customer_name: string;
}

interface ShelfOption {
  shelf_id: number;
  shelf_code: string;
  shelf_name: string | null;
  warehouse_code: string;
}

interface CatalogForm {
  code: string;
  name: string;
  detail: string;
  address: string;
  width: string;
  grammage: string;
  shelf_id: string;
  floor_number: string;
  side: string;
  customer_id: string;
}

const emptyForm: CatalogForm = {
  code: '',
  name: '',
  detail: '',
  address: '',
  width: '',
  grammage: '',
  shelf_id: '',
  floor_number: '',
  side: '',
  customer_id: '',
};

export default function CatalogPage() {
  const [kind, setKind] = useState<CatalogKind>('fabrics');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [form, setForm] = useState<CatalogForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      try {
        const response = await fetch(`/api/catalog?kind=${kind}`, { cache: 'no-store' });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || 'Không thể tải danh mục.');
        if (!cancelled) {
          setItems(json.data || []);
          setShelves(json.shelves || []);
        }
      } catch (error) {
        console.error('Lỗi tải danh mục:', error);
        if (!cancelled) setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể tải danh mục.' });
      } finally {
        if (!cancelled) setFetching(false);
      }
    };
    void loadCatalog();
    return () => { cancelled = true; };
  }, [kind]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/customers')
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || 'Không thể tải khách hàng.');
        if (!cancelled) setCustomers(json.data || []);
      })
      .catch((error: unknown) => {
        console.error('Lỗi tải khách hàng cho danh mục vải:', error);
        if (!cancelled) setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể tải khách hàng.' });
      });
    return () => { cancelled = true; };
  }, []);

  const fetchCatalog = async () => {
    setFetching(true);
    try {
      const response = await fetch(`/api/catalog?kind=${kind}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể tải danh mục.');
      setItems(json.data || []);
      setShelves(json.shelves || []);
    } catch (error) {
      console.error('Lỗi tải danh mục:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể tải danh mục.' });
    } finally {
      setFetching(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const editItem = (item: CatalogItem) => {
    setEditingId(item.id);
    setForm({
      code: item.code || '',
      name: item.name,
      detail: item.detail || '',
      address: item.address || '',
      width: item.width || '',
      grammage: item.grammage || '',
      shelf_id: item.shelf_id ? String(item.shelf_id) : '',
      floor_number: item.floor_number || '',
      side: item.side || '',
      customer_id: item.customer_id ? String(item.customer_id) : '',
    });
    setMessage(null);
  };

  const saveItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/catalog', {
        method: editingId === null ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          ...(editingId === null ? {} : { id: editingId }),
          ...form,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể lưu danh mục.');
      resetForm();
      setMessage({ type: 'success', text: json.message || 'Đã lưu danh mục.' });
      await fetchCatalog();
    } catch (error) {
      console.error('Lỗi lưu danh mục:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể lưu danh mục.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: CatalogItem) => {
    const isActive = Boolean(item.is_active);
    if (isActive && !window.confirm(`Ngừng sử dụng "${item.name}"? Dữ liệu lịch sử sẽ được giữ nguyên.`)) return;
    setMessage(null);
    try {
      const response = await fetch('/api/catalog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id: item.id, is_active: !isActive }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể đổi trạng thái danh mục.');
      setMessage({ type: 'success', text: json.message || 'Đã cập nhật trạng thái.' });
      await fetchCatalog();
    } catch (error) {
      console.error('Lỗi cập nhật trạng thái danh mục:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Không thể cập nhật trạng thái.' });
    }
  };

  const currentLabel = catalogs.find((catalog) => catalog.kind === kind)?.label || 'Danh mục';
  const visibleItems = items.filter((item) => showInactive || Boolean(item.is_active));

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý danh mục</h1>
          <p className="mt-0.5 text-sm text-slate-500">Thêm, chỉnh sửa hoặc ngừng sử dụng dữ liệu danh mục.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFetching(true);
            void fetchCatalog();
          }}
          disabled={fetching}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
          message.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}>
          {message.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              Danh mục
              <select
                value={kind}
                onChange={(event) => {
                  const selected = event.target.value;
                  if (catalogs.some((catalog) => catalog.kind === selected)) {
                    setFetching(true);
                    setKind(selected as CatalogKind);
                    resetForm();
                  }
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800"
              >
                {catalogs.map((catalog) => <option key={catalog.kind} value={catalog.kind}>{catalog.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
              Hiện danh mục đã ngừng
            </label>
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Mã</th>
                  <th className="px-4 py-3">Tên</th>
                  <th className="px-4 py-3">Chi tiết</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fetching ? (
                  <tr><td colSpan={5} className="py-10 text-center text-slate-400">Đang tải danh mục...</td></tr>
                ) : visibleItems.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-slate-400">Danh mục chưa có dữ liệu.</td></tr>
                ) : visibleItems.map((item) => (
                  <tr key={item.id} className={item.is_active ? 'hover:bg-slate-50' : 'bg-slate-50 text-slate-400'}>
                    <td className="px-4 py-3">{item.code || '-'}</td>
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {kind === 'locations'
                        ? [item.warehouse_code, item.shelf_code, item.floor_number, item.side].filter(Boolean).join(' / ') || '-'
                        : [item.detail, item.address, item.width && `Rộng ${item.width}`, item.grammage && `${item.grammage} gsm`, item.customer_name && `KH: ${item.customer_name}`].filter(Boolean).join(' · ') || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>{item.is_active ? 'Đang dùng' : 'Đã ngừng'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => editItem(item)} title="Sửa danh mục" className="rounded-lg p-2 text-blue-600 hover:bg-blue-50">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleActive(item)}
                          title={item.is_active ? 'Ngừng sử dụng' : 'Khôi phục'}
                          className={`rounded-lg p-2 ${item.is_active ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <form onSubmit={saveItem} className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-semibold text-slate-900">{editingId === null ? `Thêm ${currentLabel.toLowerCase()}` : `Sửa ${currentLabel.toLowerCase()}`}</h2>
            {editingId === null ? <Plus className="h-4 w-4 text-blue-600" /> : (
              <button type="button" onClick={resetForm} title="Hủy sửa" className="rounded p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {kind !== 'locations' && (
            <Field label="Mã" value={form.code} onChange={(code) => setForm({ ...form, code })} required />
          )}
          <Field
            label={kind === 'locations' ? 'Mã vị trí' : 'Tên'}
            value={form.name}
            onChange={(name) => setForm({ ...form, name })}
            required
          />
          {kind === 'fabrics' && (
            <>
              <label className="block space-y-1 text-xs font-semibold text-slate-700">
                Khách hàng
                <select value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal">
                  <option value="">Chọn khách hàng (nếu đã biết)</option>
                  {customers.map((customer) => <option key={customer.customer_id} value={customer.customer_id}>{customer.customer_name} ({customer.customer_code})</option>)}
                </select>
              </label>
              <Field label="Thương hiệu" value={form.detail} onChange={(detail) => setForm({ ...form, detail })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Khổ vải" type="number" value={form.width} onChange={(width) => setForm({ ...form, width })} />
                <Field label="Định lượng (gsm)" type="number" value={form.grammage} onChange={(grammage) => setForm({ ...form, grammage })} />
              </div>
            </>
          )}
          {kind === 'types' && <Field label="Mô tả" value={form.detail} onChange={(detail) => setForm({ ...form, detail })} />}
          {kind === 'customers' && (
            <>
              <Field label="Điện thoại" value={form.detail} onChange={(detail) => setForm({ ...form, detail })} />
              <Field label="Địa chỉ" value={form.address} onChange={(address) => setForm({ ...form, address })} />
            </>
          )}
          {kind === 'locations' && (
            <>
              <label className="block space-y-1 text-xs font-semibold text-slate-700">
                Kệ
                <select required value={form.shelf_id} onChange={(event) => setForm({ ...form, shelf_id: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal">
                  <option value="">Chọn kệ</option>
                  {shelves.map((shelf) => (
                    <option key={shelf.shelf_id} value={shelf.shelf_id}>
                      {shelf.warehouse_code} / {shelf.shelf_code}{shelf.shelf_name ? ` - ${shelf.shelf_name}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tầng" value={form.floor_number} onChange={(floor_number) => setForm({ ...form, floor_number })} />
                <Field label="Bên" value={form.side} onChange={(side) => setForm({ ...form, side })} />
              </div>
            </>
          )}
          <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saving ? 'Đang lưu...' : editingId === null ? 'Thêm danh mục' : 'Lưu thay đổi'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  required?: boolean;
}) {
  return (
    <label className="block space-y-1 text-xs font-semibold text-slate-700">
      {label}
      <input
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        min={type === 'number' ? '0' : undefined}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal focus:border-blue-400 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}
