'use client';

import { useEffect, useState } from 'react';
import { Package, Layers, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface InventoryItem {
  roll_id: number;
  roll_code: string;
  fabric_name: string;
  color_name: string;
  current_quantity: string;
  unit_name: string;
  days_in_stock: number;
  location_name: string;
  shelf_name: string;
  warehouse_name: string;
}

export default function DashboardOverview() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInventory() {
      try {
        const res = await fetch('/api/inventory');
        const json = await res.json();
        if (json.success) {
          setItems(json.data || []);
        }
      } catch (err) {
        console.error('Lỗi lấy dữ liệu tồn kho:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchInventory();
  }, []);

  const totalRolls = items.length;
  const totalMeters = items.reduce((acc, item) => acc + (parseFloat(item.current_quantity) || 0), 0);
  const agingRolls = items.filter((item) => item.days_in_stock > 730).length;
  const uniqueLocations = new Set(items.map((i) => i.location_name).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan Kho vải</h1>
        <p className="text-sm text-slate-500 mt-1">
          Theo dõi các chỉ số Nhập - Xuất - Tồn kho theo thời gian thực
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số cuộn</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : totalRolls.toLocaleString('vi-VN')}
            </h3>
            <span className="text-xs text-slate-500 mt-1 block">Cuộn vải đang lưu kho</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng sản lượng</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : `${totalMeters.toLocaleString('vi-VN')} m`}
            </h3>
            <span className="text-xs text-slate-500 mt-1 block">Tổng mét vải thực tế</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tồn lâu (&gt; 2 năm)</p>
            <h3 className={`text-2xl font-bold mt-1 ${agingRolls > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {loading ? '...' : `${agingRolls} cuộn`}
            </h3>
            <span className="text-xs text-slate-500 mt-1 block">Cần ưu tiên xuất trước</span>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${agingRolls > 0 ? 'bg-amber-50 border border-amber-100 text-amber-600' : 'bg-slate-50 border border-slate-100 text-slate-400'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vị trí Kệ sử dụng</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? '...' : `${uniqueLocations} vị trí`}
            </h3>
            <span className="text-xs text-slate-500 mt-1 block">Đang chứa hàng</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Cuộn vải tồn kho mới nhất</h2>
            <p className="text-xs text-slate-500">Danh sách các cuộn vải lưu trữ gần đây</p>
          </div>
          <Link
            href="/inventory"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">Đang tải dữ liệu kho...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">Chưa có dữ liệu tồn kho</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-4">Mã cuộn</th>
                  <th className="py-3 px-4">Tên vải</th>
                  <th className="py-3 px-4">Màu sắc</th>
                  <th className="py-3 px-4 text-right">Số lượng</th>
                  <th className="py-3 px-4">Vị trí Kệ</th>
                  <th className="py-3 px-4 text-center">Thời gian lưu kho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.slice(0, 5).map((item) => (
                  <tr key={item.roll_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.roll_code}</td>
                    <td className="py-3 px-4 text-slate-700">{item.fabric_name}</td>
                    <td className="py-3 px-4 text-slate-600">{item.color_name || '-'}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">
                      {parseFloat(item.current_quantity).toLocaleString('vi-VN')} {item.unit_name || 'm'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {item.location_name || 'Chưa gán'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.days_in_stock > 730
                            ? 'bg-amber-100 text-amber-800 font-semibold'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {item.days_in_stock} ngày
                      </span>
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