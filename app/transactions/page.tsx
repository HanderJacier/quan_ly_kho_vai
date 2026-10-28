'use client';

import { useState, useEffect } from 'react';
import { History, Search, Filter, RefreshCw, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Scissors, ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';

interface TransactionItem {
  trans_id: number;
  transaction_type: 'INBOUND' | 'TRANSFER' | 'OUTBOUND' | 'RETURN_IN' | 'ADJUSTMENT' | 'CUTTING';
  quantity: string | number;
  transaction_date: string;
  note: string;
  roll_code: string;
  lot_code: string | null;
  fabric_name: string;
  order_code: string | null;
  customer_name: string | null;
  from_location: string;
  to_location: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;
  const [editingTransaction, setEditingTransaction] = useState<TransactionItem | null>(null);
  const [editForm, setEditForm] = useState({ quantity: '', note: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchTransactions = async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pageSize),
      });
      if (typeFilter) params.set('type', typeFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/transactions?${params}`);
      const json = await res.json();
      if (json.success) {
        setTransactions(json.data || []);
        setTotal(json.pagination?.total ?? 0);
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử giao dịch:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(1);
  }, [typeFilter]);

  const changePage = (targetPage: number) => {
    setPage(targetPage);
    fetchTransactions(targetPage);
  };

  const handleSearch = () => {
    if (page !== 1) {
      setPage(1);
      fetchTransactions(1);
    } else {
      fetchTransactions(1);
    }
  };
  const totalPages = Math.ceil(total / pageSize);

  const startEditing = (tx: TransactionItem) => {
    setEditingTransaction(tx);
    setEditForm({
      quantity: String(tx.quantity),
      note: tx.note || '',
    });
    setEditError('');
  };

  const saveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTransaction) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const response = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trans_id: editingTransaction.trans_id,
          quantity: editForm.quantity,
          note: editForm.note,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setEditError(result.error || 'Không thể cập nhật giao dịch.');
        return;
      }
      setEditingTransaction(null);
      await fetchTransactions();
    } catch (error) {
      console.error('Lỗi cập nhật giao dịch:', error);
      setEditError('Không thể cập nhật giao dịch. Vui lòng thử lại.');
    } finally {
      setSavingEdit(false);
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'INBOUND':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'OUTBOUND':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'TRANSFER':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CUTTING':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'INBOUND':
        return <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />;
      case 'OUTBOUND':
        return <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />;
      case 'TRANSFER':
        return <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />;
      case 'CUTTING':
        return <Scissors className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <History className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nhật Ký Biến Động Kho (Audit Trail)</h1>
          <p className="text-sm text-slate-500 mt-0.5">Theo dõi chi tiết toàn bộ lịch sử Nhập, Xuất, Chuyển kệ và Cắt vải</p>
        </div>
        <button
          onClick={() => fetchTransactions()}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs self-start"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Bộ lọc */}
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
            placeholder="Tìm theo mã cuộn, tên vải, ghi chú..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => {
              setPage(1);
              setTypeFilter(e.target.value);
            }}
            className="w-full md:w-52 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả loại giao dịch</option>
            <option value="INBOUND">INBOUND (Nhập kho)</option>
            <option value="OUTBOUND">OUTBOUND (Xuất kho)</option>
            <option value="TRANSFER">TRANSFER (Chuyển kệ)</option>
            <option value="RETURN_IN">RETURN_IN (Nhập trả)</option>
            <option value="ADJUSTMENT">ADJUSTMENT (Điều chỉnh)</option>
            <option value="CUTTING">CUTTING (Cắt vải)</option>
          </select>
        </div>
      </div>

      {/* Bảng dữ liệu */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-xs">
              <tr>
                <th className="py-3 px-4">Mã GD</th>
                <th className="py-3 px-4">Loại giao dịch</th>
                <th className="py-3 px-4">Mã cuộn / Tên vải</th>
                <th className="py-3 px-4 text-right">Số lượng</th>
                <th className="py-3 px-4 text-center">Từ Kệ $\rightarrow$ Đến Kệ</th>
                <th className="py-3 px-4">Ghi chú</th>
                <th className="py-3 px-4 text-center">Thời gian</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    Đang tải nhật ký giao dịch...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    Không tìm thấy lịch sử giao dịch phù hợp.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.trans_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">#{tx.trans_id}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getBadgeStyle(tx.transaction_type)}`}>
                        {getIcon(tx.transaction_type)}
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-blue-600">{tx.roll_code}</div>
                      <div className="text-xs text-slate-500">{tx.fabric_name}{tx.lot_code ? ` · Lô ${tx.lot_code}` : ''}</div>
                      {tx.order_code && <div className="text-xs text-indigo-600">{tx.order_code} · {tx.customer_name}</div>}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800">
                      {tx.quantity ? `${parseFloat(String(tx.quantity)).toFixed(2)}m` : '-'}
                    </td>
                    <td className="py-3 px-4 text-center text-xs">
                      <span className="text-slate-500">{tx.from_location || '-'}</span>
                      <span className="mx-1.5 text-slate-400">→</span>
                      <span className="font-semibold text-slate-800">{tx.to_location || '-'}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate" title={tx.note}>
                      {tx.note || '-'}
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-slate-400">
                      {new Date(tx.transaction_date).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {tx.transaction_type === 'INBOUND' || tx.transaction_type === 'OUTBOUND' ? (
                        <button
                          type="button"
                          onClick={() => startEditing(tx)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Sửa
                        </button>
                      ) : (
                        <span
                          title={tx.transaction_type === 'TRANSFER'
                            ? 'Giao dịch chuyển kệ được quản lý tại trang Chuyển kệ.'
                            : tx.transaction_type === 'CUTTING'
                              ? 'Giao dịch cắt vải được quản lý tại trang Cắt vải.'
                              : 'Chỉ hỗ trợ chỉnh sửa trực tiếp giao dịch nhập và xuất.'}
                          className="text-[11px] text-slate-400"
                        >
                          {tx.transaction_type === 'TRANSFER'
                            ? 'Sửa tại trang Chuyển kệ'
                            : tx.transaction_type === 'CUTTING'
                              ? 'Sửa tại trang Cắt vải'
                              : 'Không hỗ trợ'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Đang xem {total === 0 ? 0 : (page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, total)} trong {total.toLocaleString('vi-VN')} giao dịch
          </span>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => changePage(Math.max(1, page - 1))}
              disabled={loading || page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Trước
            </button>
            <span className="min-w-24 text-center">Trang {page} / {Math.max(totalPages, 1)}</span>
            <button
              type="button"
              onClick={() => changePage(page + 1)}
              disabled={loading || page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50"
            >
              Sau <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={saveEdit}
            className="w-full max-w-lg space-y-5 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Chỉnh sửa giao dịch #{editingTransaction.trans_id}</h2>
                <p className="mt-1 text-sm text-slate-500">{editingTransaction.transaction_type} · {editingTransaction.roll_code}</p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                disabled={savingEdit}
                onClick={() => setEditingTransaction(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Số lượng (m)
              <input
                type="number"
                min="0.001"
                step="0.001"
                required
                value={editForm.quantity}
                onChange={(event) => setEditForm({ ...editForm, quantity: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              Ghi chú
              <textarea
                rows={3}
                maxLength={1000}
                value={editForm.note}
                onChange={(event) => setEditForm({ ...editForm, note: event.target.value })}
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </label>
            {editError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{editError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditingTransaction(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
