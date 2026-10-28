import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import { db } from '@/lib/db';

const catalogKinds = ['fabrics', 'colors', 'types', 'units', 'customers', 'locations'] as const;
type CatalogKind = (typeof catalogKinds)[number];

const catalogConfig: Record<CatalogKind, { table: string; id: string; name: string; code: string }> = {
  fabrics: { table: 'fabrics', id: 'fabric_id', name: 'fabric_name', code: 'fabric_code' },
  colors: { table: 'fabric_colors', id: 'color_id', name: 'color_name', code: 'color_code' },
  types: { table: 'fabric_types', id: 'type_id', name: 'type_name', code: 'type_code' },
  units: { table: 'units', id: 'unit_id', name: 'unit_name', code: 'unit_code' },
  customers: { table: 'customers', id: 'customer_id', name: 'customer_name', code: 'customer_code' },
  locations: { table: 'locations', id: 'location_id', name: 'location_code', code: 'location_code' },
};

interface CatalogRow extends RowDataPacket {
  id: number;
  code: string | null;
  name: string;
  is_active: number;
  detail: string | null;
  shelf_id: number | null;
  shelf_code: string | null;
  warehouse_code: string | null;
  address: string | null;
  width: string | null;
  grammage: string | null;
  floor_number: string | null;
  side: string | null;
  customer_id: number | null;
  customer_name: string | null;
}

interface ShelfRow extends RowDataPacket {
  shelf_id: number;
  shelf_code: string;
  shelf_name: string | null;
  warehouse_code: string;
}

