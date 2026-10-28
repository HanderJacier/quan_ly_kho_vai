export type CatalogCreateKind = 'fabrics' | 'colors' | 'types' | 'units' | 'locations' | 'customers';

export interface CatalogOption {
  value: string;
  label: string;
}

export async function createCatalogOption(
  kind: CatalogCreateKind,
  name: string,
  fields: Record<string, string>
): Promise<CatalogOption> {
  const response = await fetch('/api/catalog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, name, ...fields }),
  });
  const json = await response.json();
  if (!response.ok || !json.success || !json.data?.id) {
    throw new Error(json.error || 'Không thể thêm mục danh mục.');
  }
  return { value: String(json.data.id), label: name };
}
