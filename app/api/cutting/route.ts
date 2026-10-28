import { NextResponse } from 'next/server';
import { type ResultSetHeader, type RowDataPacket } from 'mysql2';
import { type PoolConnection } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { db, hasColumn } from '@/lib/db';

interface CuttingHistoryRow extends RowDataPacket {
  cutting_id: number;
  cutting_date: Date;
  child_roll_id: number | null;
  saving_roll_id: number | null;
  return_completed_at: Date | null;
  cut_quantity: string;
  remaining_quantity: string;
  note: string | null;
  parent_roll_code: string;
  child_roll_code: string | null;
  child_roll_barcode: string | null;
  saving_roll_code: string | null;
  saving_roll_barcode: string | null;
  fabric_name: string;
  color_name: string | null;
  used_quantity: string;
  returned_quantity: string;
  saving_quantity: string;
}

interface CuttingCountRow extends RowDataPacket {
  total: number;
}

interface ParentRollRow extends RowDataPacket {
  roll_id: number;
  roll_code: string;
  lot_code: string | null;
  supplier_name: string | null;
  fabric_id: number;
  color_id: number | null;
  type_id: number | null;
  location_id: number | null;
  unit_id: number | null;
  quantity_remaining: string;
  inbound_date: Date | string | null;
  expiry_date: Date | string | null;
  stock_type: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'OUT_OF_STOCK';
}

interface PendingCutRow extends RowDataPacket {
  cutting_id: number;
  roll_id: number;
  parent_roll_code: string;
  lot_code: string | null;
  supplier_name: string | null;
  cut_quantity: string;
  return_completed_at: Date | null;
  fabric_id: number;
  color_id: number | null;
  type_id: number | null;
  location_id: number | null;
  unit_id: number | null;
  inbound_date: Date | string | null;
  expiry_date: Date | string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'OUT_OF_STOCK';
}

interface CorrectionCutRow extends RowDataPacket {
  cutting_id: number;
  roll_id: number;
  cut_quantity: string;
  returned_quantity: string;
  saving_quantity: string;
  used_quantity: string;
  remaining_quantity: string;
  note: string | null;
  return_completed_at: Date | null;
  child_roll_id: number | null;
  saving_roll_id: number | null;
}

interface CorrectionRollRow extends RowDataPacket {
  roll_id: number;
  roll_code: string;
  barcode: string | null;
  quantity_initial: string;
  quantity_remaining: string;
  location_id: number | null;
  stock_type: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'OUT_OF_STOCK';
  is_archived: number;
}

interface InventoryTransactionRow extends RowDataPacket {
  trans_id: number;
}

class CuttingRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function GET(request: Request) {
  try {
    const [
      hasChildRollId,
      hasSavingRollId,
      hasUsedQuantity,
      hasReturnedQuantity,
      hasSavingQuantity,
      hasReturnCompletedAt,
    ] = await Promise.all([
      hasColumn('cutting_orders', 'child_roll_id'),
      hasColumn('cutting_orders', 'saving_roll_id'),
      hasColumn('cutting_orders', 'used_quantity'),
      hasColumn('cutting_orders', 'returned_quantity'),
      hasColumn('cutting_orders', 'saving_quantity'),
      hasColumn('cutting_orders', 'return_completed_at'),
    ]);
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') || 1);
    const pageSize = Number(searchParams.get('pageSize') || 50);
    const search = searchParams.get('search')?.trim() || '';
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return NextResponse.json({ success: false, error: 'Tham số phân trang không hợp lệ.' }, { status: 400 });
    }
    const childRollColumn = hasChildRollId ? 'c.child_roll_id' : 'NULL';
    const childRollJoin = hasChildRollId ? 'LEFT JOIN fabric_rolls child ON c.child_roll_id = child.roll_id' : '';
    const savingRollJoin = hasSavingRollId ? 'LEFT JOIN fabric_rolls saving ON c.saving_roll_id = saving.roll_id' : '';
    const childRollCode = hasChildRollId ? 'child.roll_code' : 'NULL';
    const childRollBarcode = hasChildRollId ? 'child.barcode' : 'NULL';
    const savingRollColumn = hasSavingRollId ? 'c.saving_roll_id' : 'NULL';
    const savingRollCode = hasSavingRollId ? 'saving.roll_code' : 'NULL';
    const savingRollBarcode = hasSavingRollId ? 'saving.barcode' : 'NULL';
    const returnStatus = hasReturnCompletedAt ? 'c.return_completed_at' : 'c.cutting_date';
    const historySearchParts = [
      'r.roll_code LIKE ?',
      ...(hasChildRollId ? ['child.roll_code LIKE ?'] : []),
      ...(hasSavingRollId ? ['saving.roll_code LIKE ?'] : []),
      'f.fabric_name LIKE ?',
      'c.note LIKE ?',
    ];
    const whereSql = search ? `WHERE ${historySearchParts.join(' OR ')}` : '';
    const searchParamsForSql = search ? historySearchParts.map(() => `%${search}%`) : [];
    const fromSql = `
      FROM cutting_orders c
      JOIN fabric_rolls r ON c.roll_id = r.roll_id
      ${childRollJoin}
      ${savingRollJoin}
      JOIN fabrics f ON r.fabric_id = f.fabric_id
      LEFT JOIN fabric_colors color ON r.color_id = color.color_id
    `;
    const [[rows], [countRows]] = await Promise.all([
      db.query<CuttingHistoryRow[]>(`
      SELECT
        c.cutting_id,
        c.cutting_date,
        ${childRollColumn} AS child_roll_id,
        ${savingRollColumn} AS saving_roll_id,
        ${returnStatus} AS return_completed_at,
        c.cut_quantity,
        c.remaining_quantity,
        c.note,
        r.roll_code AS parent_roll_code,
        ${childRollCode} AS child_roll_code,
        ${childRollBarcode} AS child_roll_barcode,
        ${savingRollCode} AS saving_roll_code,
        ${savingRollBarcode} AS saving_roll_barcode,
        ${hasUsedQuantity ? 'c.used_quantity' : 'c.cut_quantity'} AS used_quantity,
        ${hasReturnedQuantity ? 'c.returned_quantity' : '0'} AS returned_quantity,
        ${hasSavingQuantity ? 'c.saving_quantity' : '0'} AS saving_quantity,
        f.fabric_name,
        color.color_name
      ${fromSql}
      ${whereSql}
      ORDER BY c.cutting_date DESC, c.cutting_id DESC
      LIMIT ? OFFSET ?
    `, [...searchParamsForSql, pageSize, (page - 1) * pageSize]),
      db.query<CuttingCountRow[]>(`SELECT COUNT(*) AS total ${fromSql} ${whereSql}`, searchParamsForSql),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    return NextResponse.json({
      success: true,
      data: rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error('Không thể tải lịch sử cắt vải:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tải lịch sử cắt vải.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Dữ liệu yêu cầu không phải JSON hợp lệ.' },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { success: false, error: 'Dữ liệu yêu cầu không hợp lệ.' },
      { status: 400 }
    );
  }

  const values = body as Record<string, unknown>;
  const parentRollId = Number(values.parent_roll_id);
  const issuedQty = Number(values.issued_quantity ?? values.cut_quantity);
  const note = typeof values.note === 'string' ? values.note.trim() : '';

  const validQuantity = (quantity: number) => Number.isFinite(quantity)
    && quantity >= 0
    && Math.abs(quantity * 1000 - Math.round(quantity * 1000)) <= 1e-7;
  if (!Number.isSafeInteger(parentRollId) || parentRollId <= 0) {
    return NextResponse.json({ success: false, error: 'Cuộn vải gốc không hợp lệ.' }, { status: 400 });
  }
  if (!validQuantity(issuedQty) || issuedQty <= 0) {
    return NextResponse.json(
      { success: false, error: 'Số lượng mang ra phải lớn hơn 0, tối đa 3 chữ số thập phân.' },
      { status: 400 }
    );
  }

  let connection: PoolConnection | undefined;
  let transactionStarted = false;

  try {
    const transactionConnection = await db.getConnection();
    connection = transactionConnection;
    await transactionConnection.beginTransaction();
    transactionStarted = true;

    const [parents] = await transactionConnection.query<ParentRollRow[]>(
      `SELECT
        roll_id, roll_code, fabric_id, color_id, type_id, location_id, unit_id,
        quantity_remaining, inbound_date, expiry_date, stock_type, status, lot_code, supplier_name
       FROM fabric_rolls
       WHERE roll_id = ? AND is_archived = 0
       FOR UPDATE`,
      [parentRollId]
    );

    const parent = parents[0];
    if (!parent) {
      throw new CuttingRequestError('Không tìm thấy cuộn vải gốc.', 404);
    }

    const parentQty = Number(parent.quantity_remaining);
    if (!Number.isFinite(parentQty) || parentQty <= 0 || parent.status === 'OUT_OF_STOCK') {
      throw new CuttingRequestError('Cuộn vải gốc không còn tồn kho để cắt.', 409);
    }

    if (issuedQty > parentQty) {
      throw new CuttingRequestError(
        `Số lượng mang ra (${issuedQty}) vượt quá tồn kho hiện tại của cuộn mẹ (${parentQty}).`,
        400
      );
    }

    const newParentQty = Number((parentQty - issuedQty).toFixed(3));
    await transactionConnection.query(
      `UPDATE fabric_rolls SET quantity_remaining = ?, status = ? WHERE roll_id = ?`,
      [newParentQty, newParentQty === 0 ? 'OUT_OF_STOCK' : parent.status, parentRollId]
    );

    const [cuttingResult] = await transactionConnection.query<ResultSetHeader>(
      `INSERT INTO cutting_orders (
        roll_id, child_roll_id, saving_roll_id, cut_quantity, used_quantity,
        returned_quantity, saving_quantity, remaining_quantity, note, cutting_date, return_completed_at
      ) VALUES (?, NULL, NULL, ?, 0, 0, 0, ?, ?, NOW(), NULL)`,
      [parentRollId, issuedQty, newParentQty, note || `Mang ra ${issuedQty}m để cắt từ cuộn ${parent.roll_code}`]
    );

    await transactionConnection.query(
      `INSERT INTO inventory_transactions
        (roll_id, transaction_type, quantity, from_location_id, to_location_id, reference_type, reference_id, note, transaction_date)
       VALUES (?, 'CUTTING', ?, ?, ?, 'CUTTING_ORDER', ?, ?, NOW())`,
      [
        parentRollId,
        issuedQty,
        parent.location_id,
        parent.location_id,
        cuttingResult.insertId,
        note || `Mang ra ${issuedQty}m để cắt từ cuộn ${parent.roll_code}`,
      ]
    );

    await transactionConnection.commit();
    transactionStarted = false;

    return NextResponse.json({
      success: true,
      message: `Đã ghi nhận mang ra ${issuedQty}m. Khi hoàn thành, hãy nhập số mét thực tế còn lại và phân loại vải trả về.`,
      data: {
        cutting_id: cuttingResult.insertId,
        parent_remaining_qty: newParentQty,
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Không thể hoàn tác giao dịch cắt vải:', rollbackError);
      }
    }

    if (error instanceof CuttingRequestError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ success: false, error: 'Mã cuộn hoặc mã vạch đã tồn tại trong hệ thống.' }, { status: 409 });
    }
    console.error('Không thể thực hiện cắt vải:', error);
    return NextResponse.json({ success: false, error: 'Không thể thực hiện cắt vải. Vui lòng thử lại.' }, { status: 500 });
  } finally {
    connection?.release();
  }
}

export async function PATCH(request: Request) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không phải JSON hợp lệ.' }, { status: 400 });
      }

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ.' }, { status: 400 });
      }

      const values = body as Record<string, unknown>;
      if (values.action === 'correct') {
        return await correctCuttingRecord(values);
      }
      const cuttingId = Number(values.cutting_id);
      const returnedQty = Number(values.returned_quantity);
      const isSaving = values.is_saving === true;
      const rollCode = typeof values.roll_code === 'string' ? values.roll_code.trim() : '';
      const barcode = typeof values.barcode === 'string' ? values.barcode.trim() : '';
      if (!Number.isSafeInteger(cuttingId) || cuttingId <= 0) {
        return NextResponse.json({ success: false, error: 'Lần cắt cần hoàn tất không hợp lệ.' }, { status: 400 });
      }
      if (!Number.isFinite(returnedQty) || returnedQty < 0 || Math.abs(returnedQty * 1000 - Math.round(returnedQty * 1000)) > 1e-7) {
        return NextResponse.json({ success: false, error: 'Số mét trả về phải từ 0 trở lên và tối đa 3 chữ số thập phân.' }, { status: 400 });
      }
      if (returnedQty > 0 && !rollCode) {
        return NextResponse.json({ success: false, error: 'Vui lòng nhập mã cho cuộn vải trả về.' }, { status: 400 });
      }
      if (rollCode.length > 100 || barcode.length > 150) {
        return NextResponse.json({ success: false, error: 'Mã cuộn tối đa 100 ký tự và barcode tối đa 150 ký tự.' }, { status: 400 });
      }

      let connection: PoolConnection | undefined;
      let transactionStarted = false;
      try {
        const transactionConnection = await db.getConnection();
        connection = transactionConnection;
        await transactionConnection.beginTransaction();
        transactionStarted = true;

        const [cuts] = await transactionConnection.query<PendingCutRow[]>(
          `SELECT c.cutting_id, c.roll_id, c.cut_quantity, c.return_completed_at,
            r.roll_code AS parent_roll_code, r.fabric_id, r.color_id, r.type_id,
            r.location_id, r.unit_id, r.inbound_date, r.expiry_date, r.status,
            r.lot_code, r.supplier_name
           FROM cutting_orders c
           JOIN fabric_rolls r ON c.roll_id = r.roll_id
           WHERE c.cutting_id = ?
           FOR UPDATE`,
          [cuttingId]
        );
        const cut = cuts[0];
        if (!cut) throw new CuttingRequestError('Không tìm thấy lần cắt cần ghi nhận trả về.', 404);
        if (cut.return_completed_at) throw new CuttingRequestError('Lần cắt này đã được ghi nhận trả vải.', 409);
        const issuedQty = Number(cut.cut_quantity);
        if (returnedQty > issuedQty) {
          throw new CuttingRequestError(`Số mét trả về không được vượt quá số mang ra (${issuedQty}m).`, 400);
        }

        let returnedRollId: number | null = null;
        if (returnedQty > 0) {
          const [duplicates] = await transactionConnection.query<RowDataPacket[]>(
            `SELECT roll_id FROM fabric_rolls
             WHERE roll_code = ? OR (? <> '' AND barcode = ?)
             LIMIT 1`,
            [rollCode, barcode, barcode]
          );
          if (duplicates.length) throw new CuttingRequestError('Mã cuộn hoặc barcode đã tồn tại trong hệ thống.', 409);

          const stockType = isSaving ? 'SAVING' : 'REMNANT';
          const [insertResult] = await transactionConnection.query<ResultSetHeader>(
            `INSERT INTO fabric_rolls (
              roll_code, lot_code, supplier_name, barcode, fabric_id, color_id, type_id, location_id, unit_id,
              quantity_initial, quantity_remaining, inbound_date, expiry_date, stock_type, status, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE(), ?, ?, ?, ?)`,
            [
              rollCode,
              cut.lot_code,
              cut.supplier_name,
              barcode || `BC-RETURN-${randomUUID()}`,
              cut.fabric_id,
              cut.color_id,
              cut.type_id,
              cut.location_id,
              cut.unit_id,
              returnedQty,
              returnedQty,
              cut.expiry_date,
              stockType,
              cut.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
              `${isSaving ? 'Vải tiết kiệm' : 'Đầu khúc trả thường'} từ cuộn ${cut.parent_roll_code}`,
            ]
          );
          returnedRollId = insertResult.insertId;
          await transactionConnection.query(
            `INSERT INTO inventory_transactions
              (roll_id, transaction_type, quantity, to_location_id, reference_type, reference_id, note, transaction_date)
             VALUES (?, 'RETURN_IN', ?, ?, 'CUTTING_ORDER', ?, ?, NOW())`,
            [
              returnedRollId,
              returnedQty,
              cut.location_id,
              cuttingId,
              `${stockType} trả về từ lần cắt cuộn ${cut.parent_roll_code}`,
            ]
          );
        }

        const usedQty = Number((issuedQty - returnedQty).toFixed(3));
        await transactionConnection.query(
          `UPDATE cutting_orders
           SET child_roll_id = ?, saving_roll_id = ?, used_quantity = ?,
               returned_quantity = ?, saving_quantity = ?, return_completed_at = NOW()
           WHERE cutting_id = ?`,
          [
            returnedRollId && !isSaving ? returnedRollId : null,
            returnedRollId && isSaving ? returnedRollId : null,
            usedQty,
            returnedQty,
            returnedRollId && isSaving ? returnedQty : 0,
            cuttingId,
          ]
        );

        await transactionConnection.commit();
        transactionStarted = false;
        return NextResponse.json({
          success: true,
          message: returnedQty === 0
            ? `Đã hoàn tất lần cắt. Toàn bộ ${issuedQty}m được ghi nhận đã sử dụng.`
            : `Đã nhập lại ${returnedQty}m vào ${isSaving ? 'tồn vải tiết kiệm' : 'tồn đầu khúc thường'}.`,
          data: { cutting_id: cuttingId, returned_roll_id: returnedRollId, returned_quantity: returnedQty, used_quantity: usedQty },
        });
      } catch (error) {
        if (connection && transactionStarted) {
          try {
            await connection.rollback();
          } catch (rollbackError) {
            console.error('Không thể hoàn tác ghi nhận trả vải:', rollbackError);
          }
        }


        if (error instanceof CuttingRequestError) {
          return NextResponse.json({ success: false, error: error.message }, { status: error.status });
        }
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
          return NextResponse.json({ success: false, error: 'Mã cuộn hoặc barcode đã tồn tại trong hệ thống.' }, { status: 409 });
        }
        console.error('Không thể ghi nhận trả vải sau khi cắt:', error);
        return NextResponse.json({ success: false, error: 'Không thể ghi nhận trả vải. Vui lòng thử lại.' }, { status: 500 });
      } finally {
        connection?.release();
      }
    }

