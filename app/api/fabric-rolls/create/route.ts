import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import { db, hasColumn } from '@/lib/db';

class InboundValidationError extends Error {}

export async function POST(request: Request) {
  const connection = await db.getConnection();
  let transactionStarted = false;

  try {
    const body = await request.json();
    const { rolls } = body; // Nhận vào một mảng các cuộn vải

    if (!Array.isArray(rolls) || rolls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Danh sách nhập kho không hợp lệ hoặc trống.' },
        { status: 400 }
      );
    }

    const [hasLotCode, hasSupplierName] = await Promise.all([
      hasColumn('fabric_rolls', 'lot_code'),
      hasColumn('fabric_rolls', 'supplier_name'),
    ]);
    const needsLotCode = rolls.some((item) => typeof item?.lot_code === 'string' && item.lot_code.trim() !== '');
    const needsSupplierName = rolls.some((item) => typeof item?.supplier_name === 'string' && item.supplier_name.trim() !== '');
    if ((!hasLotCode && needsLotCode) || (!hasSupplierName && needsSupplierName)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cơ sở dữ liệu chưa có cột mã lô hoặc nhà cung cấp. Vui lòng chạy migration 20261029_add_fabric_roll_lot_supplier.sql trên TiDB rồi thử lại.',
        },
        { status: 409 }
      );
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const insertedIds: number[] = [];
    const insertedLabels: Array<{ roll_id: number; roll_code: string; barcode: string }> = [];

    for (let i = 0; i < rolls.length; i++) {
      const item = rolls[i];
      const {
        stock_type,
        roll_code,
        lot_code,
        supplier_name,
        barcode,
        fabric_id,
        color_id,
        type_id,
        location_id,
        unit_id,
        quantity_initial,
        note,
      } = item;
      const stockType = stock_type ?? 'REGULAR';

      // 1. Validate bắt buộc từng dòng
      if (!roll_code || !fabric_id || !quantity_initial || Number(quantity_initial) <= 0) {
        throw new InboundValidationError(`Dòng thứ ${i + 1}: Thiếu thông tin bắt buộc hoặc số lượng <= 0.`);
      }
      if (!['REGULAR', 'REMNANT', 'SAVING'].includes(stockType)) {
        throw new InboundValidationError(`Dòng thứ ${i + 1}: Phân loại tồn kho không hợp lệ.`);
      }
      if (
        (typeof roll_code === 'string' && roll_code.length > 100) ||
        (typeof lot_code === 'string' && lot_code.length > 100) ||
        (typeof supplier_name === 'string' && supplier_name.length > 160) ||
        (typeof barcode === 'string' && barcode.length > 150)
      ) {
        throw new InboundValidationError(`Dòng thứ ${i + 1}: Độ dài vượt giới hạn (mã cuộn/mã lô 100, nhà cung cấp 160, barcode 150 ký tự).`);
      }
      // 2. Kiểm tra trùng lặp roll_code hoặc barcode trong DB
      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT roll_id FROM fabric_rolls WHERE roll_code = ? OR (barcode IS NOT NULL AND barcode = ? AND barcode != '')`,
        [roll_code, barcode || '']
      );

      if (existing.length > 0) {
        throw new InboundValidationError(`Dòng thứ ${i + 1}: Mã cuộn "${roll_code}" hoặc Barcode đã tồn tại trong hệ thống.`);
      }

      const barcodeValue = barcode || `BC-${randomUUID()}`;
      const insertColumns = ['roll_code'];
      const insertValues = [roll_code];
      if (hasLotCode) {
        insertColumns.push('lot_code');
        insertValues.push(lot_code || null);
      }
      insertColumns.push('barcode');
      insertValues.push(barcodeValue);
      if (hasSupplierName) {
        insertColumns.push('supplier_name');
        insertValues.push(supplier_name || null);
      }
      insertColumns.push(
        'fabric_id',
        'color_id',
        'type_id',
        'location_id',
        'unit_id',
        'quantity_initial',
        'quantity_remaining',
        'stock_type'
      );
      insertValues.push(
        fabric_id,
        color_id || null,
        type_id || null,
        location_id || null,
        unit_id || null,
        quantity_initial,
        quantity_initial,
        stockType
      );

      // 3. Thực hiện Insert cuộn vải
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO fabric_rolls (
          ${insertColumns.join(', ')}, inbound_date, expiry_date, status, note
        ) VALUES (
          ${insertColumns.map(() => '?').join(', ')}, CURRENT_DATE(),
          DATE_ADD(CURRENT_DATE(), INTERVAL 2 YEAR),
          IF(DATE_ADD(CURRENT_DATE(), INTERVAL 2 YEAR) <= CURRENT_DATE(), 'EXPIRED', 'ACTIVE'), ?
        )`,
        [...insertValues, note || null]
      );

      insertedIds.push(result.insertId);
      insertedLabels.push({
        roll_id: result.insertId,
        roll_code,
        barcode: barcodeValue,
      });

      await connection.query(
        `INSERT INTO inventory_transactions (
          roll_id, transaction_type, quantity, to_location_id, note, transaction_date
        ) VALUES (?, 'INBOUND', ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          result.insertId,
          quantity_initial,
          location_id || null,
          note || `Nhập kho cuộn ${roll_code}`,
        ]
      );
    }

    await connection.commit();
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      message: `Nhập kho thành công ${rolls.length} cuộn vải trong một Batch Transaction.`,
      data: { count: rolls.length, insertedIds, labels: insertedLabels },
    });
  } catch (error: unknown) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Không thể hoàn tác giao dịch nhập kho:', rollbackError);
      }
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Lỗi hệ thống khi nhập kho hàng loạt.' },
      { status: error instanceof InboundValidationError ? 400 : 500 }
    );
  } finally {
    connection.release();
  }
}