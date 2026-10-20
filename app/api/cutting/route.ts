import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  const connection = await db.getConnection();

  try {
    const body = await request.json();
    const { 
      parent_roll_id, 
      cut_quantity, 
      new_roll_code, 
      new_barcode, 
      note 
    } = body;

    // Validate dữ liệu
    if (!parent_roll_id || !cut_quantity || cut_quantity <= 0 || !new_roll_code) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc: parent_roll_id, cut_quantity, new_roll_code' },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    // 1. Lấy thông tin cuộn vải mẹ và khóa dòng (FOR UPDATE)
    const [rolls]: any = await connection.query(
      `SELECT * FROM fabric_rolls WHERE roll_id = ? FOR UPDATE`,
      [parent_roll_id]
    );

    if (rolls.length === 0) {
      throw new Error(`Không tìm thấy cuộn vải có ID: ${parent_roll_id}`);
    }

    const parentRoll = rolls[0];
    const parentQty = parseFloat(parentRoll.quantity_remaining);

    if (parentQty < cut_quantity) {
      throw new Error(`Số lượng cuộn mẹ chỉ còn ${parentQty}, không đủ để cắt ${cut_quantity}`);
    }

    // 2. Tạo cuộn vải con mới từ thông tin cuộn mẹ
    const [newRollResult]: any = await connection.query(
      `INSERT INTO fabric_rolls (
        roll_code, barcode, fabric_id, color_id, type_id, 
        location_id, unit_id, quantity_initial, quantity_remaining, 
        inbound_date, status, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'ACTIVE', ?)`,
      [
        new_roll_code,
        new_barcode || `BC-${Date.now()}`,
        parentRoll.fabric_id,
        parentRoll.color_id,
        parentRoll.type_id,
        parentRoll.location_id,
        parentRoll.unit_id,
        cut_quantity,
        cut_quantity,
        note || `Cắt từ cuộn ${parentRoll.roll_code}`
      ]
    );

    const childRollId = newRollResult.insertId;

    // 3. Cập nhật lại số lượng còn lại của cuộn mẹ
    const newParentQty = parentQty - cut_quantity;
    const parentStatus = newParentQty === 0 ? 'OUT_OF_STOCK' : 'ACTIVE';

    await connection.query(
      `UPDATE fabric_rolls 
       SET quantity_remaining = ?, status = ? 
       WHERE roll_id = ?`,
      [newParentQty, parentStatus, parent_roll_id]
    );

    // 4. Ghi thông tin vào bảng cutting_orders đúng chuẩn Schema SQL
    await connection.query(
      `INSERT INTO cutting_orders (
        roll_id, cut_quantity, remaining_quantity, note, cutting_date
      ) VALUES (?, ?, ?, ?, NOW())`,
      [parent_roll_id, cut_quantity, newParentQty, note || `Cắt tạo cuộn mới ID: ${childRollId}`]
    );

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: 'Cắt vải thành công',
      data: {
        parent_roll_id,
        parent_remaining_qty: newParentQty,
        child_roll_id: childRollId,
        child_roll_code: new_roll_code,
        cut_quantity
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