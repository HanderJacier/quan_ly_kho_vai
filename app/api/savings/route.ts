import { NextResponse } from 'next/server';
import { type PoolConnection } from 'mysql2/promise';
import { type RowDataPacket } from 'mysql2';
import { db } from '@/lib/db';

interface SavingsRollRow extends RowDataPacket {
  roll_id: number;
  roll_code: string;
  stock_type: string | null;
  quantity_remaining: string;
  location_id: number | null;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ.' }, { status: 400 });
  }
  const values = body as Record<string, unknown>;
  const rollId = Number(values.roll_id);
  const targetAccount = values.target_account;
  if (!Number.isSafeInteger(rollId) || rollId <= 0 || !['SAVING', 'REGULAR'].includes(String(targetAccount))) {
    return NextResponse.json({ success: false, error: 'Cuộn hoặc tài khoản tồn kho không hợp lệ.' }, { status: 400 });
  }

  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.query<SavingsRollRow[]>(
      `SELECT roll_id, roll_code, stock_type, quantity_remaining, location_id
       FROM fabric_rolls WHERE roll_id = ? AND is_archived = 0 FOR UPDATE`,
      [rollId]
    );
    const roll = rows[0];
    if (!roll) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json({ success: false, error: 'Không tìm thấy cuộn đang hoạt động.' }, { status: 404 });
    }
    const currentAccount = roll.stock_type === 'SAVING' ? 'SAVING' : 'REGULAR';
    if (currentAccount === targetAccount) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json({ success: false, error: 'Cuộn đã ở đúng tài khoản được chọn.' }, { status: 409 });
    }
    await connection.query('UPDATE fabric_rolls SET stock_type = ? WHERE roll_id = ?', [targetAccount, rollId]);
    await connection.query(
      `INSERT INTO inventory_transactions
        (roll_id, transaction_type, quantity, from_location_id, to_location_id, note, transaction_date)
       VALUES (?, 'ADJUSTMENT', 0, ?, ?, ?, NOW())`,
      [
        rollId,
        roll.location_id,
        roll.location_id,
        `Chuyển tài khoản tồn ${currentAccount === 'SAVING' ? 'tiết kiệm' : 'thường'} sang ${targetAccount === 'SAVING' ? 'tiết kiệm' : 'thường'} (${roll.quantity_remaining})`,
      ]
    );
    await connection.commit();
    transactionStarted = false;
    return NextResponse.json({ success: true, message: 'Đã chuyển tài khoản tồn kho và ghi lịch sử.' });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Không thể hoàn tác chuyển tài khoản tồn kho:', rollbackError);
      }
    }
    console.error('Không thể chuyển tài khoản tồn kho:', error);
    return NextResponse.json({ success: false, error: 'Không thể chuyển tài khoản tồn kho.' }, { status: 500 });
  } finally {
    connection?.release();
  }
}
