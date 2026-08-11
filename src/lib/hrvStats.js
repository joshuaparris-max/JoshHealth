import { format, subDays, startOfDay, endOfDay, addDays, isBefore, isAfter, isWithinInterval, differenceInMinutes, parseISO } from 'date-fns'
import { toZonedTime, formatInTimeZone } from 'date-fns-tz'

const SYDNEY_TZ = 'Australia/Sydney'

/**
 * Calculates statistics for an array of numbers.
 */
export function calculateStats(values) {
  if (!values || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  
  const getQuantile = (p) => {
    const pos = (sorted.length - 1) * p
    const base = Math.floor(pos)
    const rest = pos - base
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base])
    } else {
      return sorted[base]
    }
  }

  const q1 = getQuantile(0.25)
  const median = getQuantile(0.5)
  const q3 = getQuantile(0.75)
  const iqr = q3 - q1
  const count = sorted.length
  
  // Calculate Mean & StdDev for deep stats
  const mean = sorted.reduce((a, b) => a + b, 0) / count
  const stdDev = Math.sqrt(sorted.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / count)
  
  return { min, max, q1, median, q3, iqr, mean, stdDev, count }
}

/**
 * Normalizes an array of raw HRV samples to Sydney time.
 */
export function normalizeHRV(samples) {
  return samples.map(s => {
    const date = new Date(s.time)
    const zoned = toZonedTime(date, SYDNEY_TZ)
    return {
      timestamp: date.getTime(),
      dateStr: formatInTimeZone(date, SYDNEY_TZ, 'yyyy-MM-dd'),
      hrv: s.heart_rate_variability_millis
    }
  })
}

/**
 * Groups HRV based on the provided mode: 'overnight' (8pm-8am) or '24h' (midnight-midnight).
 */
export function groupHRVDynamically(normalizedSamples, mode = 'overnight') {
  const byDate = {}
  
  normalizedSamples.forEach(s => {
    const zoned = toZonedTime(new Date(s.timestamp), SYDNEY_TZ)
    const hour = zoned.getHours()
    
    let assignDateStr = null
    
    if (mode === 'overnight') {
      if (hour >= 20) {
        // 8pm-midnight -> belongs to tomorrow's morning
        const tomorrow = addDays(zoned, 1)
        assignDateStr = format(tomorrow, 'yyyy-MM-dd')
      } else if (hour < 8) {
        // midnight-8am -> belongs to today's morning
        assignDateStr = format(zoned, 'yyyy-MM-dd')
      }
    } else {
      // 24h mode -> strict calendar day (midnight to midnight)
      assignDateStr = format(zoned, 'yyyy-MM-dd')
    }
    
    if (assignDateStr) {
      if (!byDate[assignDateStr]) byDate[assignDateStr] = []
      byDate[assignDateStr].push(s.hrv)
    }
  })
  
  const results = {}
  Object.keys(byDate).forEach(date => {
    const stats = calculateStats(byDate[date])
    if (stats) results[date] = stats
  })
  
  return results
}

/**
 * Backwards compatibility wrapper
 */
export function groupOvernightHRV(normalizedSamples) {
  return groupHRVDynamically(normalizedSamples, 'overnight')
}

/**
 * Calculates a 7-day rolling baseline (median of past 7 days) and current deviation.
 */
export function calculateRollingBaselines(statsMap) {
  const dates = Object.keys(statsMap).sort()
  const results = {}
  
  for (let i = 0; i < dates.length; i++) {
    const currentDate = dates[i]
    const currentMedian = statsMap[currentDate].median
    
    // Look back up to 7 calendar days
    const past7 = []
    const currentMs = parseISO(currentDate).getTime()
    
    for (let j = 0; j < i; j++) {
      const prevMs = parseISO(dates[j]).getTime()
      const diffDays = Math.round((currentMs - prevMs) / (1000 * 60 * 60 * 24))
      if (diffDays > 0 && diffDays <= 7) {
        past7.push(statsMap[dates[j]].median)
      }
    }
    
    let baseline = null
    let deviation = null
    if (past7.length > 0) {
      baseline = calculateStats(past7).median
      deviation = currentMedian - baseline
    }
    
    results[currentDate] = {
      ...statsMap[currentDate],
      baseline,
      deviation
    }
  }
  
  return results
}
