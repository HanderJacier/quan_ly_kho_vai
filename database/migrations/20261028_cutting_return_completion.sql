ALTER TABLE cutting_orders
  ADD COLUMN return_completed_at DATETIME NULL AFTER saving_quantity;

UPDATE cutting_orders
SET used_quantity = GREATEST(cut_quantity - returned_quantity, 0)
WHERE used_quantity = 0 AND cut_quantity > 0;

UPDATE cutting_orders
SET return_completed_at = CURRENT_TIMESTAMP
WHERE return_completed_at IS NULL;
