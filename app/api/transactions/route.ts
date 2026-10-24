import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roll_id = searchParams.get('roll_id');
    const type = searchParams.get('type');

    let query = `
      SELECT 
        t.trans_id,
        t.transaction_type,
        t.quantity,
        t.transaction_date,
        t.note,
        r.roll_code,
        f.fabric_name,
        fl.location_code AS from_location,
        tl.location_code AS to_location
      FROM inventory_transactions t
      JOIN fabric_rolls r ON t.roll_id = r.roll_id
      JOIN fabrics f ON r.fabric_id = f.fabric_id
      LEFT JOIN locations fl ON t.from_location_id = fl.location_id
      LEFT JOIN locations tl ON t.to_location_id = tl.location_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (roll_id) {
      query += ` AND t.roll_id = ?`;
      params.push(roll_id);
    }
    if (type) {
      query += ` AND t.transaction_type = ?`;
      params.push(type);
    }

    query += ` ORDER BY t.transaction_date DESC LIMIT 100`;

    const [rows] = await db.query(query, params);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const connection = await db.getConnection();

  try {
    const body = await request.json();
    const { transaction_type = 'TRANSFER', roll_id, quantity, to_location_id, note } = body;

    if (!roll_id) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc: roll_id' },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    // 1. Khóa và lấy thông tin cuộn vải hiện tại (FOR UPDATE)
    const [rolls]: any = await connection.query(
      `SELECT roll_id, roll_code, location_id, quantity_remaining 
       FROM fabric_rolls WHERE roll_id = ? FOR UPDATE`,
      [roll_id]
    );

    if (rolls.length === 0) {
      throw new Error(`Không tìm thấy cuộn vải ID: ${roll_id}`);
    }

    const currentRoll = rolls[0];
    const currentQty = parseFloat(currentRoll.quantity_remaining);
    const fromLocationId = currentRoll.location_id;

    // 2. Xử lý logic theo loại Transaction
    if (transaction_type === 'EXPORT') {
      const exportQty = parseFloat(quantity);

      if (!exportQty || exportQty <= 0) {
        throw new Error('Số lượng xuất kho (quantity) phải lớn hơn 0');
      }

      if (exportQty > currentQty) {
        throw new Error(`Số lượng xuất (${exportQty}m) vượt quá tồn kho hiện tại (${currentQty}m)`);
      }

      const newQty = currentQty - exportQty;
      const newStatus = newQty === 0 ? 'DEPLETED' : 'ACTIVE';

      // Trừ tồn kho & cập nhật trạng thái
      await connection.query(
        `UPDATE fabric_rolls 
         SET quantity_remaining = ?, status = ? 
         WHERE roll_id = ?`,
        [newQty, newStatus, roll_id]
      );

      // Ghi log giao dịch EXPORT
      await connection.query(
        `INSERT INTO inventory_transactions 
          (roll_id, transaction_type, quantity, from_location_id, to_location_id, note, transaction_date)
         VALUES (?, 'EXPORT', ?, ?, NULL, ?, NOW())`,
        [roll_id, exportQty, fromLocationId || null, note || `Xuất kho cuộn ${currentRoll.roll_code}`]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: `Xuất kho thành công ${exportQty}m từ cuộn ${currentRoll.roll_code}. Tồn còn lại: ${newQty}m.`,
      });
    } else if (transaction_type === 'TRANSFER') {
      if (!to_location_id) {
        throw new Error('Giao dịch TRANSFER yêu cầu to_location_id');
      }

      if (fromLocationId === Number(to_location_id)) {
        throw new Error('Vị trí kệ mới phải khác vị trí kệ hiện tại');
      }

      // Đổi vị trí kệ
      await connection.query(
        `UPDATE fabric_rolls SET location_id = ? WHERE roll_id = ?`,
        [to_location_id, roll_id]
      );

      // Ghi log giao dịch TRANSFER
      await connection.query(
        `INSERT INTO inventory_transactions 
          (roll_id, transaction_type, quantity, from_location_id, to_location_id, note, transaction_date)
         VALUES (?, 'TRANSFER', ?, ?, ?, ?, NOW())`,
        [
          roll_id,
          currentQty,
          fromLocationId || null,
          to_location_id,
          note || `Chuyển kệ cuộn ${currentRoll.roll_code}`,
        ]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: `Đã đổi vị trí kệ cho cuộn ${currentRoll.roll_code}`,
      });
    } else {
      throw new Error(`Loại giao dịch '${transaction_type}' không được hỗ trợ`);
    }
  } catch (error: any) {
    await connection.rollback();
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    connection.release();
  }
}