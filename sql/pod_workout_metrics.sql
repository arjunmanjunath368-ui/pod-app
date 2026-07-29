-- Duration and calories for synced Apple Health workouts. Nullable — manual
-- logs never set these (Pod's manual logging has never captured effort
-- metrics, by design), and calories specifically only appears when the
-- person has "Include Workout Metrics" turned on in Health Auto Export.
-- Units are stored alongside the value rather than normalized, since a
-- person's iOS unit preference (kcal vs kJ) determines what Health Auto
-- Export actually sends — safer to show it as given than silently convert.

alter table sessions add column if not exists duration_seconds integer;
alter table sessions add column if not exists calories numeric;
alter table sessions add column if not exists calories_units text;
