import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await db.query(
      `SELECT 
        l.location_id, 
        l.location_code, 
        l.floor_number, 
        l.side, 
        s.shelf_code, 
        s.shelf_name, 
        w.warehouse_code, 
        w.warehouse_name 
       FROM locations l
       JOIN shelves s ON l.shelf_id = s.shelf_id
       JOIN warehouses w ON s.warehouse_id = w.warehouse_id
       WHERE l.is_active = TRUE
       ORDER BY w.warehouse_code, s.shelf_code, l.location_code`
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}