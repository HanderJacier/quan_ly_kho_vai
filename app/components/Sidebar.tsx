'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  PackagePlus,
  Scissors,
  ArrowLeftRight,
  PackageMinus,
  Warehouse,
} from 'lucide-react';

const navItems = [
  {
    name: 'Tổng quan',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'Quản lý Tồn kho',
    href: '/inventory',
    icon: Boxes,
  },
  {
    name: 'Nhập kho vải',
    href: '/inbound',
    icon: PackagePlus,
  },
  {
    name: 'Cắt vải & Tách cuộn',
    href: '/cutting',
    icon: Scissors,
  },
  {
    name: 'Đổi vị trí kệ',
    href: '/locations/transfer',
    icon: ArrowLeftRight,
  },
  {
    name: 'Xuất kho vải',
    href: '/export',
    icon: PackageMinus,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-screen p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-6">
        {/* Logo / Header Kho */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-800">
          <div className="p-2 bg-blue-600 rounded-lg text-white">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base leading-tight">WMS Vải Fabric</h2>
            <p className="text-xs text-slate-500">Quản lý kho TiDB</p>
          </div>
        </div>

        {/* Danh sách Menu */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Sidebar */}
      <div className="p-3 border-t border-slate-800 text-xs text-slate-500 text-center">
        V 1.0.0 • Next.js 16
      </div>
    </aside>
  );
}