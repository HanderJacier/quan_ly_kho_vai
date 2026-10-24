'use client';

import { useState, useEffect } from 'react';
import { ArrowLeftRight, ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, MapPin, History } from 'lucide-react';
import Link from 'next/link';

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

export default function LocationTransferPage() {
  const [rolls, setRolls] = useState<FabricRoll[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [history, setHistory] = useState<TransactionLog[]>([]);

  const [selectedRollId, setSelectedRollId] = useState<string>('');
  const [newLocationId, setNewLocationId] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    setFetching(true);
    try {
      const [invRes, locRes, transRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/locations'),
        fetch('/api/transactions?type=TRANSFER'),
      ]);

      const invJson = await invRes.json();
      const locJson = await locRes.json();
      const transJson = await transRes.json();

      if (invJson.success) setRolls(invJson.data || []);
      if (locJson.success) setLocations(locJson.data || []);
      if (transJson.success) setHistory(transJson.data || []);
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedRoll = rolls.find((r) => String(r.roll_id) === selectedRollId);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedRollId || !newLocationId) return;

  setLoading(true);
  setMessage(null);

  try {
    const res = await fetch('/api/transactions', {
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
  } catch (err) {
    setMessage({ type: 'error', text: 'Không thể kết nối máy chủ' });
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/inventory"
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Điều Chuyển Vị Trí Kệ</h1>
            <p className="text-sm text-slate-500 mt-0.5">Cập nhật vị trí lưu kho mới và lưu vết giao dịch TRANSFER</p>
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

      {/* Form Đổi Kệ */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            <span>Thao tác đổi kệ lưu trữ</span>
          </div>
          <button
            type="button"
            onClick={fetchData}
            disabled={fetching}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-md transition-colors"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Chọn cuộn vải <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={selectedRollId}
              onChange={(e) => setSelectedRollId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Chọn mã cuộn từ tồn kho --</option>
              {rolls.map((roll) => (
                <option key={roll.roll_id} value={roll.roll_id}>
                  {roll.roll_code} | {roll.fabric_name || 'Vải'} - Vị trí hiện tại: {roll.location_name || 'Chưa xếp kệ'}
                </option>
              ))}
            </select>
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
            <select
              required
              value={newLocationId}
              onChange={(e) => setNewLocationId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Chọn vị trí kệ đích --</option>
              {locations.map((loc) => (
                <option key={loc.location_id} value={loc.location_id}>
                  {loc.location_code} ({loc.location_name || 'Kệ kho'})
                </option>
              ))}
            </select>
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
            disabled={loading || !selectedRollId || !newLocationId}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>{loading ? 'Đang ghi nhận Transaction...' : 'Xác nhận Đổi Kệ'}</span>
          </button>
        </div>
      </form>

      {/* Nhật ký di chuyển kệ */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-semibold text-base border-b border-slate-100 pb-3">
          <History className="w-5 h-5 text-slate-600" />
          <span>Nhật ký di chuyển kệ (inventory_transactions)</span>
        </div>

        {history.length === 0 ? (
          <p className="text-center py-6 text-xs text-slate-400">Chưa có lịch sử chuyển vị trí kệ</p>
        ) : (
          <div className="overflow-x-auto">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}