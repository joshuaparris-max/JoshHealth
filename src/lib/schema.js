/**
 * Normalised Health Schema for HealthLens
 * This defines the target structure for all importers.
 */

export const HEALTH_SCHEMA = {
  health_sources: [
    'id', 'name', 'type', 'priority', 'notes'
  ],
  health_imports: [
    'id', 'source_id', 'file_name', 'file_hash', 'imported_at', 'date_range_start', 'date_range_end', 'status', 'record_count', 'warnings_json'
  ],
  daily_health_summary: [
    'date', 'timezone', 'steps', 'distance_m', 'active_minutes', 'active_zone_minutes', 'calories_total', 'resting_hr', 'hrv_rmssd', 'respiratory_rate', 'weight_kg', 'body_fat_percent', 'sleep_minutes', 'sleep_efficiency', 'source_confidence', 'sources_json'
  ],
  sleep_sessions: [
    'start_time', 'end_time', 'timezone', 'duration_minutes', 'asleep_minutes', 'awake_minutes', 'efficiency', 'sleep_score', 'deep_minutes', 'rem_minutes', 'light_minutes', 'bed_presence_minutes', 'avg_sleep_hr', 'avg_respiratory_rate', 'snoring_seconds', 'ahi', 'source_id', 'import_id', 'raw_json'
  ],
  heart_metrics: [
    'timestamp_or_date', 'metric_type', 'value', 'unit', 'source_id', 'import_id', 'raw_json'
  ],
  body_measurements: [
    'timestamp_or_date', 'metric_type', 'value', 'unit', 'source_id', 'import_id', 'raw_json'
  ],
  exercise_sessions: [
    'start_time', 'end_time', 'activity_type', 'duration_minutes', 'distance_m', 'calories', 'steps', 'avg_hr', 'max_hr', 'active_zone_minutes', 'source_id', 'import_id', 'raw_json'
  ],
  lab_results: [
    'collection_date', 'report_date', 'panel', 'test_name', 'value', 'unit', 'reference_low', 'reference_high', 'flag', 'lab_name', 'doctor', 'source_file', 'source_id', 'import_id', 'raw_text'
  ],
  daily_context_tags: [
    'date', 'energy', 'stress', 'mood', 'sleep_quality', 'caffeine_amount', 'caffeine_latest_time', 'screen_minutes_after_9pm', 'relational_load', 'symptoms', 'strength_training_done', 'notes'
  ]
};

// Source priority rules (Phase 4)
export const SOURCE_PRIORITY = {
  steps: ['fitbit', 'health_connect', 'withings', 'strava'],
  sleep: ['fitbit', 'withings', 'sleep_as_android'],
  hrv: ['welltory', 'fitbit', 'withings'],
  weight: ['withings', 'health_connect'],
  labs: ['pathology_pdf']
};
