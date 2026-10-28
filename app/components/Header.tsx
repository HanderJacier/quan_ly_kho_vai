'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Bell } from 'lucide-react';

// Component con nội bộ xử lý logic searchParams
function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/inventory?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      router.push('/inventory');
    }
  };

  return (
    <form onSubmit={handleSearchSubmit} className="relative w-96">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Tìm mã cuộn, barcode, tên vải, vị trí kệ... (Nhấn Enter)"
        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
      />
    </form>
  );
}

export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Bọc trong Suspense để thỏa mãn Next.js 16 */}
      <Suspense fallback={<div className="w-96 h-9 bg-slate-100 rounded-lg animate-pulse" />}>
        <SearchBar />
      </Suspense>

      {/* Thông tin user & thông báo */}
      <div className="flex items-center gap-4">
        <button className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full"></span>
        </button>
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
            HB
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-bold text-slate-900">Nguyễn Hải Bằng</p>
            <p className="text-[11px] text-slate-500">Quản trị kho vải</p>
          </div>
        </div>
      </div>
    </header>
  );
}