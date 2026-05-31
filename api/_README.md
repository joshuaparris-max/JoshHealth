Serverless API notes

This `api/` folder contains Vercel-style serverless functions used for OAuth flows and ingest endpoints.

How to use
1. Deploy to Vercel or another platform that supports Node serverless functions.
2. Add required environment variables in your deployment settings (not in the repo):
   - `BASE_URL` — e.g. https://your-app.vercel.app
   - `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`
   - `WITHINGS_CLIENT_ID`, `WITHINGS_CLIENT_SECRET`
3. Implement persistent token storage (Postgres, Vercel Postgres, or other). Right now the callback endpoints return tokens in the response as a convenience for testing; update callbacks to persist tokens securely.

Security
- Do not log or commit secrets. Use the platform secret store.
- Protect `api/healthconnect/ingest` with a shared secret or client-auth method before accepting production traffic.
