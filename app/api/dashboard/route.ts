import { NextResponse } from 'next/server';
import { type RowDataPacket } from 'mysql2';
import { db } from '@/lib/db';

interface InventorySummaryRow extends RowDataPacket {
  total_rolls: number | string;
  aging_rolls: number | string;
  used_locations: number | string;
}

interface StockByUnitRow extends RowDataPacket {
  unit_name: string | null;
  quantity: number | string;
}

interface LatestRollRow extends RowDataPacket {
  roll_id: number;
  roll_code: string;
  fabric_name: string | null;
  color_name: string | null;
  current_quantity: number | string;
  unit_name: string | null;
  days_in_stock: number;
  location_name: string | null;
}

export async function GET() {
  try {
    const [summaryResult, stockByUnit, latestRolls] = await Promise.all([
      db.query<InventorySummaryRow[]>(`
        SELECT
          COUNT(*) AS total_rolls,
          SUM(CASE WHEN r.inbound_date < DATE_SUB(CURDATE(), INTERVAL 2 YEAR) THEN 1 ELSE 0 END) AS aging_rolls,
          COUNT(DISTINCT r.location_id) AS used_locations
        FROM fabric_rolls r
        WHERE r.quantity_remaining > 0 AND r.is_archived = 0
      `),
      db.query<StockByUnitRow[]>(`
        SELECT
          u.unit_name,
          SUM(r.quantity_remaining) AS quantity
        FROM fabric_rolls r
        LEFT JOIN units u ON r.unit_id = u.unit_id
        WHERE r.quantity_remaining > 0 AND r.is_archived = 0
        GROUP BY u.unit_id, u.unit_name
        ORDER BY u.unit_name
      `),
      db.query<LatestRollRow[]>(`
        SELECT
          r.roll_id,
          r.roll_code,
          f.fabric_name,
          c.color_name,
          r.quantity_remaining AS current_quantity,
          u.unit_name,
          COALESCE(DATEDIFF(CURDATE(), r.inbound_date), 0) AS days_in_stock,
          l.location_code AS location_name
        FROM fabric_rolls r
        LEFT JOIN fabrics f ON r.fabric_id = f.fabric_id
        LEFT JOIN fabric_colors c ON r.color_id = c.color_id
        LEFT JOIN units u ON r.unit_id = u.unit_id
        LEFT JOIN locations l ON r.location_id = l.location_id
        WHERE r.quantity_remaining > 0 AND r.is_archived = 0
        ORDER BY r.inbound_date DESC, r.roll_id DESC
        LIMIT 5
      `),
    ]);
    const [summaryRows] = summaryResult;
    const [unitRows] = stockByUnit;
    const [recentRows] = latestRolls;
    const summary = summaryRows[0];

    return NextResponse.json({
      success: true,
      data: {
        totalRolls: Number(summary?.total_rolls ?? 0),
        quantitiesByUnit: unitRows.map((row) => ({
          unitName: row.unit_name || 'Chưa rõ đơn vị',
          quantity: Number(row.quantity),
        })),
        agingRolls: Number(summary?.aging_rolls ?? 0),
        uniqueLocations: Number(summary?.used_locations ?? 0),
        latestRolls: recentRows,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể tải dữ liệu tổng quan.',
      },
      { status: 500 }
    );
  }
}
