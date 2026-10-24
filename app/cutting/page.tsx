'use client';

import { useState, useEffect } from 'react';
import { Scissors, ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, History } from 'lucide-react';
import Link from 'next/link';

interface FabricRoll {
  roll_id: number;
  roll_code: string;
  fabric_name?: string;
  color_name?: string;
  quantity_remaining: string | number;
  unit_name?: string;
  location_name?: string;
}

interface CuttingHistory {
  cutting_id: number;
  cutting_date: string;
  cut_quantity: string;
  remaining_quantity: string;
  note: string;
  parent_roll_code: string;
  fabric_name: string;
}

export default function CuttingPage() {
  const [rolls, setRolls] = useState<FabricRoll[]>([]);
  const [history, setHistory] = useState<CuttingHistory[]>([]);
  
  const [parentRollId, setParentRollId] = useState<string>('');
  const [cutQuantity, setCutQuantity] = useState<string>('');
  const [newRollCode, setNewRollCode] = useState<string>('');
  const [newBarcode, setNewBarcode] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Lấy danh sách cuộn vải và lịch sử cắt
  const fetchData = async () => {
    setFetching(true);
    try {
      const [invRes, cutRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/cutting')
      ]);

      const invJson = await invRes.json();
      const cutJson = await cutRes.json();

      if (invJson.success) setRolls(invJson.data || []);
      if (cutJson.success) setHistory(cutJson.data || []);
    } catch (err) {
      console.error('Lỗi nạp dữ liệu:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Tự động tạo mã cuộn con gợi ý khi chọn cuộn mẹ
  const handleSelectParent = (id: string) => {
    setParentRollId(id);
    const selected = rolls.find((r) => String(r.roll_id) === id);
    if (selected) {
      setNewRollCode(`${selected.roll_code}-C1`);
    } else {
      setNewRollCode('');
    }
  };

  const selectedRoll = rolls.find((r) => String(r.roll_id) === parentRollId);
  const currentQty = selectedRoll ? parseFloat(String(selectedRoll.quantity_remaining)) : 0;
  const cutQtyNum = parseFloat(cutQuantity) || 0;
  const remainingAfterCut = Math.max(0, currentQty - cutQtyNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentRollId || cutQtyNum <= 0 || !newRollCode) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/cutting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_roll_id: Number(parentRollId),
          cut_quantity: cutQtyNum,
          new_roll_code: newRollCode,
          new_barcode: newBarcode || undefined,
          note: note || undefined,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setMessage({
          type: 'success',
          text: `Cắt thành công! Đã tạo cuộn con ${json.data.child_roll_code} (${cutQtyNum}m). Cuộn mẹ còn ${json.data.parent_remaining_qty}m.`,
        });
        setCutQuantity('');
        setNote('');
        setNewBarcode('');
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
            <h1 className="text-2xl font-bold text-slate-900">Cắt Vải & Tách Cuộn Con</h1>
            <p className="text-sm text-slate-500 mt-0.5">Trừ số lượng cuộn mẹ và tự động tạo cuộn con mới trong database</p>
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

      {/* Form Cắt vải */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
            <Scissors className="w-5 h-5 text-blue-600" />
            <span>Thao tác tách cuộn</span>
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
          {/* Chọn cuộn mẹ */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Chọn cuộn mẹ (parent_roll_id) <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={parentRollId}
              onChange={(e) => handleSelectParent(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Chọn mã cuộn từ kho --</option>
              {rolls.map((roll) => (
                <option key={roll.roll_id} value={roll.roll_id}>
                  {roll.roll_code} | {roll.fabric_name || 'Vải'} - Tồn: {roll.quantity_remaining} {roll.unit_name || 'm'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mã cuộn con mới */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mã cuộn con mới (new_roll_code) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newRollCode}
                onChange={(e) => setNewRollCode(e.target.value)}
                placeholder="VD: CV-001-C1"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Mã vạch cuộn con */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mã vạch cuộn con (new_barcode)
              </label>
              <input
                type="text"
                value={newBarcode}
                onChange={(e) => setNewBarcode(e.target.value)}
                placeholder="Bỏ trống để tự tạo tự động"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Số lượng cắt */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Chiều dài cắt (cut_quantity) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                max={currentQty || undefined}
                value={cutQuantity}
                onChange={(e) => setCutQuantity(e.target.value)}
                placeholder="VD: 25.5"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Dự tính còn lại */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Cuộn mẹ còn lại
              </label>
              <div className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800">
                {selectedRoll ? `${remainingAfterCut.toFixed(2)} ${selectedRoll.unit_name || 'm'}` : '-'}
              </div>
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
            disabled={loading || !parentRollId || cutQtyNum <= 0 || cutQtyNum > currentQty || !newRollCode}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
          >
            <Scissors className="w-4 h-4" />
            <span>{loading ? 'Đang xử lý Transaction...' : 'Xác nhận Cắt Vải'}</span>
          </button>
        </div>
      </form>

      {/* Nhật ký Lịch sử Cắt vải */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-semibold text-base border-b border-slate-100 pb-3">
          <History className="w-5 h-5 text-slate-600" />
          <span>Lịch sử cắt vải (cutting_orders)</span>
        </div>

        {history.length === 0 ? (
          <p className="text-center py-6 text-xs text-slate-400">Chưa có lịch sử cắt vải</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-xs">
                <tr>
                  <th className="py-2.5 px-3">Mã cắt</th>
                  <th className="py-2.5 px-3">Cuộn mẹ</th>
                  <th className="py-2.5 px-3">Tên vải</th>
                  <th className="py-2.5 px-3 text-right">Đã cắt</th>
                  <th className="py-2.5 px-3 text-right">Mẹ còn lại</th>
                  <th className="py-2.5 px-3">Ghi chú</th>
                  <th className="py-2.5 px-3 text-center">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {history.map((item) => (
                  <tr key={item.cutting_id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">#{item.cutting_id}</td>
                    <td className="py-2.5 px-3 font-medium text-blue-600">{item.parent_roll_code}</td>
                    <td className="py-2.5 px-3 text-slate-700">{item.fabric_name}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600">-{parseFloat(item.cut_quantity)} m</td>
                    <td className="py-2.5 px-3 text-right text-slate-800">{parseFloat(item.remaining_quantity)} m</td>
                    <td className="py-2.5 px-3 text-slate-500">{item.note || '-'}</td>
                    <td className="py-2.5 px-3 text-center text-slate-400">
                      {new Date(item.cutting_date).toLocaleDateString('vi-VN')}
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