function readCatalogKind(value: string | null): CatalogKind | null {
  return catalogKinds.find((kind) => kind === value) ?? null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text || null;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : Number.NaN;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = readCatalogKind(searchParams.get('kind'));
  if (!kind) {
    return NextResponse.json({ success: false, error: 'Danh mục không hợp lệ.' }, { status: 400 });
  }

  try {
    const config = catalogConfig[kind];
    const query = kind === 'locations'
      ? `SELECT l.location_id AS id, l.location_code AS code, l.location_code AS name,
                l.is_active, CONCAT_WS(' / ', l.floor_number, l.side) AS detail,
                l.shelf_id, s.shelf_code, w.warehouse_code, NULL AS address,
                NULL AS width, NULL AS grammage, l.floor_number, l.side
         FROM locations l
         LEFT JOIN shelves s ON l.shelf_id = s.shelf_id
         LEFT JOIN warehouses w ON s.warehouse_id = w.warehouse_id
         ORDER BY l.location_code`
      : `SELECT ${config.id} AS id, ${config.code} AS code, ${config.name} AS name,
                is_active, ${kind === 'customers' ? 'phone' : kind === 'fabrics' ? 'brand' : kind === 'types' ? 'description' : 'NULL'} AS detail,
                NULL AS shelf_id, NULL AS shelf_code, NULL AS warehouse_code,
                ${kind === 'customers' ? 'address' : 'NULL'} AS address,
                ${kind === 'fabrics' ? 'width' : 'NULL'} AS width,
                ${kind === 'fabrics' ? 'grammage' : 'NULL'} AS grammage,
                ${kind === 'fabrics' ? 'customer_id' : 'NULL'} AS customer_id,
                ${kind === 'fabrics' ? 'c.customer_name' : 'NULL'} AS customer_name,
                NULL AS floor_number, NULL AS side
         FROM ${config.table} ${kind === 'fabrics' ? 'LEFT JOIN customers c ON fabrics.customer_id = c.customer_id' : ''}
         ORDER BY ${config.name}`;
    const [rows] = await db.query<CatalogRow[]>(query);
    let shelves: ShelfRow[] = [];
    if (kind === 'locations') {
      const [shelfRows] = await db.query<ShelfRow[]>(
        `SELECT s.shelf_id, s.shelf_code, s.shelf_name, w.warehouse_code
         FROM shelves s JOIN warehouses w ON s.warehouse_id = w.warehouse_id
         WHERE s.is_active = TRUE
         ORDER BY w.warehouse_code, s.shelf_code`
      );
      shelves = shelfRows;
    }
    return NextResponse.json({ success: true, data: rows, shelves });
  } catch (error) {
    console.error('Không thể tải danh mục:', error);
    return NextResponse.json({ success: false, error: 'Không thể tải danh mục.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = readRecord(await request.json().catch(() => null));
  const kind = readCatalogKind(typeof body?.kind === 'string' ? body.kind : null);
  if (!body || !kind) {
    return NextResponse.json({ success: false, error: 'Dữ liệu danh mục không hợp lệ.' }, { status: 400 });
  }

  const config = catalogConfig[kind];
  const name = nullableText(body.name);
  const code = nullableText(body.code);
  if (!name || (kind !== 'locations' && !code)) {
    return NextResponse.json({ success: false, error: 'Tên danh mục và mã (nếu có) là bắt buộc.' }, { status: 400 });
  }

  const columns = kind === 'locations' ? ['location_code'] : [config.code, config.name];
  const values: (string | number | null)[] = kind === 'locations' ? [name] : [code, name];
  if (kind === 'fabrics') {
    const width = nullableNumber(body.width);
    const grammage = nullableNumber(body.grammage);
    if (Number.isNaN(width) || Number.isNaN(grammage)) {
      return NextResponse.json({ success: false, error: 'Khổ vải và định lượng phải là số không âm.' }, { status: 400 });
    }
    columns.push('brand', 'width', 'grammage');
    values.push(nullableText(body.detail), width, grammage);
    const customerId = body.customer_id === null || body.customer_id === '' ? null : Number(body.customer_id);
    if (customerId !== null && (!Number.isSafeInteger(customerId) || customerId <= 0)) {
      return NextResponse.json({ success: false, error: 'Khách hàng của tên vải không hợp lệ.' }, { status: 400 });
    }
    columns.push('customer_id');
    values.push(customerId);
  } else if (kind === 'types') {
    columns.push('description');
    values.push(nullableText(body.detail));
  } else if (kind === 'customers') {
    columns.push('phone', 'address');
    values.push(nullableText(body.detail), nullableText(body.address));
  } else if (kind === 'locations') {
    const shelfId = Number(body.shelf_id);
    if (!Number.isSafeInteger(shelfId) || shelfId <= 0) {
      return NextResponse.json({ success: false, error: 'Vui lòng chọn kệ hợp lệ.' }, { status: 400 });
    }
    columns.push('shelf_id', 'floor_number', 'side');
    values.push(shelfId, nullableText(body.floor_number), nullableText(body.side));
  }

  try {
    const placeholders = columns.map(() => '?').join(', ');
    const [result] = await db.query(
      `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return NextResponse.json({
      success: true,
      message: 'Đã thêm danh mục.',
      data: { id: 'insertId' in result ? result.insertId : null },
    });
  } catch (error) {
    console.error('Không thể thêm danh mục:', error);
    return NextResponse.json({ success: false, error: 'Không thể thêm danh mục. Hãy kiểm tra mã trùng hoặc dữ liệu nhập.' }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const body = readRecord(await request.json().catch(() => null));
  const kind = readCatalogKind(typeof body?.kind === 'string' ? body.kind : null);
  const id = Number(body?.id);
  if (!body || !kind || !Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ success: false, error: 'Danh mục hoặc mã bản ghi không hợp lệ.' }, { status: 400 });
  }

  const config = catalogConfig[kind];
  if (typeof body.is_active === 'boolean') {
    try {
      if (!body.is_active) {
        const dependencyQuery: Partial<Record<CatalogKind, string>> = {
          fabrics: 'SELECT roll_id FROM fabric_rolls WHERE fabric_id = ? AND is_archived = 0 LIMIT 1',
          colors: 'SELECT roll_id FROM fabric_rolls WHERE color_id = ? AND is_archived = 0 LIMIT 1',
          types: 'SELECT roll_id FROM fabric_rolls WHERE type_id = ? AND is_archived = 0 LIMIT 1',
          units: 'SELECT roll_id FROM fabric_rolls WHERE unit_id = ? AND is_archived = 0 LIMIT 1',
          locations: 'SELECT roll_id FROM fabric_rolls WHERE location_id = ? AND is_archived = 0 LIMIT 1',
          customers: 'SELECT fabric_id FROM fabrics WHERE customer_id = ? AND is_active = TRUE LIMIT 1',
        };
        const query = dependencyQuery[kind];
        if (query) {
          const [references] = await db.query<RowDataPacket[]>(query, [id]);
          if (references.length > 0) {
            return NextResponse.json(
              { success: false, error: 'Danh mục đang được dữ liệu còn sử dụng tham chiếu. Hãy chuyển dữ liệu đó trước khi ngừng danh mục.' },
              { status: 409 }
            );
          }
        }
      }
      await db.query(`UPDATE ${config.table} SET is_active = ? WHERE ${config.id} = ?`, [body.is_active ? 1 : 0, id]);
      return NextResponse.json({ success: true, message: body.is_active ? 'Đã khôi phục danh mục.' : 'Đã ngừng sử dụng danh mục.' });
    } catch (error) {
      console.error('Không thể đổi trạng thái danh mục:', error);
      return NextResponse.json({ success: false, error: 'Không thể cập nhật trạng thái danh mục.' }, { status: 500 });
    }
  }

  const name = nullableText(body.name);
  const code = nullableText(body.code);
  if (!name || (kind !== 'locations' && !code)) {
    return NextResponse.json({ success: false, error: 'Tên danh mục và mã (nếu có) là bắt buộc.' }, { status: 400 });
  }

  const assignments = kind === 'locations'
    ? ['location_code = ?']
    : [`${config.code} = ?`, `${config.name} = ?`];
  const values: (string | number | null)[] = kind === 'locations' ? [name] : [code, name];
  if (kind === 'fabrics') {
    const width = nullableNumber(body.width);
    const grammage = nullableNumber(body.grammage);
    if (Number.isNaN(width) || Number.isNaN(grammage)) {
      return NextResponse.json({ success: false, error: 'Khổ vải và định lượng phải là số không âm.' }, { status: 400 });
    }
    assignments.push('brand = ?', 'width = ?', 'grammage = ?');
    values.push(nullableText(body.detail), width, grammage);
    const customerId = body.customer_id === null || body.customer_id === '' ? null : Number(body.customer_id);
    if (customerId !== null && (!Number.isSafeInteger(customerId) || customerId <= 0)) {
      return NextResponse.json({ success: false, error: 'Khách hàng của tên vải không hợp lệ.' }, { status: 400 });
    }
    assignments.push('customer_id = ?');
    values.push(customerId);
  } else if (kind === 'types') {
    assignments.push('description = ?');
    values.push(nullableText(body.detail));
  } else if (kind === 'customers') {
    assignments.push('phone = ?', 'address = ?');
    values.push(nullableText(body.detail), nullableText(body.address));
  } else if (kind === 'locations') {
    const shelfId = Number(body.shelf_id);
    if (!Number.isSafeInteger(shelfId) || shelfId <= 0) {
      return NextResponse.json({ success: false, error: 'Vui lòng chọn kệ hợp lệ.' }, { status: 400 });
    }
    assignments.push('shelf_id = ?', 'floor_number = ?', 'side = ?');
    values.push(shelfId, nullableText(body.floor_number), nullableText(body.side));
  }

  try {
    values.push(id);
    await db.query(`UPDATE ${config.table} SET ${assignments.join(', ')} WHERE ${config.id} = ?`, values);
    return NextResponse.json({ success: true, message: 'Đã cập nhật danh mục.' });
  } catch (error) {
    console.error('Không thể cập nhật danh mục:', error);
    return NextResponse.json({ success: false, error: 'Không thể cập nhật danh mục. Hãy kiểm tra mã trùng hoặc dữ liệu nhập.' }, { status: 409 });
  }
}
