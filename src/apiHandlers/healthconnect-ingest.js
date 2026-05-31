export default async function handler(req, res) {
  // Endpoint for Android companion apps to POST daily summaries
  // Expected JSON shape: { date: 'YYYY-MM-DD', summary: {...}, source: 'health_connect' }
  try {
    const payload = req.body
    console.log('Health Connect ingest received', payload?.date)
    // TODO: validate, authenticate, and persist to DB. For now enqueue to an audit log.
    res.status(200).json({ message: 'Received', received: payload })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
