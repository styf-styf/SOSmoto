alter table vehicles add column avg_monthly_km integer;
alter table vehicles add column last_mileage_reminder_at timestamptz;
alter table maintenance_suggestions add column overdue_notified_at timestamptz;
