import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  const connection = await db.getConnection();

  try {
    const body = await request.json();
    const { items, note, customer_id } = body;

    const customerId = Number(customer_id);
    if (!Array.isArray(items) || items.length === 0 || !Number.isSafeInteger(customerId) || customerId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng chọn khách hàng và danh sách cuộn xuất kho hợp lệ.' },
        { status: 400 }
      );
    }

    await connection.beginTransaction();
    const [customers]: any = await connection.query(
      'SELECT customer_id FROM customers WHERE customer_id = ? AND is_active = TRUE FOR UPDATE',
      [customerId]
    );
    if (customers.length === 0) throw new Error('Không tìm thấy khách hàng đang hoạt động.');
    const orderCode = `PX-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const [orderResult]: any = await connection.query(
      `INSERT INTO export_orders (order_no, export_type, customer_id, status, note)
       VALUES (?, 'SALE', ?, 'COMPLETED', ?)`,
      [orderCode, customerId, typeof note === 'string' ? note.trim() || null : null]
    );

    for (let i = 0; i < items.length; i++) {
      const { roll_id, export_quantity } = items[i];
      const qty = parseFloat(export_quantity);

      if (!Number.isSafeInteger(Number(roll_id)) || Number(roll_id) <= 0 || !Number.isFinite(qty) || qty <= 0) {
        throw new Error(`Dòng thứ ${i + 1}: Thông tin cuộn vải hoặc số lượng xuất không hợp lệ.`);
      }

      // 1. Khóa và lấy thông tin cuộn vải (FOR UPDATE)
      const [rolls]: any = await connection.query(
        `SELECT roll_id, roll_code, location_id, quantity_remaining, stock_type
         FROM fabric_rolls WHERE roll_id = ? AND is_archived = 0 FOR UPDATE`,
        [roll_id]
      );

      if (rolls.length === 0) {
        throw new Error(`Không tìm thấy cuộn vải ID: ${roll_id}`);
      }

      const currentRoll = rolls[0];
      const currentQty = parseFloat(currentRoll.quantity_remaining);

      if (qty > currentQty) {
        throw new Error(`Cuộn ${currentRoll.roll_code}: Số lượng xuất (${qty}) vượt quá tồn kho hiện tại (${currentQty}).`);
      }

      const newQty = currentQty - qty;
      const newStatus = newQty === 0 ? 'OUT_OF_STOCK' : 'ACTIVE';

      // 2. Trừ tồn kho & cập nhật trạng thái
      await connection.query(
        `UPDATE fabric_rolls SET quantity_remaining = ?, status = ? WHERE roll_id = ?`,
        [newQty, newStatus, roll_id]
      );

      // 3. Ghi log giao dịch theo enum của schema.
      await connection.query(
        `INSERT INTO inventory_transactions
          (roll_id, transaction_type, quantity, from_location_id, to_location_id, reference_type, reference_id, note, transaction_date)
         VALUES (?, 'OUTBOUND', ?, ?, NULL, 'EXPORT_ORDER', ?, ?, NOW())`,
        [
          roll_id,
          qty,
          currentRoll.location_id || null,
          orderResult.insertId,
          note || `Xuất kho hàng loạt cuộn ${currentRoll.roll_code}`,
        ]
      );
      await connection.query(
        `INSERT INTO export_details (export_id, roll_id, quantity, note)
         VALUES (?, ?, ?, ?)`,
        [orderResult.insertId, roll_id, qty, typeof note === 'string' ? note.trim() || null : null]
      );
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: `Đã xuất kho thành công ${items.length} cuộn vải trong một Transaction.`,
      data: { order_id: orderResult.insertId, order_code: orderCode },
    });
  } catch (error: any) {
    await connection.rollback();
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    connection.release();
  }
}