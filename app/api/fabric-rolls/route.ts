import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Truy vấn lấy danh sách cuộn vải kèm trạng thái quá hạn
    const [rows] = await db.query(`
      SELECT 
        roll_id,
        roll_code,
        barcode,
        quantity_remaining,
        inbound_date,
        status,
        CASE 
          WHEN inbound_date IS NOT NULL AND DATEDIFF(NOW(), inbound_date) > 730 THEN 1 
          ELSE 0 
        END AS is_expired
      FROM fabric_rolls
      LIMIT 10
    `);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}