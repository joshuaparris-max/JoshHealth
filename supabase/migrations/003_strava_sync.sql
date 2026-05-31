-- Strava exercise-source connector

CREATE TABLE IF NOT EXISTS strava_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  strava_activity_id text UNIQUE NOT NULL,
  name text,
  sport_type text,
  type text,
  start_date timestamptz,
  start_date_local timestamptz,
  timezone text,
  distance_m numeric,
  moving_time_seconds integer,
  elapsed_time_seconds integer,
  total_elevation_gain numeric,
  average_speed numeric,
  max_speed numeric,
  average_heartrate numeric,
  max_heartrate numeric,
  calories numeric,
  suffer_score numeric,
  private boolean,
  trainer boolean,
  commute boolean,
  gear_id text,
  raw_json jsonb,
  synced_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strava_activities_user_start ON strava_activities (user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_strava_activities_sport_type ON strava_activities (sport_type);

CREATE TABLE IF NOT EXISTS strava_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type text,
  object_id text,
  aspect_type text,
  owner_id text,
  subscription_id text,
  event_time timestamptz,
  updates_json jsonb,
  processed boolean DEFAULT false,
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strava_webhook_events_processed ON strava_webhook_events (processed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strava_webhook_events_object ON strava_webhook_events (object_type, object_id);

ALTER TABLE exercise_sessions
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE heart_metrics
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source_name text;

CREATE UNIQUE INDEX IF NOT EXISTS unique_exercise_external_id ON exercise_sessions (external_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_heart_metric_external_id ON heart_metrics (external_id);
