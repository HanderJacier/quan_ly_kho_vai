import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import { type PoolConnection } from 'mysql2/promise';
import { db, hasColumn } from '@/lib/db';

interface CountRow extends RowDataPacket {
  total: number;
}

interface LockedRollRow extends RowDataPacket {
  roll_id: number;
  quantity_initial: string;
  quantity_remaining: string;
  location_id: number | null;
}

export async function GET(request: Request) {
  try {
    const [hasLotCode, hasSupplierName] = await Promise.all([
      hasColumn('fabric_rolls', 'lot_code'),
      hasColumn('fabric_rolls', 'supplier_name'),
    ]);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const stockType = searchParams.get('stockType') || '';
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const page = Number(searchParams.get('page') || 1);
    const pageSize = Number(searchParams.get('pageSize') || 50);

    if (
      !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100
    ) {
      return NextResponse.json(
        { success: false, error: 'Tham số phân trang không hợp lệ (page >= 1, pageSize từ 1 đến 100).' },
        { status: 400 }
      );
    }

    const fromSql = `
      FROM fabric_rolls r
      LEFT JOIN fabrics f ON r.fabric_id = f.fabric_id
      LEFT JOIN fabric_colors c ON r.color_id = c.color_id
      LEFT JOIN fabric_types t ON r.type_id = t.type_id
      LEFT JOIN locations l ON r.location_id = l.location_id
      LEFT JOIN shelves s ON l.shelf_id = s.shelf_id
      LEFT JOIN warehouses w ON s.warehouse_id = w.warehouse_id
      LEFT JOIN units u ON r.unit_id = u.unit_id
    `;
    const conditions: string[] = includeArchived ? [] : ['r.is_archived = 0'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(
        '(r.roll_code LIKE ? OR r.barcode LIKE ? OR f.fabric_name LIKE ? OR c.color_name LIKE ? OR l.location_code LIKE ?)'
      );
      const wildcard = `%${search}%`;
      params.push(wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    if (status) {
      if (status === 'EXPIRED') {
        conditions.push('r.quantity_remaining > 0 AND r.expiry_date <= CURRENT_DATE()');
      } else if (status === 'OUT_OF_STOCK') {
        conditions.push('r.quantity_remaining = 0');
      } else if (status === 'ACTIVE') {
        conditions.push('r.quantity_remaining > 0 AND (r.expiry_date IS NULL OR r.expiry_date > CURRENT_DATE())');
      }
    }

    if (stockType) {
      if (stockType === 'SAVING') {
        conditions.push('r.stock_type = ?');
        params.push(stockType);
      } else if (stockType === 'REGULAR') {
        conditions.push('(r.stock_type IS NULL OR r.stock_type <> ?)');
        params.push('SAVING');
      }
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countFromSql = search ? fromSql : 'FROM fabric_rolls r';

    const query = `
      SELECT
        r.roll_id,
        r.roll_code,
        r.barcode,
        ${hasLotCode ? 'r.lot_code' : 'NULL'} AS lot_code,
        ${hasSupplierName ? 'r.supplier_name' : 'NULL'} AS supplier_name,
        r.fabric_id,
        r.color_id,
        r.type_id,
        r.location_id,
        r.unit_id,
        r.quantity_initial,
        r.quantity_remaining,
        r.inbound_date,
        r.expiry_date,
        r.is_archived,
        CASE
          WHEN r.quantity_remaining <= 0 THEN 'OUT_OF_STOCK'
          WHEN r.expiry_date IS NOT NULL AND r.expiry_date <= CURRENT_DATE() THEN 'EXPIRED'
          ELSE 'ACTIVE'
        END AS status,
        r.stock_type,
        r.note,
        f.fabric_name,
        c.color_name,
        t.type_name,
        l.location_code,
        CONCAT_WS(' / ', w.warehouse_code, s.shelf_code, l.location_code, l.floor_number, l.side) AS location_name,
        u.unit_name
      ${fromSql}
      ${whereSql}
      ORDER BY r.inbound_date DESC, r.roll_id DESC
      LIMIT ? OFFSET ?
    `;

    const [rowsResult, countResult] = await Promise.all([
      db.query(query, [...params, pageSize, (page - 1) * pageSize]),
      db.query<CountRow[]>(`SELECT COUNT(*) AS total ${countFromSql} ${whereSql}`, params),
    ]);
    const [rows] = rowsResult;
    const [countRows] = countResult;
    const total = Number(countRows[0]?.total ?? 0);

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Không thể tải tồn kho:', error);
    return NextResponse.json({ success: false, error: 'Không thể tải tồn kho.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ.' }, { status: 400 });
    }
    body = value as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không phải JSON hợp lệ.' }, { status: 400 });
  }

  const rollId = Number(body.roll_id);
  const rollCode = typeof body.roll_code === 'string' ? body.roll_code.trim() : '';
  const lotCode = typeof body.lot_code === 'string' ? body.lot_code.trim() : '';
  const supplierName = typeof body.supplier_name === 'string' ? body.supplier_name.trim() : '';
  const barcode = typeof body.barcode === 'string' ? body.barcode.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const fabricId = Number(body.fabric_id);
  const quantityInitial = Number(body.quantity_initial);
  const quantityRemaining = Number(body.quantity_remaining);
  const stockType = body.stock_type;

  if (!Number.isSafeInteger(rollId) || rollId <= 0) {
    return NextResponse.json({ success: false, error: 'Mã cuộn không hợp lệ.' }, { status: 400 });
  }

  if (body.is_archived === false) {
    try {
      const [result] = await db.query(
        'UPDATE fabric_rolls SET is_archived = 0 WHERE roll_id = ? AND is_archived = 1',
        [rollId]
      );
      if ('affectedRows' in result && result.affectedRows === 0) {
        return NextResponse.json({ success: false, error: 'Không tìm thấy cuộn đã lưu trữ.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Đã khôi phục cuộn vải.' });
    } catch (error) {
      console.error('Không thể khôi phục cuộn vải:', error);
      return NextResponse.json({ success: false, error: 'Không thể khôi phục cuộn vải.' }, { status: 500 });
    }
  }

  if (!rollCode || !Number.isSafeInteger(fabricId) || fabricId <= 0) {
    return NextResponse.json(
      { success: false, error: 'Mã cuộn, tên vải và mã cuộn hợp lệ là bắt buộc.' },
      { status: 400 }
    );
  }
  if (
    !Number.isFinite(quantityInitial) ||
    quantityInitial <= 0 ||
    !Number.isFinite(quantityRemaining) ||
    quantityRemaining < 0 ||
    [quantityInitial, quantityRemaining].some((quantity) => Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-7)
  ) {
    return NextResponse.json({ success: false, error: 'Số lượng phải hợp lệ, số ban đầu lớn hơn 0 và tối đa 3 chữ số thập phân.' }, { status: 400 });
  }
  if (stockType !== 'REGULAR' && stockType !== 'REMNANT' && stockType !== 'SAVING') {
    return NextResponse.json({ success: false, error: 'Phân loại tồn kho không hợp lệ.' }, { status: 400 });
  }
  if (rollCode.length > 100 || lotCode.length > 100 || supplierName.length > 160 || barcode.length > 150) {
    return NextResponse.json({ success: false, error: 'Mã cuộn/lô, nhà cung cấp hoặc barcode vượt quá độ dài cho phép.' }, { status: 400 });
  }

  const optionalId = (key: string) => {
    const value = body[key];
    if (value === null || value === '') return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : Number.NaN;
  };
  const colorId = optionalId('color_id');
  const typeId = optionalId('type_id');
  const locationId = optionalId('location_id');
  const unitId = optionalId('unit_id');
  if ([colorId, typeId, locationId, unitId].some((id) => Number.isNaN(id))) {
    return NextResponse.json({ success: false, error: 'Danh mục vải, màu, loại, vị trí hoặc đơn vị không hợp lệ.' }, { status: 400 });
  }

  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [rolls] = await connection.query<LockedRollRow[]>(
      `SELECT roll_id, quantity_initial, quantity_remaining, location_id
       FROM fabric_rolls WHERE roll_id = ? AND is_archived = 0 FOR UPDATE`,
      [rollId]
    );
    const currentRoll = rolls[0];
    if (!currentRoll) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json({ success: false, error: 'Không tìm thấy cuộn hoặc cuộn đã được lưu trữ.' }, { status: 404 });
    }

    const [existing] = await connection.query(
      'SELECT roll_id FROM fabric_rolls WHERE roll_id <> ? AND (roll_code = ? OR (? <> "" AND barcode = ?)) LIMIT 1',
      [rollId, rollCode, barcode, barcode]
    );
    if (Array.isArray(existing) && existing.length > 0) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json({ success: false, error: 'Mã cuộn hoặc barcode đã được sử dụng.' }, { status: 409 });
    }

    await connection.query(
      `UPDATE fabric_rolls
       SET roll_code = ?, lot_code = ?, supplier_name = ?, barcode = ?, fabric_id = ?, color_id = ?, type_id = ?,
           location_id = ?, unit_id = ?, quantity_initial = ?, quantity_remaining = ?, stock_type = ?,
           status = IF(? = 0, 'OUT_OF_STOCK', IF(expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE(), 'EXPIRED', 'ACTIVE')),
           note = ?
       WHERE roll_id = ? AND is_archived = 0`,
      [
        rollCode,
        lotCode || null,
        supplierName || null,
        barcode || null,
        fabricId,
        colorId,
        typeId,
        locationId,
        unitId,
        quantityInitial,
        quantityRemaining,
        stockType,
        quantityRemaining,
        note || null,
        rollId,
      ]
    );
    await connection.query(
      `UPDATE inventory_transactions
       SET quantity = ?, note = COALESCE(?, note)
       WHERE roll_id = ? AND transaction_type = 'INBOUND'
       ORDER BY trans_id ASC LIMIT 1`,
      [quantityInitial, note || null, rollId]
    );
    const quantityDifference = Number((quantityRemaining - Number(currentRoll.quantity_remaining)).toFixed(3));
    if (quantityDifference !== 0) {
      await connection.query<ResultSetHeader>(
        `INSERT INTO inventory_transactions
          (roll_id, transaction_type, quantity, from_location_id, to_location_id, note, transaction_date)
         VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?, NOW())`,
        [
          rollId,
          Math.abs(quantityDifference),
          currentRoll.location_id,
          currentRoll.location_id,
          `Sửa tồn cuộn ${rollCode}: ${currentRoll.quantity_remaining} -> ${quantityRemaining}m`,
        ]
      );
    }
    if (locationId !== currentRoll.location_id) {
      await connection.query<ResultSetHeader>(
        `INSERT INTO inventory_transactions
          (roll_id, transaction_type, quantity, from_location_id, to_location_id, note, transaction_date)
         VALUES (?, 'TRANSFER', ?, ?, ?, ?, NOW())`,
        [
          rollId,
          quantityRemaining,
          currentRoll.location_id,
          locationId,
          `Điều chỉnh vị trí cuộn ${rollCode}`,
        ]
      );
    }
    await connection.commit();
    transactionStarted = false;
    return NextResponse.json({ success: true, message: 'Đã cập nhật thông tin cuộn vải.' });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Không thể hoàn tác cập nhật cuộn vải:', rollbackError);
      }
    }
    console.error('Không thể cập nhật thông tin cuộn vải:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ success: false, error: 'Mã cuộn hoặc barcode đã được sử dụng.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Không thể cập nhật cuộn vải. Hãy kiểm tra lại dữ liệu danh mục.' }, { status: 500 });
  } finally {
    connection?.release();
  }
}

