export type Track = {
  id: string; title: string; artist: string; album: string; duration: number;
  kind: 'local' | 'youtube'; blob?: Blob; mime?: string; artwork?: string; url?: string;
  addedAt: number
}
export type Playlist = { id: string; name: string; trackIds: string[] }

const DB_NAME = 'asriti-music-library'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function request<T>(store: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const req = action(tx.objectStore(store))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
    tx.onabort = () => reject(tx.error)
  }).finally(() => db.close())
}
export const getTracks = () => request<Track[]>('tracks', 'readonly', s => s.getAll())
export const putTrack = (track: Track) => request<IDBValidKey>('tracks', 'readwrite', s => s.put(track))
export const deleteTrack = (id: string) => request<undefined>('tracks', 'readwrite', s => s.delete(id))
export const getPlaylists = () => request<Playlist[]>('playlists', 'readonly', s => s.getAll())
export const putPlaylist = (playlist: Playlist) => request<IDBValidKey>('playlists', 'readwrite', s => s.put(playlist))
export const getSetting = (key: string) => request<{key:string; value:unknown} | undefined>('settings', 'readonly', s => s.get(key))
export const putSetting = (key: string, value: unknown) => request<IDBValidKey>('settings', 'readwrite', s => s.put({key, value}))
