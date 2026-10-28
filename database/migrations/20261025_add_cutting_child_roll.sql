ALTER TABLE cutting_orders
  ADD COLUMN child_roll_id BIGINT UNSIGNED NULL AFTER roll_id;

ALTER TABLE cutting_orders
  ADD UNIQUE KEY uq_cutting_child_roll (child_roll_id);

ALTER TABLE cutting_orders
  ADD CONSTRAINT fk_cutting_child_roll
    FOREIGN KEY (child_roll_id) REFERENCES fabric_rolls(roll_id);
