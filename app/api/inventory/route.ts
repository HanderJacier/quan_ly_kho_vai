import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const typeId = searchParams.get('type_id') || '';
    const status = searchParams.get('status') || 'ACTIVE';

    let whereClauses = ['r.status = ?'];
    let queryParams: any[] = [status];

    if (search) {
      whereClauses.push('(r.roll_code LIKE ? OR r.barcode LIKE ? OR f.fabric_name LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (typeId) {
      whereClauses.push('r.type_id = ?');
      queryParams.push(typeId);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const query = `
      SELECT 
        r.roll_id,
        r.roll_code,
        r.barcode,
        f.fabric_name,
        c.color_name,
        r.quantity_initial,
        r.quantity_remaining,
        u.unit_name,
        l.location_code,
        r.inbound_date,
        r.expiry_date,
        r.status,
        DATEDIFF(NOW(), r.inbound_date) AS days_in_stock,
        CASE 
          WHEN r.inbound_date IS NOT NULL AND DATEDIFF(NOW(), r.inbound_date) > 730 THEN 1 
          ELSE 0 
        END AS is_expired
      FROM fabric_rolls r
      LEFT JOIN fabrics f ON r.fabric_id = f.fabric_id
      LEFT JOIN fabric_colors c ON r.color_id = c.color_id
      LEFT JOIN units u ON r.unit_id = u.unit_id
      LEFT JOIN locations l ON r.location_id = l.location_id
      ${whereSql}
      ORDER BY r.inbound_date ASC
    `;

    const [rows] = await db.query(query, queryParams);

    return NextResponse.json({
      success: true,
      total: (rows as any[]).length,
      data: rows,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}