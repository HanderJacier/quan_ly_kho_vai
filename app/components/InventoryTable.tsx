'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, AlertTriangle, RefreshCw } from 'lucide-react';

interface InventoryItem {
  roll_id: number;
  roll_code: string;
  fabric_name: string;
  color_name: string;
  current_quantity: string;
  unit_name: string;
  location_name: string;
  shelf_name: string;
  warehouse_name: string;
  days_in_stock: number;
  customer_name?: string;
  stock_type?: string;
}

export default function InventoryTable() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
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
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Lọc dữ liệu phía Client
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        (item.roll_code?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.fabric_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.color_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (item.location_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      const matchLocation = filterLocation ? item.location_name === filterLocation : true;
      const matchOverdue = onlyOverdue ? item.days_in_stock > 730 : true;

      return matchSearch && matchLocation && matchOverdue;
    });
  }, [items, searchTerm, filterLocation, onlyOverdue]);

  // Lấy danh sách vị trí duy nhất cho dropdown lọc
  const locationOptions = Array.from(new Set(items.map((i) => i.location_name).filter(Boolean)));

  return (
    <div className="space-y-4">
      {/* Thanh công cụ Tìm kiếm & Bộ lọc */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-1 min-w-[280px] gap-2 items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm mã cuộn, tên vải, mã màu, vị trí kệ..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* Lọc vị trí Kệ */}
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả Vị trí Kệ</option>
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          {/* Nút lọc Tồn lâu > 2 năm */}
          <button
            type="button"
            onClick={() => setOnlyOverdue(!onlyOverdue)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              onlyOverdue
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Hàng tồn &gt; 2 năm</span>
          </button>

          {/* Nút Làm mới */}
          <button
            type="button"
            onClick={fetchInventory}
            disabled={loading}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bảng Dữ liệu Tồn kho */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs text-slate-500 font-medium">
          <span>Hiển thị {filteredItems.length} / {items.length} cuộn vải</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Đang nạp dữ liệu kho...</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">Không tìm thấy cuộn vải phù hợp</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-4">Mã Cuộn</th>
                  <th className="py-3 px-4">Tên Vải</th>
                  <th className="py-3 px-4">Màu</th>
                  <th className="py-3 px-4 text-right">Số lượng tồn</th>
                  <th className="py-3 px-4">Vị trí Kệ</th>
                  <th className="py-3 px-4">Khách hàng</th>
                  <th className="py-3 px-4 text-center">Thời gian tồn kho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.roll_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{item.roll_code}</td>
                    <td className="py-3 px-4 text-slate-800">{item.fabric_name}</td>
                    <td className="py-3 px-4 text-slate-600">{item.color_name || '-'}</td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">
                      {parseFloat(item.current_quantity).toLocaleString('vi-VN')} {item.unit_name || 'm'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {item.location_name || 'Chưa xếp kệ'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{item.customer_name || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.days_in_stock > 730
                            ? 'bg-amber-100 text-amber-800 font-bold border border-amber-300'
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