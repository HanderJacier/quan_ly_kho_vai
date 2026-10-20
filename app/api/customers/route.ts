import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Lấy danh sách khách hàng
export async function GET() {
  try {
    const [rows] = await db.query(
      `SELECT customer_id, customer_code, customer_name, phone, address, is_active 
       FROM customers 
       WHERE is_active = TRUE 
       ORDER BY customer_name ASC`
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Tạo mới khách hàng
export async function POST(request: Request) {
  try {
    const { customer_code, customer_name, phone, address } = await request.json();

    if (!customer_name) {
      return NextResponse.json(
        { success: false, error: 'Tên khách hàng là bắt buộc' },
        { status: 400 }
      );
    }

    const [result]: any = await db.query(
      `INSERT INTO customers (customer_code, customer_name, phone, address) 
       VALUES (?, ?, ?, ?)`,
      [customer_code || `KH-${Date.now()}`, customer_name, phone || null, address || null]
    );

    return NextResponse.json({
      success: true,
      message: 'Thêm khách hàng thành công',
      data: { customer_id: result.insertId, customer_name }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}