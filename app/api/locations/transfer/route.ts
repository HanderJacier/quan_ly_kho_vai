import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    const [rolls]: any = await connection.query(
      `SELECT * FROM fabric_rolls WHERE roll_id = ? FOR UPDATE`,
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
    const [locations]: any = await connection.query(
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

  } catch (error: any) {
    await connection.rollback();
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}