async function correctCuttingRecord(values: Record<string, unknown>) {
    const cuttingId = Number(values.cutting_id);
    const issuedQty = Number(values.issued_quantity);
    const returnedQty = Number(values.returned_quantity);
    const isSaving = values.is_saving === true;
    const note = typeof values.note === 'string' ? values.note.trim() : '';
    const rollCode = typeof values.roll_code === 'string' ? values.roll_code.trim() : '';
    const barcode = typeof values.barcode === 'string' ? values.barcode.trim() : '';
    const validQuantity = (quantity: number) => Number.isFinite(quantity)
        && quantity >= 0
        && Math.abs(quantity * 1000 - Math.round(quantity * 1000)) <= 1e-7;
    if (!Number.isSafeInteger(cuttingId) || cuttingId <= 0) {
        return NextResponse.json({ success: false, error: 'Lần cắt cần điều chỉnh không hợp lệ.' }, { status: 400 });
    }
    if (!validQuantity(issuedQty) || issuedQty <= 0 || !validQuantity(returnedQty) || returnedQty > issuedQty) {
        return NextResponse.json({ success: false, error: 'Số mang ra phải lớn hơn 0; số trả về không được vượt quá số mang ra (tối đa 3 chữ số thập phân).' }, { status: 400 });
    }
    if (note.length > 1000 || rollCode.length > 100 || barcode.length > 150) {
        return NextResponse.json({ success: false, error: 'Ghi chú tối đa 1000 ký tự, mã cuộn tối đa 100 ký tự và barcode tối đa 150 ký tự.' }, { status: 400 });
    }
    if (returnedQty > 0 && !rollCode) {
        return NextResponse.json({ success: false, error: 'Vui lòng nhập mã cuộn cho vải trả về.' }, { status: 400 });
    }
    let connection: PoolConnection | undefined;
    let transactionStarted = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        const [cutRows] = await connection.query<CorrectionCutRow[]>(`SELECT cutting_id, roll_id, cut_quantity, returned_quantity, saving_quantity,
        used_quantity, remaining_quantity, note, return_completed_at,
        child_roll_id, saving_roll_id
     FROM cutting_orders
     WHERE cutting_id = ?
     FOR UPDATE`, [cuttingId]);
        const cut = cutRows[0];
        if (!cut)
            throw new CuttingRequestError('Không tìm thấy lần cắt cần điều chỉnh.', 404);
        const oldIssuedQty = Number(cut.cut_quantity);
        const oldReturnedQty = Number(cut.returned_quantity);
        if (cut.child_roll_id && cut.saving_roll_id && cut.child_roll_id !== cut.saving_roll_id) {
            throw new CuttingRequestError('Dữ liệu lần cắt đang liên kết đồng thời hai cuộn trả về; cần kiểm tra dữ liệu trước khi điều chỉnh.', 409);
        }
        const oldReturnedRollId = cut.child_roll_id ?? cut.saving_roll_id;
        const targetStockType = isSaving ? 'SAVING' : 'REMNANT';
        const parentQtyChanged = issuedQty !== oldIssuedQty;
        const returnValuesChanged = returnedQty !== oldReturnedQty
            || (Boolean(oldReturnedRollId) && Boolean(cut.saving_roll_id) !== isSaving)
            || (returnedQty > 0 && !oldReturnedRollId);
        const [parentRows] = await connection.query<ParentRollRow[]>(`SELECT roll_id, roll_code, lot_code, supplier_name, fabric_id, color_id, type_id,
        location_id, unit_id, quantity_remaining, inbound_date, expiry_date, stock_type, status
     FROM fabric_rolls
     WHERE roll_id = ? AND is_archived = 0
     FOR UPDATE`, [cut.roll_id]);
        const parent = parentRows[0];
        if (!parent)
            throw new CuttingRequestError('Không tìm thấy cuộn mẹ hoặc cuộn mẹ đã lưu trữ.', 409);
        let nextParentQty = Number(parent.quantity_remaining);
        if (!Number.isFinite(nextParentQty) || nextParentQty < 0) {
            throw new CuttingRequestError('Tồn cuộn mẹ hiện không hợp lệ; không thể điều chỉnh an toàn.', 409);
        }
        if (parentQtyChanged) {
            const [originalTransactions] = await connection.query<InventoryTransactionRow[]>(`SELECT trans_id FROM inventory_transactions
       WHERE roll_id = ? AND transaction_type = 'CUTTING'
         AND reference_type = 'CUTTING_ORDER' AND reference_id = ?
       ORDER BY trans_id ASC LIMIT 1 FOR UPDATE`, [cut.roll_id, cuttingId]);
            const originalTransaction = originalTransactions[0];
            if (!originalTransaction) {
                throw new CuttingRequestError('Không thể điều chỉnh số mang ra an toàn vì thiếu giao dịch cắt gốc trong nhật ký tồn kho.', 409);
            }
            const [laterTransactions] = await connection.query<InventoryTransactionRow[]>(`SELECT trans_id FROM inventory_transactions
       WHERE roll_id = ? AND trans_id > ?
         AND (reference_type IS NULL OR reference_type <> 'CUTTING_CORRECTION'
           OR reference_id IS NULL OR reference_id <> ?)
       LIMIT 1 FOR UPDATE`, [cut.roll_id, originalTransaction.trans_id, cuttingId]);
            if (laterTransactions.length) {
                throw new CuttingRequestError('Không thể đổi số mang ra: tồn cuộn mẹ đã phát sinh giao dịch sau lần cắt này. Hãy kiểm kê/điều chỉnh tồn riêng để tránh làm sai số liệu.', 409);
            }
            const difference = Number((issuedQty - oldIssuedQty).toFixed(3));
            nextParentQty = Number((nextParentQty - difference).toFixed(3));
            if (nextParentQty < 0) {
                throw new CuttingRequestError(`Không thể tăng số mang ra vì cuộn mẹ hiện chỉ còn ${parent.quantity_remaining}m.`, 409);
            }
            const nextParentStatus = nextParentQty === 0
                ? 'OUT_OF_STOCK'
                : parent.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE';
            await connection.query('UPDATE fabric_rolls SET quantity_remaining = ?, status = ? WHERE roll_id = ?', [nextParentQty, nextParentStatus, cut.roll_id]);
            await connection.query<ResultSetHeader>(`INSERT INTO inventory_transactions
        (roll_id, transaction_type, quantity, from_location_id, to_location_id, reference_type, reference_id, note, transaction_date)
       VALUES (?, 'ADJUSTMENT', ?, ?, ?, 'CUTTING_CORRECTION', ?, ?, NOW())`, [
                cut.roll_id,
                Math.abs(difference),
                parent.location_id,
                parent.location_id,
                cuttingId,
                `Điều chỉnh lần cắt #${cuttingId}: số mang ra ${oldIssuedQty}m -> ${issuedQty}m`,
            ]);
        }
        let returnedRoll: CorrectionRollRow | undefined;
        if (oldReturnedRollId) {
            const [returnedRows] = await connection.query<CorrectionRollRow[]>(`SELECT roll_id, roll_code, barcode, quantity_initial, quantity_remaining,
          location_id, stock_type, status, is_archived
       FROM fabric_rolls
       WHERE roll_id = ?
       FOR UPDATE`, [oldReturnedRollId]);
            returnedRoll = returnedRows[0];
            if (!returnedRoll || returnedRoll.is_archived) {
                throw new CuttingRequestError('Không thể điều chỉnh: cuộn vải trả về không còn tồn tại hoặc đã lưu trữ.', 409);
            }
            const actualRollCode = rollCode || returnedRoll.roll_code;
            const actualBarcode = barcode || null;
            const returnedDataChanged = returnValuesChanged
                || targetStockType !== (returnedRoll.stock_type || 'REMNANT')
                || actualRollCode !== returnedRoll.roll_code
                || actualBarcode !== returnedRoll.barcode;
            if (returnedDataChanged) {
                const [originalReturnTransactions] = await connection.query<InventoryTransactionRow[]>(`SELECT trans_id FROM inventory_transactions
         WHERE roll_id = ? AND transaction_type = 'RETURN_IN'
           AND reference_type = 'CUTTING_ORDER' AND reference_id = ?
         ORDER BY trans_id ASC LIMIT 1 FOR UPDATE`, [oldReturnedRollId, cuttingId]);
                const originalReturn = originalReturnTransactions[0];
                if (!originalReturn) {
                    throw new CuttingRequestError('Không thể điều chỉnh an toàn vì thiếu giao dịch nhập cuộn trả về trong nhật ký tồn kho.', 409);
                }
                const [laterReturnTransactions] = await connection.query<InventoryTransactionRow[]>(`SELECT trans_id FROM inventory_transactions
         WHERE roll_id = ? AND trans_id > ?
           AND (reference_type IS NULL OR reference_type <> 'CUTTING_CORRECTION'
             OR reference_id IS NULL OR reference_id <> ?)
         LIMIT 1 FOR UPDATE`, [oldReturnedRollId, originalReturn.trans_id, cuttingId]);
                if (laterReturnTransactions.length) {
                    throw new CuttingRequestError('Không thể đổi số lượng, phân loại hoặc mã cuộn trả về: cuộn này đã được chuyển, tiêu thụ hoặc điều chỉnh sau khi nhập. Hãy xử lý tồn cuộn riêng trước.', 409);
                }
                if (Number(returnedRoll.quantity_remaining) !== Number(returnedRoll.quantity_initial)) {
                    throw new CuttingRequestError('Không thể điều chỉnh cuộn trả về vì tồn hiện tại khác lượng nhập ban đầu; cuộn có thể đã được sử dụng.', 409);
                }
            }
        }
        else if (oldReturnedQty > 0) {
            throw new CuttingRequestError('Dữ liệu lần cắt không liên kết được cuộn trả về; không thể điều chỉnh an toàn.', 409);
        }
        let nextReturnedRollId = oldReturnedRollId;
        let nextRollCode = rollCode || returnedRoll?.roll_code || '';
        let nextBarcode: string | null = barcode || returnedRoll?.barcode || null;
        if (returnedQty > 0 && !returnedRoll) {
            if (!nextRollCode)
                throw new CuttingRequestError('Vui lòng nhập mã cuộn cho vải trả về.', 400);
            const [duplicates] = await connection.query<RowDataPacket[]>(`SELECT roll_id FROM fabric_rolls
       WHERE roll_code = ? OR (? IS NOT NULL AND barcode = ?)
       LIMIT 1`, [nextRollCode, nextBarcode, nextBarcode]);
            if (duplicates.length)
                throw new CuttingRequestError('Mã cuộn hoặc barcode đã tồn tại trong hệ thống.', 409);
            const createdBarcode = nextBarcode || `BC-RETURN-${randomUUID()}`;
            const [insertedRoll] = await connection.query<ResultSetHeader>(`INSERT INTO fabric_rolls (
        roll_code, lot_code, supplier_name, barcode, fabric_id, color_id, type_id, location_id, unit_id,
        quantity_initial, quantity_remaining, inbound_date, expiry_date, stock_type, status, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE(), ?, ?, ?, ?)`, [
                nextRollCode,
                parent.lot_code,
                parent.supplier_name,
                createdBarcode,
                parent.fabric_id,
                parent.color_id,
                parent.type_id,
                parent.location_id,
                parent.unit_id,
                returnedQty,
                returnedQty,
                parent.expiry_date,
                targetStockType,
                parent.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
                `${isSaving ? 'Vải tiết kiệm' : 'Đầu khúc trả thường'} từ cuộn ${parent.roll_code}`,
            ]);
            nextReturnedRollId = insertedRoll.insertId;
            nextBarcode = createdBarcode;
            await connection.query(`INSERT INTO inventory_transactions
        (roll_id, transaction_type, quantity, to_location_id, reference_type, reference_id, note, transaction_date)
       VALUES (?, 'RETURN_IN', ?, ?, 'CUTTING_ORDER', ?, ?, NOW())`, [nextReturnedRollId, returnedQty, parent.location_id, cuttingId, `Trả về từ lần cắt #${cuttingId} (${targetStockType})`]);
        }
        else if (returnedRoll) {
            const actualRollCode = rollCode || returnedRoll.roll_code;
            const actualBarcode = barcode || null;
            const [duplicates] = await connection.query<RowDataPacket[]>(`SELECT roll_id FROM fabric_rolls
       WHERE roll_id <> ? AND (roll_code = ? OR (? IS NOT NULL AND barcode = ?))
       LIMIT 1`, [returnedRoll.roll_id, actualRollCode, actualBarcode, actualBarcode]);
            if (duplicates.length)
                throw new CuttingRequestError('Mã cuộn hoặc barcode đã tồn tại trong hệ thống.', 409);
            const oldStockType = returnedRoll.stock_type;
            const changedReturnedData = returnValuesChanged
                || oldStockType !== targetStockType
                || actualRollCode !== returnedRoll.roll_code
                || actualBarcode !== returnedRoll.barcode;
            nextRollCode = actualRollCode;
            nextBarcode = actualBarcode;
            if (changedReturnedData) {
                const nextReturnStatus = returnedQty === 0
                    ? 'OUT_OF_STOCK'
                    : returnedRoll.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE';
                await connection.query(`UPDATE fabric_rolls
         SET roll_code = ?, barcode = ?, quantity_initial = ?, quantity_remaining = ?, stock_type = ?, status = ?
         WHERE roll_id = ?`, [actualRollCode, actualBarcode, returnedQty, returnedQty, targetStockType, nextReturnStatus, returnedRoll.roll_id]);
                await connection.query<ResultSetHeader>(`INSERT INTO inventory_transactions
          (roll_id, transaction_type, quantity, from_location_id, to_location_id, reference_type, reference_id, note, transaction_date)
         VALUES (?, 'ADJUSTMENT', ?, ?, ?, 'CUTTING_CORRECTION', ?, ?, NOW())`, [
                    returnedRoll.roll_id,
                    Math.abs(Number((returnedQty - oldReturnedQty).toFixed(3))),
                    returnedRoll.location_id,
                    returnedRoll.location_id,
                    cuttingId,
                    `Điều chỉnh cuộn trả về lần cắt #${cuttingId}: ${oldReturnedQty}m/${oldStockType || 'REMNANT'} -> ${returnedQty}m/${targetStockType}; mã ${returnedRoll.roll_code} -> ${actualRollCode}`,
                ]);
            }
        }
        const effectiveReturnedQty = returnedQty;
        const usedQty = Number((issuedQty - effectiveReturnedQty).toFixed(3));
        const completedAt = cut.return_completed_at || (effectiveReturnedQty > 0 ? new Date() : null);
        const newChildRollId = nextReturnedRollId && !isSaving ? nextReturnedRollId : null;
        const newSavingRollId = nextReturnedRollId && isSaving ? nextReturnedRollId : null;
        await connection.query(`UPDATE cutting_orders
     SET cut_quantity = ?, used_quantity = ?, returned_quantity = ?, saving_quantity = ?,
         remaining_quantity = ?, note = ?, return_completed_at = ?,
         child_roll_id = ?, saving_roll_id = ?
     WHERE cutting_id = ?`, [
            issuedQty,
            usedQty,
            effectiveReturnedQty,
            isSaving ? effectiveReturnedQty : 0,
            parentQtyChanged ? nextParentQty : cut.remaining_quantity,
            note || null,
            completedAt,
            newChildRollId,
            newSavingRollId,
            cuttingId,
        ]);
        await connection.commit();
        transactionStarted = false;
        return NextResponse.json({
            success: true,
            message: `Đã cập nhật lần cắt #${cuttingId}. Mọi thay đổi tồn kho đã được ghi thành giao dịch điều chỉnh.`,
            data: { cutting_id: cuttingId, used_quantity: usedQty, returned_quantity: effectiveReturnedQty, returned_roll_code: nextRollCode || null },
        });
    }
    catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            }
            catch (rollbackError) {
                console.error('Không thể hoàn tác điều chỉnh lịch sử cắt:', rollbackError);
            }
        }
        if (error instanceof CuttingRequestError) {
            return NextResponse.json({ success: false, error: error.message }, { status: error.status });
        }
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({ success: false, error: 'Mã cuộn hoặc barcode đã tồn tại trong hệ thống.' }, { status: 409 });
        }
        console.error('Không thể điều chỉnh lịch sử cắt:', error);
        return NextResponse.json({ success: false, error: 'Không thể điều chỉnh lịch sử cắt. Vui lòng thử lại.' }, { status: 500 });
    }
    finally {
        connection?.release();
    }
}
