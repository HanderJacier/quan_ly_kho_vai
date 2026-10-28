import { NextResponse } from 'next/server';
import { db, hasColumn } from '@/lib/db';

export async function GET() {
  try {
    const [fabrics]: any = await db.query(`SELECT fabric_id AS id, fabric_name AS name, fabric_code AS code FROM fabrics WHERE is_active = TRUE ORDER BY fabric_name`);
    const [colors]: any = await db.query(
      `SELECT color_id AS id, color_name AS name FROM fabric_colors WHERE is_active = TRUE ORDER BY color_name`
    );
    const [types]: any = await db.query(`SELECT type_id AS id, type_name AS name FROM fabric_types WHERE is_active = TRUE ORDER BY type_name`);
    const [units]: any = await db.query(`SELECT unit_id AS id, unit_name AS name FROM units WHERE is_active = TRUE ORDER BY unit_name`);
    const locationNameColumn = await hasColumn('locations', 'location_name') ? 'location_name' : 'location_code';
    const [locations]: any = await db.query(
      `SELECT location_id AS id, location_code AS code, ${locationNameColumn} AS name FROM locations WHERE is_active = TRUE ORDER BY location_code`
    );

    return NextResponse.json({
      success: true,
      data: {
        fabrics,
        colors,
        types,
        units,
        locations,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}