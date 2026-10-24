'use client';

import { useState, useEffect } from 'react';
import { PackageMinus, ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, History, Truck } from 'lucide-react';
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

interface ExportTransaction {
  trans_id: number;
  roll_code: string;
  fabric_name: string;
  quantity: string;
  from_location: string;
  transaction_date: string;
  note: string;
}

export default function ExportPage() {
  const [rolls, setRolls] = useState<FabricRoll[]>([]);
  const [history, setHistory] = useState<ExportTransaction[]>([]);

  const [selectedRollId, setSelectedRollId] = useState<string>('');
  const [exportQuantity, setExportQuantity] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load danh sách cuộn vải còn hàng và lịch sử xuất kho
  const fetchData = async () => {
    setFetching(true);
    try {
      const [invRes, transRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/transactions?type=EXPORT'),
      ]);

      const invJson = await invRes.json();
      const transJson = await transRes.json();

      if (invJson.success) {
        // Chỉ lọc lấy những cuộn vải còn tồn kho > 0
        const activeRolls = (invJson.data || []).filter(
          (r: FabricRoll) => parseFloat(String(r.quantity_remaining)) > 0
        );
        setRolls(activeRolls);
      }
      if (transJson.success) {
        setHistory(transJson.data || []);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu xuất kho:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedRoll = rolls.find((r) => String(r.roll_id) === selectedRollId);
  const currentQty = selectedRoll ? parseFloat(String(selectedRoll.quantity_remaining)) : 0;
  const exportQtyNum = parseFloat(exportQuantity) || 0;
  const remainingAfterExport = Math.max(0, currentQty - exportQtyNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRollId || exportQtyNum <= 0 || exportQtyNum > currentQty) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: 'EXPORT',
          roll_id: Number(selectedRollId),
          quantity: exportQtyNum,
          note: note || undefined,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setMessage({ type: 'success', text: json.message });
        setSelectedRollId('');
        setExportQuantity('');
        setNote('');
        fetchData(); // Tải lại dữ liệu sau khi trừ tồn kho thành công
      } else {
        setMessage({ type: 'error', text: json.error || 'Có lỗi xảy ra khi xuất kho' });
      }
    } catch (err) {
      console.error('Lỗi xuất kho:', err);
      setMessage({ type: 'error', text: 'Không thể kết nối tới máy chủ' });
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
            <h1 className="text-2xl font-bold text-slate-900">Xuất Kho Vải</h1>
            <p className="text-sm text-slate-500 mt-0.5">Trừ số lượng vải xuất bán/xuất xưởng và lưu giao dịch EXPORT</p>
          </div>
        </div>
      </div>

      {/* Thông báo kết quả */}
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

      {/* Form Xuất Kho */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-base">
            <PackageMinus className="w-5 h-5 text-rose-600" />
            <span>Thông tin phiếu xuất kho</span>
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
          {/* Chọn cuộn vải */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Chọn cuộn vải xuất kho <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={selectedRollId}
              onChange={(e) => setSelectedRollId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            >
              <option value="">-- Chọn cuộn vải từ tồn kho --</option>
              {rolls.map((roll) => (
                <option key={roll.roll_id} value={roll.roll_id}>
                  {roll.roll_code} | {roll.fabric_name || 'Vải'} - Tồn: {roll.quantity_remaining} {roll.unit_name || 'm'} (Kệ: {roll.location_name || 'Chưa xếp'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Số lượng xuất */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Số lượng xuất kho <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                max={currentQty || undefined}
                value={exportQuantity}
                onChange={(e) => setExportQuantity(e.target.value)}
                placeholder="VD: 50.0"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white"
              />
            </div>

            {/* Dự tính tồn còn lại */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tồn kho còn lại sau xuất
              </label>
              <div className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800">
                {selectedRoll ? `${remainingAfterExport.toFixed(2)} ${selectedRoll.unit_name || 'm'}` : '-'}
              </div>
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Ghi chú xuất kho / Mã đơn hàng
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Xuất cho đơn hàng KH-2026-08, xuất cho xưởng may A..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Nút gửi */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={loading || !selectedRollId || exportQtyNum <= 0 || exportQtyNum > currentQty}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs"
          >
            <Truck className="w-4 h-4" />
            <span>{loading ? 'Đang thực hiện EXPORT...' : 'Xác Nhận Xuất Kho'}</span>
          </button>
        </div>
      </form>

      {/* Lịch sử Xuất kho */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-semibold text-base border-b border-slate-100 pb-3">
          <History className="w-5 h-5 text-slate-600" />
          <span>Lịch sử xuất kho (EXPORT Transactions)</span>
        </div>

        {history.length === 0 ? (
          <p className="text-center py-6 text-xs text-slate-400">Chưa có dữ liệu xuất kho</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-xs">
                <tr>
                  <th className="py-2.5 px-3">Mã GD</th>
                  <th className="py-2.5 px-3">Mã cuộn</th>
                  <th className="py-2.5 px-3">Tên vải</th>
                  <th className="py-2.5 px-3 text-right">Số lượng xuất</th>
                  <th className="py-2.5 px-3">Kệ xuất</th>
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
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                      -{parseFloat(item.quantity)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{item.from_location || '-'}</td>
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