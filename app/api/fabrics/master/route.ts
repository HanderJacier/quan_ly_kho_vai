import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [types] = await db.query(
      `SELECT type_id, type_code, type_name FROM fabric_types WHERE is_active = TRUE ORDER BY type_name ASC`
    );
    const [colors] = await db.query(
      `SELECT color_id, color_code, color_name FROM fabric_colors WHERE is_active = TRUE ORDER BY color_name ASC`
    );
    const [units] = await db.query(
      `SELECT unit_id, unit_code, unit_name FROM units WHERE is_active = TRUE ORDER BY unit_name ASC`
    );

    return NextResponse.json({
      success: true,
      data: {
        types,
        colors,
        units
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}