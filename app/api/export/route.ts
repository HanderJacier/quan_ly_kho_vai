import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await db.query(`
      SELECT 
        e.export_id,
        e.order_no,
        e.export_type,
        e.order_date,
        e.status,
        e.note,
        c.customer_name,
        COUNT(d.detail_id) AS total_rolls,
        COALESCE(SUM(d.quantity), 0) AS total_quantity
      FROM export_orders e
      LEFT JOIN customers c ON e.customer_id = c.customer_id
      LEFT JOIN export_details d ON e.export_id = d.export_id
      GROUP BY 
        e.export_id,
        e.order_no,
        e.export_type,
        e.order_date,
        e.status,
        e.note,
        c.customer_name
      ORDER BY e.order_date DESC
    `);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const connection = await db.getConnection();

  try {
    const body = await request.json();
    const { 
      export_type = 'SALE', 
      customer_id, 
      reference_no, 
      note, 
      items // Mảng các cuộn vải xuất: [{ roll_id: 2, quantity: 20.5 }]
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Danh sách cuộn vải xuất (items) không được trống' },
        { status: 400 }
      );
    }

    // Bắt đầu Transaction để đảm bảo tính toàn vẹn dữ liệu
    await connection.beginTransaction();

    // 1. Tạo mã đơn xuất tự động (VD: EXP-20261020-XXXX)
    const orderNo = `EXP-${Date.now()}`;

    // 2. Thêm mới bản ghi vào export_orders
    const [exportResult]: any = await connection.query(
      `INSERT INTO export_orders (order_no, export_type, customer_id, reference_no, note, status, order_date)
       VALUES (?, ?, ?, ?, ?, 'COMPLETED', NOW())`,
      [orderNo, export_type, customer_id || null, reference_no || null, note || null]
    );

    const exportId = exportResult.insertId;

    // 3. Duyệt qua từng cuộn vải để xuất
    for (const item of items) {
      const { roll_id, quantity } = item;

      if (!roll_id || !quantity || quantity <= 0) {
        throw new Error(`Thông tin roll_id hoặc quantity không hợp lệ`);
      }

      // Kiểm tra số lượng tồn kho thực tế
      const [rolls]: any = await connection.query(
        `SELECT quantity_remaining FROM fabric_rolls WHERE roll_id = ? FOR UPDATE`,
        [roll_id]
      );

      if (rolls.length === 0) {
        throw new Error(`Không tìm thấy cuộn vải ID: ${roll_id}`);
      }

      const currentQty = parseFloat(rolls[0].quantity_remaining);
      if (currentQty < quantity) {
        throw new Error(`Cuộn ID ${roll_id} chỉ còn ${currentQty}, không đủ để xuất ${quantity}`);
      }

      // Lưu vào export_details
      await connection.query(
        `INSERT INTO export_details (export_id, roll_id, quantity) VALUES (?, ?, ?)`,
        [exportId, roll_id, quantity]
      );

      // Cập nhật số lượng còn lại trong fabric_rolls
      const newQty = currentQty - quantity;
      const newStatus = newQty === 0 ? 'OUT_OF_STOCK' : 'ACTIVE';

      await connection.query(
        `UPDATE fabric_rolls 
         SET quantity_remaining = ?, status = ? 
         WHERE roll_id = ?`,
        [newQty, newStatus, roll_id]
      );
    }

    // Xác nhận hoàn tất Transaction
    await connection.commit();

    return NextResponse.json({
      success: true,
      export_id: exportId,
      order_no: orderNo,
      message: 'Xuất kho thành công',
    });

  } catch (error: any) {
    // Nếu có lỗi, hoàn tác lại toàn bộ thao tác
    await connection.rollback();
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}