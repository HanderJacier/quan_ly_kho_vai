'use client';

export type PageViewMode = 'both' | 'table' | 'entry';

interface PageViewToggleProps {
  mode: PageViewMode;
  onChange: (mode: PageViewMode) => void;
}

const options: { value: PageViewMode; label: string }[] = [
  { value: 'both', label: 'Nhập + bảng' },
  { value: 'table', label: 'Toàn bộ bảng' },
  { value: 'entry', label: 'Chỉ nhập' },
];

export default function PageViewToggle({ mode, onChange }: PageViewToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-xs" aria-label="Chế độ hiển thị">
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
            mode === value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
