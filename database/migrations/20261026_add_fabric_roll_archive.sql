ALTER TABLE fabric_rolls
  ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER status;
