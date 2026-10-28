import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import { type PoolConnection } from 'mysql2/promise';
import { db, hasColumn, hasTable } from '@/lib/db';

interface CountRow extends RowDataPacket {
  total: number;
}

interface LockedTransactionRow extends RowDataPacket {
  trans_id: number;
  roll_id: number;
  transaction_type: string;
  quantity: string | number;
  reference_type: string | null;
  reference_id: number | null;
}

interface LockedRollRow extends RowDataPacket {
  roll_id: number;
  quantity_remaining: string | number;
  quantity_initial: string | number;
  status: 'ACTIVE' | 'EXPIRED' | 'OUT_OF_STOCK';
  is_archived: number;
}

class ExportDetailMismatchError extends Error {}

export async function GET(request: Request) {
  try {
    const [hasExportOrders, hasCustomers, hasLotCode] = await Promise.all([
      hasTable('export_orders'),
      hasTable('customers'),
      hasColumn('fabric_rolls', 'lot_code'),
    ]);
    const { searchParams } = new URL(request.url);
    const roll_id = searchParams.get('roll_id');
    const type = searchParams.get('type');
    const search = searchParams.get('search') || '';
    const page = Number(searchParams.get('page') || 1);
    const pageSize = Number(searchParams.get('pageSize') || 50);

    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { success: false, error: 'Tham số phân trang không hợp lệ (page >= 1, pageSize từ 1 đến 100).' },
        { status: 400 }
      );
    }

    const exportOrderJoin = hasExportOrders
      ? `LEFT JOIN export_orders export_order
        ON t.reference_type = 'EXPORT_ORDER' AND t.reference_id = export_order.export_id
       ${hasCustomers ? 'LEFT JOIN customers customer ON export_order.customer_id = customer.customer_id' : ''}`
      : '';
    const fromSql = `
      FROM inventory_transactions t
      JOIN fabric_rolls r ON t.roll_id = r.roll_id
      JOIN fabrics f ON r.fabric_id = f.fabric_id
      ${exportOrderJoin}
      LEFT JOIN locations fl ON t.from_location_id = fl.location_id
      LEFT JOIN locations tl ON t.to_location_id = tl.location_id
    `;
    const conditions = ['1=1'];
    const params: (string | number)[] = [];

    if (roll_id) {
      conditions.push('t.roll_id = ?');
      params.push(roll_id);
    }
    if (type) {
      conditions.push('t.transaction_type = ?');
      params.push(type);
    }
    if (search) {
      conditions.push('(r.roll_code LIKE ? OR f.fabric_name LIKE ? OR t.note LIKE ?)');
      const wildcard = `%${search}%`;
      params.push(wildcard, wildcard, wildcard);
    }

    const whereSql = `WHERE ${conditions.join(' AND ')}`;
    const countFromSql = search
      ? fromSql
      : `FROM inventory_transactions t`;
    const query = `
      SELECT
        t.trans_id,
        t.transaction_type,
        t.quantity,
        t.transaction_date,
        t.note,
        r.roll_code,
        ${hasLotCode ? 'r.lot_code' : 'NULL'} AS lot_code,
        f.fabric_name,
        ${hasExportOrders ? 'export_order.order_no' : 'NULL'} AS order_code,
        ${hasExportOrders && hasCustomers ? 'customer.customer_name' : 'NULL'} AS customer_name,
        fl.location_code AS from_location,
        tl.location_code AS to_location
      ${fromSql}
      ${whereSql}
      ORDER BY t.transaction_date DESC, t.trans_id DESC
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
  } catch (error: unknown) {
    console.error('Không thể tải lịch sử giao dịch:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Không thể tải lịch sử giao dịch.' },
      { status: 500 }
    );
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

  const transId = Number(body.trans_id);
  const quantity = Number(body.quantity);
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!Number.isSafeInteger(transId) || transId <= 0) {
    return NextResponse.json({ success: false, error: 'Mã giao dịch không hợp lệ.' }, { status: 400 });
  }
  if (
    !Number.isFinite(quantity) || quantity <= 0 ||
    quantity > 999999999.999 ||
    Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-7
  ) {
    return NextResponse.json(
      { success: false, error: 'Số lượng phải từ 0 đến 999999999.999 và có tối đa 3 chữ số thập phân.' },
      { status: 400 }
    );
  }
  if (note.length > 1000) {
    return NextResponse.json({ success: false, error: 'Ghi chú không được vượt quá 1000 ký tự.' }, { status: 400 });
  }
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [transactions] = await connection.query<LockedTransactionRow[]>(
      `SELECT trans_id, roll_id, transaction_type, quantity, reference_type, reference_id
       FROM inventory_transactions
       WHERE trans_id = ?
       FOR UPDATE`,
      [transId]
    );
    const transaction = transactions[0];
    if (!transaction) {
      return await rollbackAndRespond(connection, { success: false, error: 'Không tìm thấy giao dịch.' }, 404);
    }
    if (transaction.transaction_type !== 'INBOUND' && transaction.transaction_type !== 'OUTBOUND') {
      const message = transaction.transaction_type === 'TRANSFER'
        ? 'Giao dịch chuyển kệ cần được chỉnh sửa tại trang Chuyển kệ.'
        : transaction.transaction_type === 'CUTTING'
          ? 'Giao dịch cắt vải cần được chỉnh sửa tại trang Cắt vải.'
          : 'Chỉ có thể chỉnh sửa giao dịch INBOUND hoặc OUTBOUND tại trang lịch sử.';
      return await rollbackAndRespond(connection, { success: false, error: message }, 400);
    }

    const [rolls] = await connection.query<LockedRollRow[]>(
      `SELECT roll_id, quantity_remaining, quantity_initial, status, is_archived
       FROM fabric_rolls
       WHERE roll_id = ?
       FOR UPDATE`,
      [transaction.roll_id]
    );
    const roll = rolls[0];
    if (!roll || roll.is_archived) {
      return await rollbackAndRespond(
        connection,
        { success: false, error: 'Không tìm thấy cuộn vải hoặc cuộn đã được lưu trữ.' },
        404
      );
    }

    const oldQuantity = Number(transaction.quantity);
    const currentQuantity = Number(roll.quantity_remaining);
    const difference = Number((quantity - oldQuantity).toFixed(3));
    const movement = transaction.transaction_type === 'INBOUND' ? difference : -difference;
    const nextQuantity = Number((currentQuantity + movement).toFixed(3));
    if (nextQuantity < 0) {
      return await rollbackAndRespond(
        connection,
        { success: false, error: `Không thể giảm số lượng: tồn kho hiện tại chỉ còn ${currentQuantity}m.` },
        409
      );
    }

    if (transaction.transaction_type === 'INBOUND') {
      const nextInitialQuantity = Number((Number(roll.quantity_initial) + difference).toFixed(3));
      if (nextInitialQuantity < 0) {
        return await rollbackAndRespond(
          connection,
          { success: false, error: 'Số lượng nhập chỉnh sửa vượt quá tổng số lượng ban đầu của cuộn.' },
          409
        );
      }
      await connection.query(
        `UPDATE fabric_rolls
         SET quantity_remaining = ?, quantity_initial = ?, status = ?
         WHERE roll_id = ?`,
        [nextQuantity, nextInitialQuantity, getNextStatus(nextQuantity, roll.status), roll.roll_id]
      );
    } else {
      await connection.query(
        `UPDATE fabric_rolls SET quantity_remaining = ?, status = ? WHERE roll_id = ?`,
        [nextQuantity, getNextStatus(nextQuantity, roll.status), roll.roll_id]
      );
      await updateExportDetailIfAvailable(connection, transaction, oldQuantity, quantity);
    }

    await connection.query<ResultSetHeader>(
      `UPDATE inventory_transactions
       SET quantity = ?, note = ?
       WHERE trans_id = ?`,
      [quantity, note || null, transId]
    );

    await connection.commit();
    transactionStarted = false;
    return NextResponse.json({ success: true, message: 'Đã cập nhật giao dịch và tồn kho.' });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Không thể hoàn tác chỉnh sửa giao dịch:', rollbackError);
      }
    }
    console.error('Không thể chỉnh sửa giao dịch:', error);
    if (error instanceof ExportDetailMismatchError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Không thể chỉnh sửa giao dịch. Vui lòng thử lại.' }, { status: 500 });
  } finally {
    connection?.release();
  }
}

function getNextStatus(quantity: number, currentStatus: LockedRollRow['status']) {
  if (quantity === 0) return 'OUT_OF_STOCK';
  return currentStatus === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE';
}

async function updateExportDetailIfAvailable(
  connection: PoolConnection,
  transaction: LockedTransactionRow,
  oldQuantity: number,
  newQuantity: number
) {
  if (transaction.reference_type !== 'EXPORT_ORDER' || !transaction.reference_id) return;
  const [items] = await connection.query<RowDataPacket[]>(
    `SELECT detail_id
     FROM export_details
     WHERE export_id = ? AND roll_id = ? AND quantity = ?
     ORDER BY detail_id
     LIMIT 1
     FOR UPDATE`,
    [transaction.reference_id, transaction.roll_id, oldQuantity]
  );
  if (!items[0]) {
    throw new ExportDetailMismatchError('Không tìm thấy dòng chi tiết đơn xuất khớp với số lượng giao dịch hiện tại.');
  }

  await connection.query(
    'UPDATE export_details SET quantity = ? WHERE detail_id = ?',
    [newQuantity, items[0].detail_id]
  );
}

async function rollbackAndRespond(
  connection: PoolConnection,
  payload: { success: false; error: string },
  status: number
) {
  await connection.rollback();
  return NextResponse.json(payload, { status });
}