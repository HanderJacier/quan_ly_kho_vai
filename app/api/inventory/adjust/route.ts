import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import { type PoolConnection } from 'mysql2/promise';
import { db } from '@/lib/db';

interface LockedRollRow extends RowDataPacket {
  roll_id: number;
  roll_code: string;
  quantity_remaining: string;
  location_id: number | null;
  status: 'ACTIVE' | 'EXPIRED' | 'OUT_OF_STOCK';
  is_archived: number;
}

export async function POST(request: Request) {
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
  const targetQuantity = Number(body.quantity_remaining);
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!Number.isSafeInteger(rollId) || rollId <= 0) {
    return NextResponse.json({ success: false, error: 'Mã cuộn không hợp lệ.' }, { status: 400 });
  }
  if (
    !Number.isFinite(targetQuantity) ||
    targetQuantity < 0 ||
    Math.abs(targetQuantity * 1000 - Math.round(targetQuantity * 1000)) > 1e-7
  ) {
    return NextResponse.json({ success: false, error: 'Tồn kho điều chỉnh phải từ 0 trở lên, tối đa 3 chữ số thập phân.' }, { status: 400 });
  }
  if (!note || note.length > 1000) {
    return NextResponse.json({ success: false, error: 'Vui lòng nhập lý do điều chỉnh (tối đa 1000 ký tự).' }, { status: 400 });
  }

  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [rows] = await connection.query<LockedRollRow[]>(
      `SELECT roll_id, roll_code, quantity_remaining, location_id, status, is_archived
       FROM fabric_rolls
       WHERE roll_id = ?
       FOR UPDATE`,
      [rollId]
    );
    const roll = rows[0];
    if (!roll) {
      return await rollbackAndRespond(connection, { success: false, error: 'Không tìm thấy cuộn vải.' }, 404);
    }
    if (roll.is_archived) {
      return await rollbackAndRespond(connection, { success: false, error: 'Không thể điều chỉnh cuộn đã lưu trữ.' }, 409);
    }

    const currentQuantity = Number(roll.quantity_remaining);
    const difference = Number((targetQuantity - currentQuantity).toFixed(3));
    if (difference === 0) {
      return await rollbackAndRespond(connection, { success: false, error: 'Tồn kho mới phải khác tồn kho hiện tại.' }, 400);
    }

    const nextStatus = targetQuantity === 0
      ? 'OUT_OF_STOCK'
      : roll.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE';
    await connection.query(
      'UPDATE fabric_rolls SET quantity_remaining = ?, status = ? WHERE roll_id = ?',
      [targetQuantity, nextStatus, rollId]
    );
    const adjustmentNote = `Điều chỉnh tồn ${currentQuantity} -> ${targetQuantity}: ${note}`;
    await connection.query<ResultSetHeader>(
      `INSERT INTO inventory_transactions
        (roll_id, transaction_type, quantity, from_location_id, to_location_id, note, transaction_date)
       VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?, NOW())`,
      [rollId, Math.abs(difference), roll.location_id, roll.location_id, adjustmentNote]
    );

    await connection.commit();
    transactionStarted = false;
    return NextResponse.json({
      success: true,
      message: `Đã điều chỉnh tồn cuộn ${roll.roll_code} từ ${currentQuantity}m thành ${targetQuantity}m và ghi nhật ký.`,
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Không thể hoàn tác điều chỉnh tồn kho:', rollbackError);
      }
    }
    console.error('Không thể điều chỉnh tồn kho:', error);
    return NextResponse.json({ success: false, error: 'Không thể điều chỉnh tồn kho. Vui lòng thử lại.' }, { status: 500 });
  } finally {
    connection?.release();
  }
}

async function rollbackAndRespond(
  connection: PoolConnection,
  payload: { success: false; error: string },
  status: number
) {
  await connection.rollback();
  return NextResponse.json(payload, { status });
}
