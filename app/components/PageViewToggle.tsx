'use client';

export type PageViewMode = 'both' | 'table' | 'entry';

interface PageViewToggleProps {
  mode: PageViewMode;
  onChange: (mode: PageViewMode) => void;
  compact?: boolean;
}

const options: { value: PageViewMode; label: string }[] = [
  { value: 'both', label: 'Nhập + bảng' },
  { value: 'table', label: 'Toàn bộ bảng' },
  { value: 'entry', label: 'Chỉ nhập' },
];

export default function PageViewToggle({ mode, onChange, compact = false }: PageViewToggleProps) {
  return (
    <div
      className={`inline-flex shrink-0 border ${
        compact
          ? 'border-slate-400 bg-gradient-to-b from-white to-slate-200 p-0.5'
          : 'rounded-lg border-slate-200 bg-white p-1 shadow-xs'
      }`}
      aria-label="Chế độ hiển thị"
    >
      {options.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className={`font-semibold transition-colors ${
            compact
              ? `px-2 py-1 text-[10px] ${mode === value ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-white'}`
              : `rounded-md px-3 py-2 text-xs ${mode === value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
