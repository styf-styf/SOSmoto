alter table service_reports
  add column entry_date timestamptz,
  add column exit_date timestamptz,
  add column vehicle_plate text;
