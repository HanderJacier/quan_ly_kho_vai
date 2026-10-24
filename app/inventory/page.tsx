import InventoryTable from '@/app/components/InventoryTable';

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quản lý Tồn Kho Vải</h1>
        <p className="text-sm text-slate-500 mt-1">Tra cứu vị trí kệ, tìm kiếm mã cuộn và kiểm tra cảnh báo tồn lâu</p>
      </div>

      <InventoryTable />
    </div>
  );
}