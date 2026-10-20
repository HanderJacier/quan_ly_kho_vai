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