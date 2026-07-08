(function(root) {
  'use strict'

  var TABLES = {
    hrSeries: 'heart_rate_record_series_table',
    hrRecord: 'heart_rate_record_table',
    hrv: 'heart_rate_variability_rmssd_record_table',
    respiratory: 'respiratory_rate_record_table',
    sleepSession: 'sleep_session_record_table',
    sleepStage: 'sleep_stage_record_table',
    steps: 'steps_record_table',
    calories: 'total_calories_burned_record_table',
    weight: 'weight_record_table',
    bodyFat: 'body_fat_record_table',
    exercise: 'exercise_session_record_table',
  }

  function quoteIdent(name) {
    return '"' + String(name).replace(/"/g, '""') + '"'
  }

  function round(value, digits) {
    if (value == null || !Number.isFinite(Number(value))) return null
    var factor = Math.pow(10, digits == null ? 1 : digits)
    return Math.round(Number(value) * factor) / factor
  }

  function dayKey(ms, timeZone) {
    if (!Number.isFinite(ms)) return null
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms))
  }

  function monthKey(day) {
    return day ? day.slice(0, 7) : null
  }

  function weekKey(day) {
    if (!day) return null
    var d = new Date(day + 'T00:00:00Z')
    var utcDay = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - utcDay)
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    var week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
    return d.getUTCFullYear() + '-W' + String(week).padStart(2, '0')
  }

  function toMillis(value) {
    if (value == null || value === '') return null
    var n = Number(value)
    if (Number.isFinite(n)) {
      if (n > 100000000000000000) return n / 1000000
      if (n > 100000000000000) return n / 1000
      if (n > 100000000000) return n
      if (n > 1000000000) return n * 1000
    }
    var parsed = Date.parse(String(value))
    return Number.isFinite(parsed) ? parsed : null
  }

  function tableExists(tables, table) {
    return tables.indexOf(table) !== -1
  }

  function getColumns(db, table) {
    try {
      var res = db.exec('PRAGMA table_info(' + quoteIdent(table) + ')')
      return res[0] ? res[0].values.map(function(row) { return row[1] }) : []
    } catch (e) {
      return []
    }
  }

  function hasColumns(db, table, columns) {
    var present = getColumns(db, table)
    return columns.every(function(col) { return present.indexOf(col) !== -1 })
  }

  function pickColumn(columns, candidates) {
    for (var i = 0; i < candidates.length; i++) {
      if (columns.indexOf(candidates[i]) !== -1) return candidates[i]
    }
    return null
  }

  function selectRows(db, table, columns, where, limit) {
    var sql = 'SELECT ' + columns.map(quoteIdent).join(', ') + ' FROM ' + quoteIdent(table)
    if (where) sql += ' WHERE ' + where
    if (limit) sql += ' LIMIT ' + Number(limit)
    var res = db.exec(sql)
    if (!res[0]) return []
    return res[0].values.map(function(values) {
      var row = {}
      columns.forEach(function(col, i) { row[col] = values[i] })
      return row
    })
  }

  function summarizeSeries(items, valueKey) {
    var vals = items.map(function(item) { return Number(item[valueKey]) }).filter(Number.isFinite)
    if (!vals.length) return null
    vals.sort(function(a, b) { return a - b })
    return { count: vals.length, min: round(vals[0], 1), avg: round(vals.reduce(function(s, v) { return s + v }, 0) / vals.length, 1), max: round(vals[vals.length - 1], 1) }
  }

  function trendBuckets(daily, keyer, valueKey, limit) {
    var grouped = {}
    daily.forEach(function(row) {
      var key = keyer(row.day)
      if (!key || row[valueKey] == null) return
      grouped[key] = grouped[key] || []
      grouped[key].push(row)
    })
    return Object.keys(grouped).sort().slice(-(limit || 12)).map(function(key) {
      var vals = grouped[key].map(function(row) { return Number(row[valueKey]) }).filter(Number.isFinite)
      return { period: key, days: vals.length, avg: vals.length ? round(vals.reduce(function(s, v) { return s + v }, 0) / vals.length, 1) : null }
    })
  }

  function latestDrift(daily, valueKey) {
    var values = daily.filter(function(row) { return row[valueKey] != null }).slice(-60)
    if (values.length < 14) return null
    var midpoint = Math.floor(values.length / 2)
    var early = values.slice(0, midpoint)
    var late = values.slice(midpoint)
    function avg(rows) {
      return rows.reduce(function(sum, row) { return sum + Number(row[valueKey]) }, 0) / rows.length
    }
    var earlyAvg = avg(early)
    var lateAvg = avg(late)
    return {
      window_days: values.length,
      early_avg: round(earlyAvg, 1),
      recent_avg: round(lateAvg, 1),
      change: round(lateAvg - earlyAvg, 1),
    }
  }

  function analyzeHeartRate(db, tables, timeZone, exerciseSessions) {
    if (!tableExists(tables, TABLES.hrSeries) || !hasColumns(db, TABLES.hrSeries, ['beats_per_minute', 'epoch_millis'])) return null
    var rows = selectRows(db, TABLES.hrSeries, ['parent_key', 'beats_per_minute', 'epoch_millis'], 'beats_per_minute IS NOT NULL AND epoch_millis IS NOT NULL', 500000)
      .map(function(row) {
        return { parent_key: row.parent_key, bpm: Number(row.beats_per_minute), ms: toMillis(row.epoch_millis) }
      })
      .filter(function(row) { return Number.isFinite(row.bpm) && Number.isFinite(row.ms) && row.bpm > 20 && row.bpm < 240 })
      .sort(function(a, b) { return a.ms - b.ms })

    var byDay = {}
    rows.forEach(function(row) {
      var day = dayKey(row.ms, timeZone)
      if (!day) return
      byDay[day] = byDay[day] || []
      byDay[day].push(row)
    })
    var daily = Object.keys(byDay).sort().map(function(day) {
      var samples = byDay[day]
      var stats = summarizeSeries(samples, 'bpm')
      var restCandidates = samples.filter(function(s) {
        var h = new Date(s.ms).toLocaleString('en-US', { timeZone: timeZone, hour: 'numeric', hour12: false })
        var hour = Number(h)
        return hour >= 0 && hour <= 7
      }).sort(function(a, b) { return a.bpm - b.bpm })
      var restingEstimate = null
      if (restCandidates.length >= 5) {
        var take = Math.max(5, Math.ceil(restCandidates.length * 0.1))
        restingEstimate = round(restCandidates.slice(0, take).reduce(function(sum, s) { return sum + s.bpm }, 0) / take, 1)
      }
      return { day: day, samples: samples.length, min: stats.min, avg: stats.avg, max: stats.max, resting_hr_estimate: restingEstimate }
    })

    var zones = { under_60: 0, '60_79': 0, '80_99': 0, '100_119': 0, '120_139': 0, over_140: 0 }
    rows.forEach(function(r) {
      if (r.bpm < 60) zones.under_60 += 1
      else if (r.bpm < 80) zones['60_79'] += 1
      else if (r.bpm < 100) zones['80_99'] += 1
      else if (r.bpm < 120) zones['100_119'] += 1
      else if (r.bpm < 140) zones['120_139'] += 1
      else zones.over_140 += 1
    })

    var episodes = findElevatedEpisodes(rows, exerciseSessions, timeZone)
    return {
      sample_table: TABLES.hrSeries,
      sample_columns: ['parent_key', 'beats_per_minute', 'epoch_millis'],
      samples: rows.length,
      days: daily.length,
      daily_full_history: daily.slice(-120),
      daily_history_days_total: daily.length,
      last_30_days: daily.slice(-30),
      weekly_avg_hr: trendBuckets(daily, weekKey, 'avg', 16),
      monthly_avg_hr: trendBuckets(daily, monthKey, 'avg', 12),
      resting_hr_estimate_weekly: trendBuckets(daily.filter(function(d) { return d.resting_hr_estimate != null }), weekKey, 'resting_hr_estimate', 16),
      distribution: zones,
      elevated_episodes: episodes,
    }
  }

  function overlapsExercise(start, end, sessions) {
    return sessions.some(function(s) { return start < s.end_ms && end > s.start_ms })
  }

  function findElevatedEpisodes(rows, exerciseSessions, timeZone) {
    var threshold = 110
    var minDuration = 10 * 60 * 1000
    var maxGap = 3 * 60 * 1000
    var runs = []
    var run = []
    rows.forEach(function(row) {
      if (row.bpm >= threshold) {
        if (!run.length || row.ms - run[run.length - 1].ms <= maxGap) run.push(row)
        else {
          runs.push(run)
          run = [row]
        }
      } else if (run.length) {
        runs.push(run)
        run = []
      }
    })
    if (run.length) runs.push(run)
    return runs.map(function(items) {
      var start = items[0].ms
      var end = items[items.length - 1].ms
      var stats = summarizeSeries(items, 'bpm')
      var exercise = overlapsExercise(start, end, exerciseSessions)
      return {
        start: new Date(start).toISOString(),
        local_day: dayKey(start, timeZone),
        end: new Date(end).toISOString(),
        duration_min: round((end - start) / 60000, 1),
        avg_bpm: stats.avg,
        max_bpm: stats.max,
        overlaps_exercise: exercise,
        classification: exercise ? 'likely_exercise_related' : 'possibly_non_exercise_related',
      }
    }).filter(function(ep) {
      return ep.duration_min >= minDuration / 60000
    }).sort(function(a, b) {
      return (b.duration_min * b.max_bpm) - (a.duration_min * a.max_bpm)
    }).slice(0, 12)
  }

  function analyzeSimpleRecord(db, tables, table, valueColumn, timeColumn, timeZone, label, ignoreZero) {
    if (!tableExists(tables, table)) return null
    var cols = getColumns(db, table)
    var pickedValue = pickColumn(cols, Array.isArray(valueColumn) ? valueColumn : [valueColumn])
    var pickedTime = pickColumn(cols, Array.isArray(timeColumn) ? timeColumn : [timeColumn])
    if (!pickedValue || !pickedTime) return null
    var rows = selectRows(db, table, [pickedValue, pickedTime], quoteIdent(pickedValue) + ' IS NOT NULL AND ' + quoteIdent(pickedTime) + ' IS NOT NULL', 200000)
      .map(function(row) { return { value: Number(row[pickedValue]), ms: toMillis(row[pickedTime]) } })
      .filter(function(row) { return Number.isFinite(row.value) && Number.isFinite(row.ms) && (!ignoreZero || row.value !== 0) })
    var grouped = {}
    rows.forEach(function(row) {
      var day = dayKey(row.ms, timeZone)
      grouped[day] = grouped[day] || []
      grouped[day].push({ value: row.value })
    })
    var daily = Object.keys(grouped).sort().map(function(day) {
      var stats = summarizeSeries(grouped[day], 'value')
      return { day: day, avg: stats.avg, min: stats.min, max: stats.max, samples: stats.count }
    })
    return {
      label: label,
      table: table,
      value_column: pickedValue,
      time_column: pickedTime,
      rows: rows.length,
      daily: daily.slice(-30),
      weekly: trendBuckets(daily, weekKey, 'avg', 16),
      monthly: trendBuckets(daily, monthKey, 'avg', 12),
      drift: latestDrift(daily, 'avg'),
    }
  }

  function analyzeExercise(db, tables) {
    if (!tableExists(tables, TABLES.exercise)) return []
    var cols = getColumns(db, TABLES.exercise)
    var startCol = cols.indexOf('start_time_epoch_millis') !== -1 ? 'start_time_epoch_millis' : 'start_time'
    var endCol = cols.indexOf('end_time_epoch_millis') !== -1 ? 'end_time_epoch_millis' : 'end_time'
    if (cols.indexOf(startCol) === -1 || cols.indexOf(endCol) === -1) return []
    return selectRows(db, TABLES.exercise, [startCol, endCol], null, 100000).map(function(row) {
      return { start_ms: toMillis(row[startCol]), end_ms: toMillis(row[endCol]) }
    }).filter(function(row) { return Number.isFinite(row.start_ms) && Number.isFinite(row.end_ms) && row.end_ms > row.start_ms })
  }

  function analyzeSleep(db, tables, timeZone) {
    if (!tableExists(tables, TABLES.sleepSession)) return null
    var cols = getColumns(db, TABLES.sleepSession)
    var startCol = cols.indexOf('start_time_epoch_millis') !== -1 ? 'start_time_epoch_millis' : 'start_time'
    var endCol = cols.indexOf('end_time_epoch_millis') !== -1 ? 'end_time_epoch_millis' : 'end_time'
    if (cols.indexOf(startCol) === -1 || cols.indexOf(endCol) === -1) return null
    var sessions = selectRows(db, TABLES.sleepSession, [startCol, endCol], null, 100000).map(function(row) {
      var start = toMillis(row[startCol])
      var end = toMillis(row[endCol])
      var night = dayKey((start || 0) - 12 * 3600000, timeZone)
      return { start_ms: start, end_ms: end, night: night, duration_min: round((end - start) / 60000, 1) }
    }).filter(function(s) { return Number.isFinite(s.start_ms) && Number.isFinite(s.end_ms) && s.end_ms > s.start_ms && s.duration_min <= 18 * 60 })
    var byNight = {}
    sessions.forEach(function(s) {
      if (!byNight[s.night] || s.duration_min > byNight[s.night].duration_min) byNight[s.night] = s
    })
    var stageByNight = analyzeSleepStages(db, tables, timeZone)
    var nightly = Object.keys(byNight).sort().map(function(night) {
      var s = byNight[night]
      return Object.assign({ night: night, start: new Date(s.start_ms).toISOString(), end: new Date(s.end_ms).toISOString(), asleep_min: s.duration_min }, stageByNight[night] || {})
    })
    return {
      sessions: sessions.length,
      dedupe_method: 'primary longest non-overlapping sleep session per local night; impossible >18h sessions ignored',
      nights: nightly.length,
      nightly: nightly.slice(-30),
      weekly: trendBuckets(nightly.map(function(n) { return { day: n.night, avg: n.asleep_min } }), weekKey, 'avg', 16),
      monthly: trendBuckets(nightly.map(function(n) { return { day: n.night, avg: n.asleep_min } }), monthKey, 'avg', 12),
    }
  }

  function analyzeSleepStages(db, tables, timeZone) {
    if (!tableExists(tables, TABLES.sleepStage)) return {}
    var cols = getColumns(db, TABLES.sleepStage)
    var startCol = pickColumn(cols, ['start_time_epoch_millis', 'start_time', 'epoch_millis'])
    var endCol = pickColumn(cols, ['end_time_epoch_millis', 'end_time'])
    var stageCol = pickColumn(cols, ['stage_type', 'stage', 'type'])
    if (!startCol || !endCol || !stageCol) return {}
    var rows = selectRows(db, TABLES.sleepStage, [startCol, endCol, stageCol], null, 200000)
    var byNight = {}
    rows.forEach(function(row) {
      var start = toMillis(row[startCol])
      var end = toMillis(row[endCol])
      var mins = (end - start) / 60000
      if (!Number.isFinite(start) || !Number.isFinite(end) || mins <= 0 || mins > 24 * 60) return
      var night = dayKey(start - 12 * 3600000, timeZone)
      byNight[night] = byNight[night] || { awake_min: 0, rem_min: 0, light_min: 0, deep_min: 0, unknown_stage_min: 0 }
      var stage = String(row[stageCol]).toLowerCase()
      if (stage.indexOf('awake') !== -1 || stage === '1') byNight[night].awake_min += mins
      else if (stage.indexOf('rem') !== -1 || stage === '5') byNight[night].rem_min += mins
      else if (stage.indexOf('light') !== -1 || stage === '4') byNight[night].light_min += mins
      else if (stage.indexOf('deep') !== -1 || stage === '3') byNight[night].deep_min += mins
      else byNight[night].unknown_stage_min += mins
    })
    Object.keys(byNight).forEach(function(night) {
      Object.keys(byNight[night]).forEach(function(key) { byNight[night][key] = round(byNight[night][key], 1) })
    })
    return byNight
  }

  function analyzeTotalsByDay(db, tables, table, valueColumn, startColumn, timeZone, label) {
    if (!tableExists(tables, table)) return null
    var cols = getColumns(db, table)
    var pickedValue = pickColumn(cols, Array.isArray(valueColumn) ? valueColumn : [valueColumn])
    var pickedStart = pickColumn(cols, Array.isArray(startColumn) ? startColumn : [startColumn])
    if (!pickedValue || !pickedStart) return null
    var rows = selectRows(db, table, [pickedValue, pickedStart], quoteIdent(pickedValue) + ' IS NOT NULL', 200000)
    var byDay = {}
    rows.forEach(function(row) {
      var day = dayKey(toMillis(row[pickedStart]), timeZone)
      var value = Number(row[pickedValue])
      if (!day || !Number.isFinite(value)) return
      byDay[day] = Math.max(byDay[day] || 0, value)
    })
    var daily = Object.keys(byDay).sort().map(function(day) { return { day: day, value: round(byDay[day], 1) } })
    return {
      label: label,
      table: table,
      value_column: pickedValue,
      time_column: pickedStart,
      dedupe_method: 'max per local day from Health Connect table to reduce duplicate source totals',
      daily: daily.slice(-30),
      weekly: trendBuckets(daily.map(function(d) { return { day: d.day, avg: d.value } }), weekKey, 'avg', 16),
      monthly: trendBuckets(daily.map(function(d) { return { day: d.day, avg: d.value } }), monthKey, 'avg', 12),
    }
  }

  function renderText(analysis) {
    var lines = ['=== Health Connect Deep Analysis ===']
    lines.push('Detected Health Connect tables: ' + analysis.detected_tables.join(', '))
    if (analysis.heart_rate) {
      lines.push('Heart rate samples: ' + analysis.heart_rate.samples.toLocaleString() + ' across ' + analysis.heart_rate.days + ' local days.')
      lines.push('Resting HR is reported as a night/low-percentile estimate, not daily average HR.')
      if (analysis.heart_rate.elevated_episodes.length) lines.push('Relevant sustained elevated HR episodes: ' + analysis.heart_rate.elevated_episodes.length + ' listed in JSON.')
    }
    if (analysis.sleep) lines.push('Sleep nights after overlap dedupe: ' + analysis.sleep.nights + ' (' + analysis.sleep.dedupe_method + ').')
    if (analysis.steps) lines.push('Steps use a duplicate-resistant daily estimate: ' + analysis.steps.dedupe_method + '.')
    if (analysis.body_fat) lines.push('Body fat zero placeholders ignored before trend analysis.')
    lines.push('')
    lines.push('HEALTH_CONNECT_DEEP_ANALYSIS_JSON_START')
    lines.push(JSON.stringify(analysis))
    lines.push('HEALTH_CONNECT_DEEP_ANALYSIS_JSON_END')
    return lines.join('\n')
  }

  function analyze(db, options) {
    options = options || {}
    var tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
    var tables = tablesResult[0] ? tablesResult[0].values.map(function(row) { return row[0] }) : []
    var detected = Object.keys(TABLES).map(function(k) { return TABLES[k] }).filter(function(t) { return tableExists(tables, t) })
    if (!detected.length) return null
    var timeZone = options.timeZone || 'Australia/Sydney'
    var exercises = analyzeExercise(db, tables)
    var analysis = {
      schema: 'health-connect-deep-analysis/v1',
      time_zone: timeZone,
      detected_tables: detected,
      exercise_sessions: { count: exercises.length },
      heart_rate: analyzeHeartRate(db, tables, timeZone, exercises),
      hrv_rmssd: analyzeSimpleRecord(db, tables, TABLES.hrv, ['heart_rate_variability_millis', 'rmssd_millis', 'rmssd', 'value'], ['time_epoch_millis', 'time', 'start_time_epoch_millis'], timeZone, 'HRV RMSSD', false),
      respiratory_rate: analyzeSimpleRecord(db, tables, TABLES.respiratory, ['rate', 'breaths_per_minute', 'respiratory_rate', 'value'], ['time_epoch_millis', 'time', 'start_time_epoch_millis'], timeZone, 'Respiratory rate', false),
      sleep: analyzeSleep(db, tables, timeZone),
      steps: analyzeTotalsByDay(db, tables, TABLES.steps, ['count', 'steps', 'value'], ['start_time_epoch_millis', 'start_time', 'time_epoch_millis'], timeZone, 'Steps'),
      calories: analyzeTotalsByDay(db, tables, TABLES.calories, ['energy_kcal', 'energy', 'calories', 'value'], ['start_time_epoch_millis', 'start_time', 'time_epoch_millis'], timeZone, 'Calories burned'),
      weight: analyzeSimpleRecord(db, tables, TABLES.weight, ['weight_grams', 'weight', 'mass_grams', 'value'], ['time_epoch_millis', 'time'], timeZone, 'Weight grams', false),
      body_fat: analyzeSimpleRecord(db, tables, TABLES.bodyFat, ['percentage', 'percent', 'body_fat_percentage', 'value'], ['time_epoch_millis', 'time'], timeZone, 'Body fat percent', true),
      warnings: [
        'Resting HR is estimated from low overnight samples where available; it is not a clinical resting-HR measurement.',
        'Steps/calories use duplicate-resistant daily estimates because Health Connect may contain overlapping app sources.',
      ],
    }
    analysis.text = renderText(analysis)
    return analysis
  }

  root.HealthConnectAnalyzer = { analyze: analyze, renderText: renderText, _private: { dayKey: dayKey } }
})(typeof self !== 'undefined' ? self : globalThis)
