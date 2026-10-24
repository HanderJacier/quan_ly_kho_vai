'use client';

import { useState } from 'react';
import { PackagePlus, Save, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface InboundForm {
  roll_code: string;
  barcode: string;
  fabric_id: string;
  color_id: string;
  type_id: string;
  location_id: string;
  quantity_initial: string;
  unit_id: string;
  note: string;
}

const initialFormData: InboundForm = {
  roll_code: '',
  barcode: '',
  fabric_id: '1',
  color_id: '1',
  type_id: '1',
  location_id: '1',
  quantity_initial: '',
  unit_id: '1',
  note: '',
};

export default function InboundPage() {
  const [formData, setFormData] = useState<InboundForm>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/fabric-rolls/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          fabric_id: Number(formData.fabric_id),
          color_id: formData.color_id ? Number(formData.color_id) : null,
          type_id: formData.type_id ? Number(formData.type_id) : null,
          location_id: formData.location_id ? Number(formData.location_id) : null,
          unit_id: formData.unit_id ? Number(formData.unit_id) : null,
          quantity_initial: Number(formData.quantity_initial),
        }),
      });

      const json = await res.json();

      if (json.success) {
        setMessage({ type: 'success', text: `Nhập kho thành công cuộn vải ${formData.roll_code} (ID: ${json.roll_id})!` });
        setFormData(initialFormData);
      } else {
        setMessage({ type: 'error', text: json.error || 'Có lỗi xảy ra khi nhập kho' });
      }
    } catch (err) {
      console.error('Lỗi kết nối API nhập kho:', err);
      setMessage({ type: 'error', text: 'Không thể kết nối tới server' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/inventory"
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Nhập Kho Vải Mới</h1>
            <p className="text-sm text-slate-500 mt-0.5">Lưu thông tin cuộn vải mới vào database TiDB</p>
          </div>
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

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100 text-slate-900 font-semibold text-base">
          <PackagePlus className="w-5 h-5 text-blue-600" />
          <span>Thông tin cuộn vải (fabric_rolls)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mã cuộn (roll_code) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="roll_code"
              required
              value={formData.roll_code}
              onChange={handleChange}
              placeholder="VD: CV-2026-001"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mã vạch (barcode)
            </label>
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
              placeholder="VD: 893123456789"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Loại vải ID (fabric_id) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              name="fabric_id"
              required
              value={formData.fabric_id}
              onChange={handleChange}
              placeholder="VD: 1"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Màu ID (color_id)
            </label>
            <input
              type="number"
              name="color_id"
              value={formData.color_id}
              onChange={handleChange}
              placeholder="VD: 1"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Vị trí Kệ ID (location_id)
            </label>
            <input
              type="number"
              name="location_id"
              value={formData.location_id}
              onChange={handleChange}
              placeholder="VD: 1"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Số lượng ban đầu <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="quantity_initial"
                required
                value={formData.quantity_initial}
                onChange={handleChange}
                placeholder="100.00"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Đơn vị ID
              </label>
              <input
                type="number"
                name="unit_id"
                value={formData.unit_id}
                onChange={handleChange}
                placeholder="1"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Ghi chú (note)
          </label>
          <textarea
            name="note"
            rows={3}
            value={formData.note}
            onChange={handleChange}
            placeholder="Ghi chú về lô vải..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setFormData(initialFormData)}
            className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Làm mới
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Đang lưu TiDB...' : 'Xác nhận Nhập Kho'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}