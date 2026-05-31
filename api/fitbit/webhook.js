export default async function handler(req, res) {
  // Fitbit will send subscription updates to this endpoint. Validate and process as needed.
  // For now this is a placeholder that accepts POST notifications and returns 204.
  if (req.method === 'GET') {
    // Fitbit may call GET to verify subscription in some cases
    res.status(200).send('ok')
    return
  }
  // TODO: verify signature and handle notification payload to enqueue sync tasks
  console.log('Fitbit webhook payload:', req.body)
  res.status(204).end()
}
