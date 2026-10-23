# A-SRITI cloud sync setup

Cloud sync keeps saved external links, their metadata, playlist definitions, and favorites available across devices. **Audio files imported from your computer stay in that browser's IndexedDB and are never uploaded.**

## 1. Create a Supabase project

1. Open https://supabase.com/dashboard and create a project.
2. In **Project Settings → API**, copy the Project URL and the publishable/anon key.
3. In **SQL Editor**, run the complete script in `supabase/cloud-sync.sql`.
4. In **Authentication → URL Configuration**, set your Site URL to your deployed Vercel URL and add your local development URL (for example `http://localhost:5173`) to the redirect URL allow list if needed.

## 2. Configure local development

1. Copy `.env.example` to `.env.local`.
2. Replace the example values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

3. Restart the dev server after changing environment variables.
4. Open **Cloud sync** in A-SRITI, create an account or sign in, then press **Sync now**.

## 3. Configure Vercel

In Vercel → Project → Settings → Environment Variables, add the same two variables for Production (and Preview if desired). Redeploy after saving them. Never use a Supabase service-role/secret key in the browser.

## Important behavior

- The cloud snapshot stores link-based tracks, playlist metadata, and favorites only; it does not upload `Blob` audio data.
- Imported local files remain on the device that imported them. Re-import those files on another device if you want them playable there.
- Current sync is manual: click **Sync now** on each device after changes. It merges saved links by track ID and combines favorites; if you need strict conflict resolution for edits/deletions, that should be added before treating the snapshot as a collaborative database.
- Account email confirmation may need to be completed depending on your Supabase Auth settings.
- Only use external sources and streams you are authorized to access. Spotify's official browser playback SDK requires Premium; this project does not bypass those restrictions.

## Public featured YouTube collection

The app now includes seven built-in featured YouTube links in `src/App.tsx`. They are seeded into each visitor's local IndexedDB automatically, so they appear for every visitor without sign-in or cloud sync. The links are part of the deployed app code; keep this list in the code to keep the starter collection available after redeployments. They play through YouTube's official embedded player and the app does not download or host their audio. Video availability and playback remain subject to YouTube and each uploader's settings. Titles are generic placeholders until you replace them with verified video titles.
