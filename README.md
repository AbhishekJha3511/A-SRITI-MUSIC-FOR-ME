# A-SRITI MVP

A local-first music library/player built with React, TypeScript, Vite, Tailwind CSS, IndexedDB and the HTML Audio API.

## Requirements
- Node.js 20.19+ or 22.12+ recommended
- npm

## Run locally
```bash
cd a-sriti
npm install
npm run dev
```
Open the local URL printed by Vite (normally http://localhost:5173).

## Production build
```bash
npm run build
npm run preview
```

## Included in this MVP
- Responsive black-and-white minimalist UI with soft glass panels
- Live Web Audio API frequency visualizer for local audio playback
- Import supported audio files into IndexedDB
- Optional metadata parsing (title, artist, album, duration, embedded artwork)
- Local audio playback, seek, volume, next/previous, shuffle and repeat
- Favorites and playlists
- Search across titles/artists/albums
- Save YouTube URLs and open them through a YouTube IFrame embed
- IndexedDB persistence for library, playlists and favorites
- Missing audio and storage failure messages

## Important limitations
- Audio blobs are stored in browser IndexedDB. Large libraries can exceed browser storage quotas; import smaller batches and keep the original audio files backed up.
- Browsers may evict site data if storage is under pressure. This MVP does not provide an external backup/export workflow yet.
- Embedded artwork object URLs are temporary and may not persist across reloads; artwork metadata extraction is best-effort. Track metadata and audio blobs are persisted.
- YouTube links are stored and validated, but the MVP uses the official YouTube IFrame API embed rather than downloading streams. YouTube controls are separate from the local HTML Audio player. YouTube can block playback due to region, age, privacy, embedding, or account restrictions.
- YouTube link titles are not fetched automatically in this first build; the saved item shows a generic title plus the video ID.
- Metadata support depends on the format and the browser/metadata parser. Not every audio codec is playable in every browser.
- Playlists can be created and tracks can be added using the row's More menu. Renaming/deleting playlists and editing track metadata are not included yet.
- This is a local browser MVP, not yet a packaged Windows desktop app.

## Notes
No music is bundled with the project. Import audio files you have the right to use.
