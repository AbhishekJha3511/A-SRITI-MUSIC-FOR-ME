import type { Playlist, Track } from './db'

const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const SESSION_KEY = 'asriti-cloud-session-v1'

type Session = { access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email?: string } }
export type CloudSnapshot = { tracks: Omit<Track, 'blob'>[]; playlists: Playlist[]; favorites: string[]; updatedAt: string }
export const cloudConfigured = Boolean(baseUrl && anonKey)
export function getCloudSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null } catch { return null }
}
function saveSession(session: Session | null) { if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY) }
async function authRequest(path: string, body: unknown) {
  if (!cloudConfigured) throw new Error('Cloud sync is not configured. Add your Supabase URL and anon key to .env.local.')
  const response = await fetch(`${baseUrl}/auth/v1/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anonKey! }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.msg || data.message || data.error_description || data.error || 'Authentication failed.')
  return data
}
export async function signIn(email: string, password: string, createAccount = false) {
  const data = await authRequest(createAccount ? 'signup' : 'token?grant_type=password', { email, password })
  if (!data.access_token) throw new Error('Check your email to confirm the account, then sign in.')
  const session: Session = { ...data, expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600) }
  saveSession(session)
  return session
}
export function signOut() { saveSession(null) }
async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!cloudConfigured) throw new Error('Cloud sync is not configured. Add your Supabase URL and anon key to .env.local.')
  const storedSession = getCloudSession()
  if (!storedSession) throw new Error('Sign in to enable cloud sync.')
  let session: Session = storedSession
  if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000) + 30 && session.refresh_token) {
    const refreshed = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
    session = { ...refreshed, expires_at: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600) }
    saveSession(session)
  }
  const send = (s: Session) => fetch(`${baseUrl}/rest/v1/${path}`, { ...init, headers: { apikey: anonKey!, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  let response = await send(session)
  if (response.status === 401 && session.refresh_token) {
    const refreshed = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
    session = { ...refreshed, expires_at: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600) }
    saveSession(session); response = await send(session)
  }
  return response
}
export async function downloadSnapshot(): Promise<CloudSnapshot | null> {
  const response = await authorizedFetch('user_library_snapshots?select=snapshot&limit=1')
  if (!response.ok) throw new Error((await response.text()) || 'Could not download your cloud library.')
  const rows = await response.json() as { snapshot: CloudSnapshot }[]
  return rows[0]?.snapshot || null
}
export async function uploadSnapshot(snapshot: CloudSnapshot) {
  const session = getCloudSession()
  if (!session) throw new Error('Sign in to enable cloud sync.')
  const response = await authorizedFetch('user_library_snapshots?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: session.user.id, snapshot, updated_at: new Date().toISOString() }) })
  if (!response.ok) throw new Error((await response.text()) || 'Could not upload your cloud library.')
}
