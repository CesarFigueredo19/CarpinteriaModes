<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/eafb52e4-1ad7-4ba9-9f7b-d1bbaf16ec9f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Start the FastAPI backend in a terminal from the project root:
   `backend\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8002`
4. Start the storefront in a second terminal from the project root:
   `npm run dev`

The storefront reads `VITE_API_URL` from `.env.local`, which should point to the FastAPI base URL without an `/api` suffix. That is the service that reads and writes Supabase data. The Express server started by `npm run dev` serves local fallback data; it does not connect to Supabase.

To check the backend and its database connection, open `http://localhost:8002/api/health`. A successful response includes `"ok": true`; a `503` means FastAPI is running but could not reach Supabase. Confirm that `backend/.env` contains a valid `DATABASE_URL` for the Supabase PostgreSQL database.
