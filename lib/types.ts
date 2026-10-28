export interface FabricRoll {
  roll_id: number;
  roll_code: string;
  barcode: string | null;
  fabric_id: number;
  fabric_name?: string;
  color_id: number | null;
  color_name?: string | null;
  type_id: number | null;
  type_name?: string | null;
  location_id: number | null;
  location_code?: string | null;
  location_name?: string | null;
  unit_id: number | null;
  unit_name?: string | null;
  quantity_initial: number | string;
  quantity_remaining: number | string;
  inbound_date: string | null;
  expiry_date?: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'OUT_OF_STOCK';
  is_archived?: number;
  stock_type?: string | null;
  lot_code?: string | null;
  supplier_name?: string | null;
  note?: string;
}

export interface MasterItem {
  id: number;
  name: string;
  code?: string;
}