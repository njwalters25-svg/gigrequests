# Sing Request MVP

A local MVP for a singer's live song-request app.

## What it does

- Permanent audience request page at `/request`
- Singer public URL at `/chellesjukebox`
- Lightweight health check at `/healthz`
- Singer dashboard at `/dashboard`
- Local JSON database in `data/db.json`
- Active gig model: starting a new gig archives the previous active gig
- Open archived gigs and review their saved requests
- Start a new gig from an archived gig, with editable name, venue, date/time, and notes before creating it
- Delete archived gigs and their saved requests
- Request queue statuses: new, queued, singing, done, skipped
- Song availability toggles
- Delete songs from the catalog without breaking old gig request history
- Add one song at a time
- Bulk import songs from pasted CSV rows
- Sort catalog and request list by song title or artist
- Multi-tag songs, such as `Pop`, `60s`, `Wedding`, or `Soul`
- Bulk select visible songs and mark them as favourites or available/unavailable
- Make a searched set of songs the only songs available to the audience
- Configure or hide the audience quick-filter buttons from the dashboard
- Edit the public request page singer name, tagline, main heading, intro text, singer photo, and background image from a collapsed dashboard panel

## Run locally

```sh
npm start
```

Then open:

- Audience page: http://localhost:3000/request
- Singer dashboard: http://localhost:3000/dashboard

## Notes

This version intentionally has no login and uses a JSON file as the database. That makes it easy to try locally. The same app shape can later move to Supabase/Postgres with authentication and a permanent hosted URL for the QR code.

Bulk import format:

```csv
Title,Artist,Tags
Valerie,Amy Winehouse,Soul; Pop; 2000s
Can't Help Falling in Love,Elvis Presley,Classic; 60s; Wedding
```

The app stores genre, decade, and vibe as flexible tags. It does not automatically know a song's genre yet; that could be added later with a music metadata provider or an AI-assisted tagging step.

Audience quick filters are optional. The singer can choose labels such as `Favourites`, `80s`, or `Wedding`, or turn the filter row off entirely. Tags still work in search even when they are not shown as buttons.

To make only a themed group available, search the catalog first, then use `Only visible available`. For example, search `80s`; the matching songs become available and every non-matching song becomes unavailable.
