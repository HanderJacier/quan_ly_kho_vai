'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, RefreshCw, Search } from 'lucide-react';
import type { FabricRoll } from '@/lib/types';

interface SavingsRoll extends FabricRoll {
  lot_code?: string | null;
  supplier_name?: string | null;
  location_name?: string | null;
}

export default function SavingsPage() {
  const [rolls, setRolls] = useState<SavingsRoll[]>([]);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingRollId, setSavingRollId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const pageSize = 50;

  const load = useCallback(async (targetPage = page, query = appliedSearch) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        stockType: 'SAVING',
        page: String(targetPage),
        pageSize: String(pageSize),
      });
      if (query.trim()) params.set('search', query.trim());
      const response = await fetch(`/api/inventory?${params}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể tải vải tiết kiệm.');
      setRolls(json.data || []);
      setTotal(json.pagination?.total ?? 0);
    } catch (error) {
      console.error('Lỗi tải vải tiết kiệm:', error);
      setMessage(error instanceof Error ? error.message : 'Không thể tải vải tiết kiệm.');
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page]);

  useEffect(() => { void load(); }, [load]);

  const moveToRegular = async (roll: SavingsRoll) => {
    setSavingRollId(roll.roll_id);
    setMessage('');
    try {
      const response = await fetch('/api/savings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll_id: roll.roll_id, target_account: 'REGULAR' }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Không thể chuyển tài khoản.');
      setMessage(json.message);
      await load();
    } catch (error) {
      console.error('Lỗi chuyển tài khoản vải:', error);
      setMessage(error instanceof Error ? error.message : 'Không thể chuyển tài khoản.');
    } finally {
      setSavingRollId(null);
    }
  };

  const searchInventory = () => {
    setPage(1);
    setAppliedSearch(search);
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Tài khoản vải tiết kiệm</h1>
        <p className="mt-1 text-sm text-slate-500">Tồn vải được đánh dấu tiết kiệm, có thể dùng khi xuất hoặc chuyển về tồn thường.</p>
      </header>
      {message && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && searchInventory()} placeholder="Tìm mã cuộn, lô, tên vải, vị trí..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
          </div>
          <button type="button" onClick={searchInventory} className="rounded-lg border px-3 py-2 text-sm">Tìm</button>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Làm mới</button>
          <a href="/export" className="rounded-lg bg-amber-600 px-3 py-2 text-center text-sm font-semibold text-white">Xuất vải tiết kiệm</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>
              <th className="px-4 py-3">Mã cuộn / lô</th><th className="px-4 py-3">Vải / màu</th><th className="px-4 py-3">Vị trí</th>
              <th className="px-4 py-3 text-right">Còn lại</th><th className="px-4 py-3">Ngày nhập / hết hạn</th><th className="px-4 py-3 text-right">Thao tác</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Đang tải...</td></tr>
                : rolls.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Chưa có tồn tiết kiệm khớp với tìm kiếm.</td></tr>
                  : rolls.map((roll) => <tr key={roll.roll_id}>
                    <td className="px-4 py-3"><strong>{roll.roll_code}</strong><div className="text-xs text-slate-500">{roll.lot_code || 'Không có mã lô'}</div></td>
                    <td className="px-4 py-3">{roll.fabric_name || '-'}<div className="text-xs text-slate-500">{roll.color_name || '-'}</div></td>
                    <td className="px-4 py-3">{roll.location_name || roll.location_code || 'Chưa xếp kệ'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{roll.quantity_remaining} {roll.unit_name || 'm'}</td>
                    <td className="px-4 py-3 text-xs">{roll.inbound_date ? new Date(roll.inbound_date).toLocaleDateString('vi-VN') : '-'}<div className="text-slate-500">{roll.expiry_date ? new Date(roll.expiry_date).toLocaleDateString('vi-VN') : '-'}</div></td>
                    <td className="px-4 py-3 text-right"><button type="button" disabled={savingRollId === roll.roll_id} onClick={() => void moveToRegular(roll)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs disabled:opacity-50"><ArrowLeftRight className="h-3.5 w-3.5" />Chuyển về tồn thường</button></td>
                  </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-600">
          <span>{total.toLocaleString('vi-VN')} cuộn tiết kiệm</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded border px-3 py-1.5 disabled:opacity-50">Trước</button>
            <button type="button" disabled={page * pageSize >= total || loading} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-1.5 disabled:opacity-50">Sau</button>
          </div>
        </div>
      </section>
    </div>
  );
}
