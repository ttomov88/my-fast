# My Fast

A minimal intermittent fasting timer. Pick a fasting window (16:8, 18:6, 20:4, OMAD or a custom goal), tap Start, and it tracks elapsed time against your goal. Finished fasts go into your history with a green (goal hit) or red (missed) duration.

Live at https://ttomov88.github.io/my-fast/ (installed on Android via Chrome → Add to Home screen).

## Accounts and data

- Each person logs in with email and password. Fasts are stored in their own account and are private: nobody sees anyone else's fasts.
- Accounts are invite-only. The administrator (ttomov88@gmail.com) invites people in **Settings → People**, which gives a one-time invite code. They open the app, tap **I have an invite**, choose a password and type the code. Only invited people can use the app (a My Fleet account alone isn't enough).
- The app sends no emails. A forgotten password is reset by the administrator (Settings → People → Reset password), who passes on the temporary password. Anyone can change their password in Settings.
- A copy is kept on the phone so the app opens instantly and history can be viewed offline. Changes (start/end a fast, edits) need an internet connection.
- On the first login on a phone that used the old phone-only version (Fast Track), its fasts are moved into the account automatically.

## Backups

- The server makes an automatic backup of every account every night and keeps 30 days. Nothing is saved on the phone.
- **Settings → Export** downloads a JSON copy whenever you want one; **Import** adds fasts from a My Fast or Fast Track export (duplicates are skipped).

## Notifications

Sent by the server, so they arrive even when the app is closed (the start reminder follows each phone's time zone):
- **Goal reached** — at the moment the running fast hits its goal (when Notifications is on).
- **Remind me to start** — once a day at the time you choose, only if you're not fasting.

Turning Notifications on asks the phone for permission once. Chrome shows the site address (ttomov88.github.io) on notifications; a web app can't hide that.

## How it's built

- Static PWA on GitHub Pages: `index.html`, `style.css`, `app.js`, `service-worker.js`, `manifest.json`, `supabase.js` (Supabase client library, vendored), `icons/`.
- Backend: Supabase, inside the **my-fleet** project (the free plan allows two projects). My Fast uses its own tables and never touches My Fleet's:
  - `fasts` — finished fasts, one row each
  - `fast_profiles` — running fast, last goal, start-reminder time
  - `fast_push_subscriptions` — phones signed up for notifications
  - `fast_backups` — nightly backups (30 days)
  - `fast_allowed_emails` — invited emails
- Scheduled jobs (pg_cron): `my-fast-tick` every minute finds due reminders and calls the `fast-api` Edge Function only when something is due; `my-fast-daily-backup` at 01:10 UTC.
- Edge Function `fast-api` (source in `supabase/functions/fast-api/`): account creation for invited emails, sending notifications, invites and password resets.
