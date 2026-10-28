'use client';

import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { Printer, X } from 'lucide-react';

export interface RollLabelData {
  roll_code: string;
  barcode: string;
  fabric_name: string;
  color_name: string;
  quantity: string;
  unit_name: string;
  lot_code: string;
  inbound_date: string;
}

type LabelField = 'roll_code' | 'fabric_name' | 'color_name' | 'quantity' | 'lot_code' | 'inbound_date';

const labelFields: Array<{ key: LabelField; label: string }> = [
  { key: 'roll_code', label: 'Mã cuộn' },
  { key: 'fabric_name', label: 'Tên vải' },
  { key: 'color_name', label: 'Màu' },
  { key: 'quantity', label: 'Số mét' },
  { key: 'lot_code', label: 'Mã lô' },
  { key: 'inbound_date', label: 'Ngày nhập' },
];

export default function RollLabelPrinter({ labels, onClose }: { labels: RollLabelData[]; onClose: () => void }) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [format, setFormat] = useState<'barcode' | 'qr'>('barcode');
  const [visibleFields, setVisibleFields] = useState<LabelField[]>(['roll_code', 'fabric_name', 'color_name', 'quantity', 'lot_code']);
  const [width, setWidth] = useState(8);
  const [height, setHeight] = useState(5);
  const [qrSources, setQrSources] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const firstLabel = labels[0];

  useEffect(() => {
    if (!firstLabel) return;
    const previewSvg = barcodeRef.current;
    if (format === 'barcode' && previewSvg) {
      Promise.resolve().then(() => {
        JsBarcode(previewSvg, firstLabel.barcode, { format: 'CODE128', displayValue: true, height: 48, margin: 4 });
        document.querySelectorAll<SVGSVGElement>('.roll-label-barcode').forEach((svg) => {
          const barcode = svg.dataset.value;
          if (barcode) JsBarcode(svg, barcode, { format: 'CODE128', displayValue: true, height: 48, margin: 4 });
        });
      }).catch((caught: unknown) => {
        console.error('Lỗi tạo barcode:', caught);
        setError('Không thể tạo barcode cho mã này.');
      });
    } else if (format === 'qr') {
      Promise.all(labels.map((label) => QRCode.toDataURL(label.barcode, { width: 160, margin: 1 })
        .then((source) => [label.barcode, source] as const)))
        .then((entries) => setQrSources(Object.fromEntries(entries)))
        .catch((caught: unknown) => {
          console.error('Lỗi tạo QR code:', caught);
          setError('Không thể tạo mã QR.');
        });
    }
  }, [firstLabel, format, labels]);

  if (!firstLabel) return null;

  const toggleField = (field: LabelField) => {
    setVisibleFields((current) => current.includes(field)
      ? current.filter((item) => item !== field)
      : [...current, field]);
  };
  const labelsReady = format === 'barcode' || labels.every((label) => Boolean(qrSources[label.barcode]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="roll-label-title" className="my-auto w-full max-w-3xl space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 id="roll-label-title" className="font-semibold text-slate-900">In tem cuộn {firstLabel.roll_code}</h2>
          <p className="text-xs text-slate-500">Chọn nội dung và kích thước tem cho cuộn này</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => window.print()} disabled={!labelsReady} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Printer className="h-4 w-4" /> In tem
          </button>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={format === 'barcode'} onChange={() => { setError(''); setFormat('barcode'); }} /> Barcode</label>
            <label className="flex items-center gap-2"><input type="radio" checked={format === 'qr'} onChange={() => { setError(''); setFormat('qr'); }} /> QR code</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs font-semibold text-slate-700">Rộng (cm)<input type="number" min="2" max="30" step="0.5" value={width} onChange={(event) => setWidth(Number(event.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm font-normal" /></label>
            <label className="space-y-1 text-xs font-semibold text-slate-700">Cao (cm)<input type="number" min="2" max="30" step="0.5" value={height} onChange={(event) => setHeight(Number(event.target.value))} className="w-full rounded-lg border px-3 py-2 text-sm font-normal" /></label>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {labelFields.map((field) => (
              <label key={field.key} className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={visibleFields.includes(field.key)} onChange={() => toggleField(field.key)} />
                {field.label}
              </label>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        </div>
        <div className="overflow-auto rounded-lg bg-slate-50 p-4">
          <div className="roll-label mx-auto flex flex-col items-center justify-center overflow-hidden border border-dashed border-slate-400 bg-white p-2 text-center" style={{ width: `${width}cm`, height: `${height}cm`, maxWidth: '100%' }}>
            {visibleFields.map((key) => (
              <span key={key} className="max-w-full truncate text-xs font-medium">
                {key === 'roll_code' ? firstLabel.roll_code
                  : key === 'fabric_name' ? firstLabel.fabric_name
                    : key === 'color_name' ? firstLabel.color_name
                      : key === 'quantity' ? `${firstLabel.quantity} ${firstLabel.unit_name}`
                        : key === 'lot_code' ? (firstLabel.lot_code ? `Lô ${firstLabel.lot_code}` : '')
                          : firstLabel.inbound_date}
              </span>
            ))}
            {format === 'barcode' ? <svg ref={barcodeRef} className="max-h-20 max-w-full" /> : qrSources[firstLabel.barcode] && <img src={qrSources[firstLabel.barcode]} alt="QR code barcode cuộn" className="h-24 w-24 object-contain" />}
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">Nội dung mã: {firstLabel.barcode}</p>
        </div>
      </div>
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .roll-label-print, .roll-label-print * { visibility: visible !important; }
        .roll-label-print { display: block !important; position: absolute; inset: 0; width: 100%; }
        .roll-label-page { display: block; break-after: page; page-break-after: always; }
        .roll-label-page:last-child { break-after: auto; page-break-after: auto; }
        .roll-label { border: 0 !important; max-width: none !important; }
      }`}</style>
      <div className="roll-label-print hidden">
        {labels.map((label) => (
          <div key={`${label.roll_code}-${label.barcode}`} className="roll-label-page flex items-center justify-center">
            <div className="roll-label flex flex-col items-center justify-center overflow-hidden p-2 text-center" style={{ width: `${width}cm`, height: `${height}cm` }}>
              {visibleFields.map((key) => (
                <span key={key} className="max-w-full truncate text-xs font-medium">
                  {key === 'roll_code' ? label.roll_code
                    : key === 'fabric_name' ? label.fabric_name
                      : key === 'color_name' ? label.color_name
                        : key === 'quantity' ? `${label.quantity} ${label.unit_name}`
                          : key === 'lot_code' ? (label.lot_code ? `Lô ${label.lot_code}` : '')
                            : label.inbound_date}
                </span>
              ))}
              {format === 'qr' ? <img src={qrSources[label.barcode]} alt="QR" className="h-24 w-24" /> : <svg className="roll-label-barcode" data-value={label.barcode} />}
            </div>
          </div>
        ))}
      </div>
    </section>
    </div>
  );
}
