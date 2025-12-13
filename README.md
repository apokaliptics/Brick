Brick
=====

Environment Variables
---------------------

- Create a local environment file by copying and editing `.env.local.example`:

	1. `cp .env.local.example .env.local`
	2. Fill in: `VITE_GOOGLE_CLIENT_ID` and `VITE_ONEDRIVE_CLIENT_ID` with your OAuth client IDs.

- Where to get them:
	- Google OAuth Client ID: Register an OAuth 2.0 client ID at the Google Cloud Console (APIs & Services → Credentials → Create Credentials → OAuth client ID). Add `http://localhost:5173` (Vite dev) and your deployed redirect as authorized redirect URI(s).
	- OneDrive (Microsoft) Client ID: Register an app in Azure Portal (Azure Active Directory → App registrations → New registration). Configure redirect URI(s) and generate the client ID.

- For CI: set `VITE_GOOGLE_CLIENT_ID` and `VITE_ONEDRIVE_CLIENT_ID` as environment variables in your build pipeline if you want the cloud services enabled during builds.

Tauri (Desktop) OAuth
---------------------

- The desktop app uses a deep link redirect scheme `brick://oauth-callback` for OAuth flows.
- Ensure `src-tauri/tauri.conf.json` contains a protocol registration for `brick` and the `bundle.identifier` is set for the app.
- When registering OAuth client IDs in Google or Microsoft portals, use `brick://oauth-callback` as the redirect URI for desktop builds.

Security
--------

- Do not commit `.env.local` with real credentials. Use `.env.local.example` for reference only.