export async function DELETE(request: Request) {
  let rollId: number;
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ.' }, { status: 400 });
    }
    rollId = Number((value as Record<string, unknown>).roll_id);
  } catch {
    return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không phải JSON hợp lệ.' }, { status: 400 });
  }
  if (!Number.isSafeInteger(rollId) || rollId <= 0) {
    return NextResponse.json({ success: false, error: 'Mã cuộn không hợp lệ.' }, { status: 400 });
  }

  try {
    const [result] = await db.query(
      `UPDATE fabric_rolls
       SET is_archived = 1
       WHERE roll_id = ? AND is_archived = 0 AND quantity_remaining = 0`,
      [rollId]
    );
    if ('affectedRows' in result && result.affectedRows === 0) {
      const [rows] = await db.query(
        'SELECT roll_id, is_archived, quantity_remaining FROM fabric_rolls WHERE roll_id = ?',
        [rollId]
      );
      const row = Array.isArray(rows) ? rows[0] as { is_archived: number; quantity_remaining: string } | undefined : undefined;
      if (!row) return NextResponse.json({ success: false, error: 'Không tìm thấy cuộn vải.' }, { status: 404 });
      if (row.is_archived) return NextResponse.json({ success: false, error: 'Cuộn vải đã được lưu trữ.' }, { status: 409 });
      return NextResponse.json(
        { success: false, error: 'Chỉ lưu trữ được cuộn đã hết tồn; hãy xuất hết hoặc điều chỉnh tồn kho trước.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, message: 'Đã lưu trữ cuộn vải. Lịch sử giao dịch được giữ nguyên.' });
  } catch (error) {
    console.error('Không thể lưu trữ cuộn vải:', error);
    return NextResponse.json({ success: false, error: 'Không thể lưu trữ cuộn vải.' }, { status: 500 });
  }
}