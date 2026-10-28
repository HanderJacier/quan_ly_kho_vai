import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import { db } from '@/lib/db';

interface TransferRollRow extends RowDataPacket {
  roll_id: number;
  location_id: number | null;
}

interface ActiveRollRow extends RowDataPacket {
  roll_id: number;
  location_id: number | null;
  roll_code: string;
  quantity_remaining: number | string;
}

interface InitialTransferRow extends RowDataPacket {
  roll_id: number;
}

interface TransferRow extends RowDataPacket {
  roll_id: number;
  trans_id: number;
  from_location_id: number | null;
  to_location_id: number | null;
}

interface TransferIdRow extends RowDataPacket {
  trans_id: number;
}

interface LocationRow extends RowDataPacket {
  location_id: number;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

export async function POST(request: Request) {
  const connection = await db.getConnection();

  try {
    const body = await request.json();
    const { roll_id, to_location_id, note } = body;

    // Validate dữ liệu đầu vào
    if (!roll_id || !to_location_id) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc: roll_id và to_location_id' },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    // 1. Lấy thông tin cuộn vải hiện tại và khóa dòng (FOR UPDATE)
    const [rolls] = await connection.query<ActiveRollRow[]>(
      `SELECT * FROM fabric_rolls WHERE roll_id = ? AND is_archived = 0 FOR UPDATE`,
      [roll_id]
    );

    if (rolls.length === 0) {
      throw new Error(`Không tìm thấy cuộn vải có ID: ${roll_id}`);
    }

    const roll = rolls[0];
    const from_location_id = roll.location_id;

    if (from_location_id === to_location_id) {
      throw new Error('Vị trí chuyển đến phải khác vị trí hiện tại của cuộn vải');
    }

    // 2. Kiểm tra vị trí mới có tồn tại trong hệ thống không
    const [locations] = await connection.query<LocationRow[]>(
      `SELECT location_id FROM locations WHERE location_id = ?`,
      [to_location_id]
    );

    if (locations.length === 0) {
      throw new Error(`Không tìm thấy vị trí kho đích có ID: ${to_location_id}`);
    }

    // 3. Cập nhật vị trí mới cho cuộn vải
    await connection.query(
      `UPDATE fabric_rolls SET location_id = ? WHERE roll_id = ?`,
      [to_location_id, roll_id]
    );

    // 4. Ghi vết lịch sử chuyển kho vào bảng inventory_transactions
    await connection.query(
      `INSERT INTO inventory_transactions (
        roll_id, transaction_type, quantity, 
        from_location_id, to_location_id, note, transaction_date
      ) VALUES (?, 'TRANSFER', ?, ?, ?, ?, NOW())`,
      [
        roll_id, 
        roll.quantity_remaining, 
        from_location_id, 
        to_location_id, 
        note || `Chuyển vị trí kho`
      ]
    );

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: 'Chuyển vị trí kho thành công',
      data: {
        roll_id,
        roll_code: roll.roll_code,
        from_location_id,
        to_location_id,
        quantity: roll.quantity_remaining
      }
    });

  } catch (error: unknown) {
    await connection.rollback();
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Không thể chuyển vị trí kho.' },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Dữ liệu yêu cầu không hợp lệ.' },
      { status: 400 }
    );
  }

  const trans_id = Number(body.trans_id);
  const to_location_id = Number(body.to_location_id);
  const note = body.note;

  if (
    !isPositiveInteger(trans_id)
    || !isPositiveInteger(to_location_id)
    || typeof note !== 'string'
  ) {
    return NextResponse.json(
      { success: false, error: 'Vui lòng nhập vị trí và ghi chú giao dịch hợp lệ.' },
      { status: 400 }
    );
  }

  const connection = await db.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const [initialRows] = await connection.query<InitialTransferRow[]>(
      `SELECT roll_id FROM inventory_transactions
       WHERE trans_id = ? AND transaction_type = 'TRANSFER'`,
      [trans_id]
    );

    if (initialRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy giao dịch điều chuyển cần cập nhật.' },
        { status: 404 }
      );
    }

    const roll_id = initialRows[0].roll_id;
    const [rollRows] = await connection.query<TransferRollRow[]>(
      `SELECT roll_id, location_id
       FROM fabric_rolls
       WHERE roll_id = ? AND is_archived = 0
       FOR UPDATE`,
      [roll_id]
    );

    if (rollRows.length === 0) {
      throw new Error('Không tìm thấy cuộn vải đang hoạt động của giao dịch này.');
    }

    const [transferRows] = await connection.query<TransferRow[]>(
      `SELECT trans_id, from_location_id, to_location_id
       FROM inventory_transactions
       WHERE trans_id = ? AND roll_id = ? AND transaction_type = 'TRANSFER'
       FOR UPDATE`,
      [trans_id, roll_id]
    );

    if (transferRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, error: 'Giao dịch điều chuyển đã thay đổi hoặc không còn tồn tại.' },
        { status: 404 }
      );
    }

    const transfer = transferRows[0];
    const [laterTransfers] = await connection.query<TransferIdRow[]>(
      `SELECT trans_id FROM inventory_transactions
       WHERE roll_id = ? AND transaction_type = 'TRANSFER' AND trans_id > ?
       LIMIT 1
       FOR UPDATE`,
      [roll_id, trans_id]
    );

    if (
      laterTransfers.length > 0
      || rollRows[0].location_id === null
      || transfer.to_location_id === null
      || Number(rollRows[0].location_id) !== Number(transfer.to_location_id)
    ) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        {
          success: false,
          error: 'Không thể sửa giao dịch này vì cuộn vải đã được điều chuyển tiếp hoặc vị trí hiện tại không còn khớp với vị trí đích đã ghi nhận.',
        },
        { status: 409 }
      );
    }

    const [locations] = await connection.query<LocationRow[]>(
      'SELECT location_id FROM locations WHERE location_id = ?',
      [to_location_id]
    );

    if (locations.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json(
        { success: false, error: `Không tìm thấy vị trí kho đích có ID: ${to_location_id}` },
        { status: 400 }
      );
    }

    await connection.query(
      `UPDATE inventory_transactions
       SET to_location_id = ?, note = ?
       WHERE trans_id = ?`,
      [to_location_id, note, trans_id]
    );

    if (Number(transfer.to_location_id) !== to_location_id) {
      await connection.query(
        'UPDATE fabric_rolls SET location_id = ? WHERE roll_id = ?',
        [to_location_id, roll_id]
      );
    }

    await connection.commit();
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      message: 'Đã cập nhật giao dịch điều chuyển.',
    });
  } catch (error: unknown) {
    if (transactionStarted) await connection.rollback();
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể cập nhật giao dịch điều chuyển.',
      },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}