'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SearchableComboboxOption {
  value: string;
  label: string;
}

export interface SearchableComboboxCreateField {
  name: string;
  label: string;
  required?: boolean;
  options?: SearchableComboboxOption[];
}

interface SearchableComboboxProps {
  value: string;
  options: SearchableComboboxOption[];
  onChange: (value: string) => void;
  onQueryChange?: (query: string) => void;
  createFields?: SearchableComboboxCreateField[];
  onCreateOption?: (label: string, fields: Record<string, string>) => Promise<SearchableComboboxOption>;
  placeholder?: string;
  required?: boolean;
  ariaLabel: string;
  className?: string;
}

export default function SearchableCombobox({
  value,
  options,
  onChange,
  onQueryChange,
  createFields,
  onCreateOption,
  placeholder = 'Tìm hoặc chọn...',
  required = false,
  ariaLabel,
  className = '',
}: SearchableComboboxProps) {
  const generatedId = useId();
  const inputId = `searchable-combobox-${generatedId}`;
  const listId = `${inputId}-options`;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [savingNewOption, setSavingNewOption] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  const [createdOption, setCreatedOption] = useState<SearchableComboboxOption | null>(null);

  useEffect(() => {
    if (!onQueryChange || !open || creating) return;
    const timeout = window.setTimeout(() => onQueryChange(query), 250);
    return () => window.clearTimeout(timeout);
  }, [creating, onQueryChange, open, query]);

  const availableOptions = useMemo(
    () => createdOption && !options.some((option) => option.value === createdOption.value)
      ? [...options, createdOption]
      : options,
    [createdOption, options]
  );
  const selectedOption = availableOptions.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    if (onQueryChange) return availableOptions;
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return availableOptions;
    return availableOptions.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery));
  }, [availableOptions, onQueryChange, query]);
  const hasExactOption = availableOptions.some((option) => option.label.trim().toLocaleLowerCase() === query.trim().toLocaleLowerCase());

  const selectOption = (option: SearchableComboboxOption) => {
    onChange(option.value);
    setQuery('');
    setOpen(false);
    setCreating(false);
    setCreateError('');
    setActiveIndex(0);
    inputRef.current?.setCustomValidity('');
  };

  const createOption = async () => {
    if (!onCreateOption || !query.trim()) return;
    const missingField = createFields?.find((field) => field.required && !createValues[field.name]?.trim());
    if (missingField) {
      setCreateError(`Vui lòng nhập ${missingField.label.toLowerCase()}.`);
      return;
    }
    setSavingNewOption(true);
    setCreateError('');
    try {
      const option = await onCreateOption(query.trim(), createValues);
      setCreatedOption(option);
      selectOption(option);
      setCreateValues({});
    } catch (error) {
      console.error('Lỗi thêm mục danh mục:', error);
      setCreateError(error instanceof Error ? error.message : 'Không thể thêm mục danh mục.');
    } finally {
      setSavingNewOption(false);
    }
  };

  return (
    <div ref={containerRef} className="relative min-w-0">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open && !creating ? listId : undefined}
          aria-activedescendant={open && !creating && filteredOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          required={required}
          value={open ? query : selectedOption?.label || ''}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 ${className}`}
          onFocus={(event) => {
            setQuery(selectedOption?.label || '');
            setOpen(true);
            setActiveIndex(0);
            event.currentTarget.select();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
            setCreating(false);
            setCreateError('');
            setCreateValues({});
            onChange('');
            inputRef.current?.setCustomValidity(required ? 'Chọn một mục trong danh sách.' : '');
          }}
          onBlur={(event) => {
            if (event.relatedTarget instanceof Node && containerRef.current?.contains(event.relatedTarget)) return;
            window.setTimeout(() => {
              if (containerRef.current?.contains(document.activeElement)) return;
              setOpen(false);
              setQuery('');
            }, 100);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter' && open) {
              event.preventDefault();
              const option = filteredOptions[activeIndex];
              if (option) selectOption(option);
              else inputRef.current?.setCustomValidity(required ? 'Chọn một mục trong danh sách.' : '');
            } else if (event.key === 'Escape' && open) {
              event.preventDefault();
              setOpen(false);
              setQuery('');
            }
          }}
        />
        {value ? (
          <button
            type="button"
            aria-label={`Xóa lựa chọn ${ariaLabel}`}
            onClick={() => {
              onChange('');
              setOpen(true);
              inputRef.current?.focus();
              setQuery('');
              inputRef.current?.setCustomValidity(required ? 'Chọn một mục trong danh sách.' : '');
            }}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && !creating && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">Không tìm thấy mục phù hợp.</li>
          ) : filteredOptions.map((option, index) => (
            <li key={option.value} id={`${listId}-${index}`} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm ${
                  index === activeIndex ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && onCreateOption && query.trim() && !hasExactOption && (
        <div className="absolute z-[60] mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          {!creating ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setCreating(true)}
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              + Thêm “{query.trim()}” vào danh mục
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-800">Thêm mục mới: {query.trim()}</p>
              {createFields?.map((field) => (
                <label key={field.name} className="block space-y-1 text-xs font-semibold text-slate-700">
                  {field.label}
                  {field.options ? (
                    <select
                      required={field.required}
                      value={createValues[field.name] || ''}
                      onChange={(event) => setCreateValues((values) => ({ ...values, [field.name]: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal"
                    >
                      <option value="">Chọn {field.label.toLowerCase()}</option>
                      {field.options.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required={field.required}
                      value={createValues[field.name] || ''}
                      onChange={(event) => setCreateValues((values) => ({ ...values, [field.name]: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
                    />
                  )}
                </label>
              ))}
              {createError && <p role="alert" className="text-xs text-rose-700">{createError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={savingNewOption}
                  onClick={() => { setCreating(false); setCreateError(''); }}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void createOption()}
                  disabled={savingNewOption}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {savingNewOption ? 'Đang thêm...' : 'Tạo và chọn'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
