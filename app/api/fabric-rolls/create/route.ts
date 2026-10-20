import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      roll_code, 
      barcode, 
      fabric_id, 
      color_id, 
      type_id, 
      location_id, 
      quantity_initial, 
      unit_id,
      note 
    } = body;

    if (!roll_code || !fabric_id) {
      return NextResponse.json(
        { success: false, error: 'Mã cuộn (roll_code) và Loại vải (fabric_id) là bắt buộc' },
        { status: 400 }
      );
    }

    const qty = quantity_initial || 0;

    const [result]: any = await db.query(
      `INSERT INTO fabric_rolls 
        (roll_code, barcode, fabric_id, color_id, type_id, location_id, quantity_initial, quantity_remaining, unit_id, inbound_date, status, note) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 'ACTIVE', ?)`,
      [
        roll_code,
        barcode || null,
        fabric_id,
        color_id || null,
        type_id || null,
        location_id || null,
        qty,
        qty,
        unit_id || null,
        note || null
      ]
    );

    return NextResponse.json({
      success: true,
      roll_id: result.insertId,
      message: 'Nhập kho cuộn vải thành công',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}