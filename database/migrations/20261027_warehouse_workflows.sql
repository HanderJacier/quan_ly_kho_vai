ALTER TABLE fabric_rolls
  ADD COLUMN IF NOT EXISTS lot_code VARCHAR(100) NULL AFTER roll_code,
  ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(160) NULL AFTER barcode;

CREATE INDEX idx_fabric_rolls_status_inbound
  ON fabric_rolls (is_archived, status, inbound_date, roll_id);

CREATE INDEX idx_fabric_rolls_expiry
  ON fabric_rolls (expiry_date, is_archived, roll_id);

CREATE INDEX idx_inventory_transactions_date
  ON inventory_transactions (transaction_date, trans_id);

CREATE INDEX idx_inventory_transactions_type_date
  ON inventory_transactions (transaction_type, transaction_date, trans_id);

ALTER TABLE cutting_orders
  ADD COLUMN used_quantity DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER cut_quantity,
  ADD COLUMN returned_quantity DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER used_quantity,
  ADD COLUMN saving_quantity DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER returned_quantity,
  ADD COLUMN saving_roll_id BIGINT UNSIGNED NULL AFTER child_roll_id,
  ADD UNIQUE KEY uq_cutting_saving_roll (saving_roll_id),
  ADD CONSTRAINT fk_cutting_saving_roll
    FOREIGN KEY (saving_roll_id) REFERENCES fabric_rolls(roll_id);

UPDATE cutting_orders
SET used_quantity = GREATEST(cut_quantity - returned_quantity, 0)
WHERE used_quantity = 0 AND cut_quantity > 0;

CREATE TABLE warehouse_issue_orders (
  order_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_code VARCHAR(40) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note VARCHAR(1000) NULL,
  PRIMARY KEY (order_id),
  UNIQUE KEY uq_warehouse_issue_orders_code (order_code),
  KEY idx_warehouse_issue_orders_customer_date (customer_id, order_date, order_id),
  CONSTRAINT fk_warehouse_issue_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE warehouse_issue_order_items (
  item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  roll_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  stock_account VARCHAR(20) NOT NULL DEFAULT 'REGULAR',
  PRIMARY KEY (item_id),
  KEY idx_warehouse_issue_order_items_order (order_id, item_id),
  KEY idx_warehouse_issue_order_items_roll (roll_id),
  CONSTRAINT fk_warehouse_issue_order_items_order
    FOREIGN KEY (order_id) REFERENCES warehouse_issue_orders(order_id),
  CONSTRAINT fk_warehouse_issue_order_items_roll
    FOREIGN KEY (roll_id) REFERENCES fabric_rolls(roll_id)
);
