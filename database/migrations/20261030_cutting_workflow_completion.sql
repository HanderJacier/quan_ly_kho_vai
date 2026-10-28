ALTER TABLE cutting_orders
  ADD COLUMN IF NOT EXISTS used_quantity DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER cut_quantity;

ALTER TABLE cutting_orders
  ADD COLUMN IF NOT EXISTS returned_quantity DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER used_quantity;

ALTER TABLE cutting_orders
  ADD COLUMN IF NOT EXISTS saving_quantity DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER returned_quantity;

ALTER TABLE cutting_orders
  ADD COLUMN IF NOT EXISTS saving_roll_id BIGINT UNSIGNED NULL AFTER child_roll_id;

ALTER TABLE cutting_orders
  ADD COLUMN IF NOT EXISTS return_completed_at DATETIME NULL AFTER saving_quantity;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cutting_saving_roll
  ON cutting_orders (saving_roll_id);

ALTER TABLE cutting_orders
  ADD CONSTRAINT fk_cutting_saving_roll
    FOREIGN KEY (saving_roll_id) REFERENCES fabric_rolls(roll_id);

UPDATE cutting_orders
SET used_quantity = GREATEST(cut_quantity - returned_quantity, 0)
WHERE used_quantity = 0 AND cut_quantity > 0;

UPDATE cutting_orders
SET return_completed_at = CURRENT_TIMESTAMP
WHERE return_completed_at IS NULL;
