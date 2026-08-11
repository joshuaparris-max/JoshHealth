export const perfLog = []
let timers = {}

export function startTimer(name) {
  timers[name] = performance.now()
}

export function endTimer(name, details = {}) {
  if (timers[name]) {
    const duration = performance.now() - timers[name]
    const entry = { stage: name, duration, details }
    perfLog.push(entry)
    console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`, details)
    delete timers[name]
    return duration
  }
  return 0
}

export function clearPerfLog() {
  perfLog.length = 0
}
