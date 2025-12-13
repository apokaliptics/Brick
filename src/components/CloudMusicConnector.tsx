import { Cloud, Upload, FolderOpen, Trash2, Play, RefreshCcw } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { openBrickDB } from '../utils/db';
import { generateCodeVerifier, generateCodeChallenge, buildGoogleAuthUrl, exchangeGoogleCodeForToken, buildMicrosoftAuthUrl, exchangeMicrosoftCodeForToken, refreshGoogleAccessToken, refreshMicrosoftAccessToken, DESKTOP_REDIRECT_URI } from '../utils/cloudAuth';
import { parseRemoteMetadataFromUrl } from '../utils/cloudMetadata';

interface CloudTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArtist?: string;
  year?: string;
  trackNumber?: number;
  discNumber?: number;
  genre?: string;
  addedAt: number;
  fileId: string;
  cloudId?: string;
  accessToken: string;
  cloudProvider?: 'google' | 'onedrive';
  provider: 'google' | 'onedrive';
  format: string;
  size: number;
  coverArt?: string;
  bitDepth?: number;
  sampleRate?: number;
  codec?: string;
  bitrate?: number;
  duration?: number;
  url?: string;
  audioUrl?: string;
  isLong?: boolean;
  filePath?: string | null;
  isCloud?: boolean;
}

interface CloudMusicConnectorProps {
    onPlayTrack: (track: CloudTrack) => void;
    onPlayAlbum: (tracks: CloudTrack[]) => void;
    currentPlayingId: string | null;
    isPlaying: boolean;
  }

  interface GoogleDriveFile {
    id: string;
    name: string;
    mimeType?: string;
    size?: number;
    thumbnailLink?: string;
  }

  interface OneDriveItem {
    id: string;
    name: string;
    size?: number;
    folder?: unknown;
    file?: { mimeType?: string };
  }

  const audioExtensions = ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'alac', 'aiff', 'wma'];

  const isAudioFileName = (name?: string, mime?: string) => {
    if (!name && !mime) return false;
    const lower = (name || '').toLowerCase();
    if (mime && mime.toLowerCase().startsWith('audio/')) return true;
    return audioExtensions.some(ext => lower.endsWith(`.${ext}`));
  };

  export function CloudMusicConnector({ onPlayTrack, onPlayAlbum, currentPlayingId, isPlaying }: CloudMusicConnectorProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [cloudTracks, setCloudTracks] = useState<CloudTrack[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
    const [oneDriveFiles, setOneDriveFiles] = useState<OneDriveItem[]>([]);
    const [selectedDriveFiles, setSelectedDriveFiles] = useState<Record<string, boolean>>({});
    const [selectedOneDriveFiles, setSelectedOneDriveFiles] = useState<Record<string, boolean>>({});
    const [isImporting, setIsImporting] = useState(false);

    const playLockRef = useRef(false);

    useEffect(() => {
      const loadCloudTracks = async () => {
        setIsLoading(true);
        try {
          const db = await openBrickDB();
          const tx = db.transaction(['cloudTracks'], 'readonly');
          const store = tx.objectStore('cloudTracks');
          const req = store.getAll();
          req.onsuccess = () => {
            const loaded = (req.result || []).map((t: any) => ({
              ...t,
              provider: t.provider || t.cloudProvider || 'google',
              cloudProvider: t.provider || t.cloudProvider || 'google',
              cloudId: t.cloudId || t.fileId,
              filePath: t.filePath ?? null,
              isCloud: t.isCloud ?? true,
            }));
            setCloudTracks(loaded);
          };
          req.onerror = () => setCloudTracks([]);
        } catch {
          setCloudTracks([]);
        } finally {
          setIsLoading(false);
        }
      };
      loadCloudTracks();
    }, []);

    const refreshCloudToken = async (provider: 'google' | 'onedrive') => {
      try {
        const db = await openBrickDB();
        const tx = db.transaction(['cloudTokens'], 'readwrite');
        const store = tx.objectStore('cloudTokens');
        const req = store.get(provider);
        const tokenObj: any = await new Promise((resolve) => {
          req.onsuccess = () => resolve(req.result?.token);
          req.onerror = () => resolve(null);
        });
        if (!tokenObj || !tokenObj.refresh_token) return null;

        let refreshed: any = null;
        if (provider === 'google') {
          const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
          if (!clientId) throw new Error('Missing Google client id');
          refreshed = await refreshGoogleAccessToken({ refreshToken: tokenObj.refresh_token, clientId });
        } else {
          const clientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID;
          if (!clientId) throw new Error('Missing OneDrive client id');
          refreshed = await refreshMicrosoftAccessToken({ refreshToken: tokenObj.refresh_token, clientId });
        }
        if (refreshed) {
          const expiresAt = Date.now() + ((refreshed.expires_in ?? 3600) * 1000);
          const merged = { ...tokenObj, ...refreshed, expires_at: expiresAt };
          store.put({ provider, token: merged });
          return merged;
        }
        return null;
      } catch (err) {
        console.warn('Failed refreshing cloud token', err);
        return null;
      }
    };

    const getCloudToken = async (provider: 'google' | 'onedrive') => {
      const db = await openBrickDB();
      const tx = db.transaction(['cloudTokens'], 'readonly');
      const store = tx.objectStore('cloudTokens');
      const tokenObj: any = await new Promise((resolve) => {
        const req = store.get(provider);
        req.onsuccess = () => resolve(req.result?.token);
        req.onerror = () => resolve(null);
      });
      if (!tokenObj) return null;
      const now = Date.now();
      if (tokenObj.expires_at && now > tokenObj.expires_at - 60000) {
        const refreshed = await refreshCloudToken(provider);
        return refreshed ?? tokenObj;
      }
      return tokenObj;
    };

    const handleGoogleDriveConnect = async () => {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const redirectUri = DESKTOP_REDIRECT_URI;
      if (!clientId) {
        alert('VITE_GOOGLE_CLIENT_ID not set. Please configure a Google OAuth client ID.');
        return;
      }
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      sessionStorage.setItem('gdrive_code_verifier', codeVerifier);
      const authUrl = await buildGoogleAuthUrl({ clientId, redirectUri, codeChallenge });
      const w = window.open(authUrl, 'google_oauth', 'width=600,height=600');
      const listener = async (e: MessageEvent) => {
        if (e.origin !== location.origin) return;
        const data = e.data as any;
        if (data && data.provider === 'google' && data.code) {
          try {
            const tokenResp = await exchangeGoogleCodeForToken({ code: data.code, codeVerifier, redirectUri, clientId });
            const expiresAt = Date.now() + ((tokenResp.expires_in ?? 3600) * 1000);
            const tokenToStore = { ...tokenResp, expires_at: expiresAt };
            const db = await openBrickDB();
            const tx = db.transaction(['cloudTokens'], 'readwrite');
            tx.objectStore('cloudTokens').put({ provider: 'google', token: tokenToStore });
            alert('Google Drive connected');
          } catch (err) {
            console.error('Failed to exchange Google token', err);
          }
          window.removeEventListener('message', listener);
          clearInterval(checkClosed);
          w?.close();
        }
      };
      window.addEventListener('message', listener);
      const checkClosed = setInterval(() => {
        try {
          if (!w || w.closed) {
            window.removeEventListener('message', listener);
            clearInterval(checkClosed);
          }
        } catch {}
      }, 500);
    };

    const handleOneDriveConnect = async () => {
      const clientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID;
      const redirectUri = DESKTOP_REDIRECT_URI;
      if (!clientId) {
        alert('VITE_ONEDRIVE_CLIENT_ID not set. Please configure OneDrive OAuth client ID.');
        return;
      }
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      sessionStorage.setItem('onedrive_code_verifier', codeVerifier);
      const authUrl = await buildMicrosoftAuthUrl({ clientId, redirectUri, codeChallenge });
      const w = window.open(authUrl, 'onedrive_oauth', 'width=600,height=600');
      const listener = async (e: MessageEvent) => {
        if (e.origin !== location.origin) return;
        const data = e.data as any;
        if (data && data.provider === 'onedrive' && data.code) {
          try {
            const tokenResp = await exchangeMicrosoftCodeForToken({ code: data.code, codeVerifier, redirectUri, clientId });
            const expiresAt = Date.now() + ((tokenResp.expires_in ?? 3600) * 1000);
            const tokenToStore = { ...tokenResp, expires_at: expiresAt };
            const db = await openBrickDB();
            const tx = db.transaction(['cloudTokens'], 'readwrite');
            tx.objectStore('cloudTokens').put({ provider: 'onedrive', token: tokenToStore });
            alert('OneDrive connected');
          } catch (err) {
            console.error('Failed to exchange OneDrive token', err);
          }
          window.removeEventListener('message', listener);
          clearInterval(checkClosed2);
          w?.close();
        }
      };
      window.addEventListener('message', listener);
      const checkClosed2 = setInterval(() => {
        try {
          if (!w || w.closed) {
            window.removeEventListener('message', listener);
            clearInterval(checkClosed2);
          }
        } catch {}
      }, 500);
    };

    const fetchDriveFolderChildren = async (folderId: string, token: string): Promise<GoogleDriveFile[]> => {
      const collected: GoogleDriveFile[] = [];
      let pageToken: string | undefined;
      do {
        const query = `'${folderId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size)&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const json = await resp.json();
        collected.push(...(json.files || []));
        pageToken = json.nextPageToken;
      } while (pageToken);
      return collected;
    };

    const collectDriveAudioFiles = async (item: GoogleDriveFile, token: string): Promise<GoogleDriveFile[]> => {
      if (!item) return [];
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        const children = await fetchDriveFolderChildren(item.id, token);
        const nested: GoogleDriveFile[] = [];
        for (const child of children) {
          const inner = await collectDriveAudioFiles(child, token);
          nested.push(...inner);
        }
        return nested;
      }
      if (isAudioFileName(item.name, item.mimeType)) return [item];
      return [];
    };

    const fetchOneDriveFolderChildren = async (itemId: string, token: string): Promise<OneDriveItem[]> => {
      const collected: OneDriveItem[] = [];
      let nextLink: string | undefined = `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/children?$select=id,name,size,folder,file`;
      while (nextLink) {
        const resp: Response = await fetch(nextLink, { headers: { Authorization: `Bearer ${token}` } });
        const json: any = await resp.json();
        collected.push(...(json.value || []));
        nextLink = json['@odata.nextLink'];
      }
      return collected;
    };

    const collectOneDriveAudioFiles = async (item: OneDriveItem, token: string): Promise<OneDriveItem[]> => {
      if (!item) return [];
      if (item.folder) {
        const children = await fetchOneDriveFolderChildren(item.id, token);
        const nested: OneDriveItem[] = [];
        for (const child of children) {
          const inner = await collectOneDriveAudioFiles(child, token);
          nested.push(...inner);
        }
        return nested;
      }
      if (isAudioFileName(item.name, item.file?.mimeType)) return [item];
      return [];
    };

    const listDriveFiles = async () => {
      const token = await getCloudToken('google');
      if (!token?.access_token) {
        alert('No Google Drive token found. Please connect first.');
        return;
      }
      try {
        let resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=(mimeType contains 'audio' or mimeType = 'application/vnd.google-apps.folder') and trashed=false&fields=files(id,name,mimeType,size,thumbnailLink)`, { headers: { Authorization: `Bearer ${token.access_token}` } });
        if (resp.status === 401) {
          const refreshed = await refreshCloudToken('google');
          if (refreshed?.access_token) {
            resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=(mimeType contains 'audio' or mimeType = 'application/vnd.google-apps.folder') and trashed=false&fields=files(id,name,mimeType,size,thumbnailLink)`, { headers: { Authorization: `Bearer ${refreshed.access_token}` } });
          }
        }
        const json = await resp.json();
        setDriveFiles(json.files || []);
      } catch (err) {
        console.error('Failed to list Drive files', err);
      }
    };

    const listOneDriveFiles = async () => {
      const token = await getCloudToken('onedrive');
      if (!token?.access_token) {
        alert('No OneDrive token found. Please connect first.');
        return;
      }
      try {
        let resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/children?$select=id,name,size,folder,file`, { headers: { Authorization: `Bearer ${token.access_token}` } });
        if (resp.status === 401) {
          const refreshed = await refreshCloudToken('onedrive');
          if (refreshed?.access_token) {
            resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/children?$select=id,name,size,folder,file`, { headers: { Authorization: `Bearer ${refreshed.access_token}` } });
          }
        }
        const json = await resp.json();
        const filtered = (json.value || []).filter((item: any) => item.folder || (item.file && item.file.mimeType && item.file.mimeType.startsWith('audio/')) || isAudioFileName(item.name, item.file?.mimeType));
        setOneDriveFiles(filtered);
      } catch (err) {
        console.error('Failed to list OneDrive files', err);
      }
    };

    const importSelectedDriveFiles = async () => {
      const selectedIds = Object.keys(selectedDriveFiles).filter(k => selectedDriveFiles[k]);
      if (!selectedIds.length) return;
      const token = await getCloudToken('google');
      if (!token?.access_token) return;
      setIsImporting(true);
      try {
        const audioFiles: GoogleDriveFile[] = [];
        for (const id of selectedIds) {
          const base = driveFiles.find((d) => d.id === id);
          if (!base) continue;
          const files = await collectDriveAudioFiles(base, token.access_token);
          audioFiles.push(...files);
        }
        const unique = new Map<string, GoogleDriveFile>();
        audioFiles.forEach(f => unique.set(f.id, f));
        const toImport: CloudTrack[] = Array.from(unique.values()).map(f => ({
          id: `gdrive-${f.id}`,
          name: f.name,
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          addedAt: Date.now(),
          fileId: f.id,
          cloudId: f.id,
          accessToken: token.access_token,
          provider: 'google',
          cloudProvider: 'google',
          format: f.mimeType?.split('/')?.pop()?.toUpperCase() || 'MP3',
          size: f.size ? Number(f.size) : 0,
          audioUrl: '',
          filePath: null,
          isCloud: true,
        }));
        const db = await openBrickDB();
        const tx = db.transaction(['cloudTracks'], 'readwrite');
        const store = tx.objectStore('cloudTracks');
        for (const t of toImport) store.put(t);
        setCloudTracks(prev => [...prev, ...toImport]);
        setSelectedDriveFiles({});
        setDriveFiles([]);
      } catch (err) {
        console.error('Failed to import Drive files', err);
      } finally {
        setIsImporting(false);
      }
    };

    const importSelectedOneDriveFiles = async () => {
      const selectedIds = Object.keys(selectedOneDriveFiles).filter(k => selectedOneDriveFiles[k]);
      if (!selectedIds.length) return;
      const token = await getCloudToken('onedrive');
      if (!token?.access_token) return;
      setIsImporting(true);
      try {
        const audioFiles: OneDriveItem[] = [];
        for (const id of selectedIds) {
          const base = oneDriveFiles.find((d) => d.id === id);
          if (!base) continue;
          const files = await collectOneDriveAudioFiles(base, token.access_token);
          audioFiles.push(...files);
        }
        const unique = new Map<string, OneDriveItem>();
        audioFiles.forEach(f => unique.set(f.id, f));
        const toImport: CloudTrack[] = Array.from(unique.values()).map(f => ({
          id: `onedrive-${f.id}`,
          name: f.name || f.id,
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          addedAt: Date.now(),
          fileId: f.id,
          cloudId: f.id,
          accessToken: token.access_token,
          provider: 'onedrive',
          cloudProvider: 'onedrive',
          format: f.file?.mimeType?.split('/')?.pop()?.toUpperCase() || 'MP3',
          size: f.size || 0,
          audioUrl: '',
          filePath: null,
          isCloud: true,
        }));
        const db = await openBrickDB();
        const tx = db.transaction(['cloudTracks'], 'readwrite');
        const store = tx.objectStore('cloudTracks');
        for (const t of toImport) store.put(t);
        setCloudTracks(prev => [...prev, ...toImport]);
        setSelectedOneDriveFiles({});
        setOneDriveFiles([]);
      } catch (err) {
        console.error('Failed to import OneDrive files', err);
      } finally {
        setIsImporting(false);
      }
    };

    const resolveAudioUrlForCloudTrack = async (track: CloudTrack) => {
      try {
        const ref = track.cloudId || track.fileId;
        if (typeof ref === 'string' && (ref.startsWith('http://') || ref.startsWith('https://'))) {
          track.audioUrl = ref;
          const db = await openBrickDB();
          const tx = db.transaction(['cloudTracks'], 'readwrite');
          tx.objectStore('cloudTracks').put(track);
          setCloudTracks(prev => prev.map(t => t.id === track.id ? track : t));
          return track.audioUrl;
        }
        const token = await getCloudToken(track.provider);
        if (!token?.access_token) throw new Error('No token');
        const proxyUrl = `http://localhost:4000/api/cloud/audio?provider=${track.provider}&fileId=${ref}&accessToken=${encodeURIComponent(token.access_token)}`;
        track.audioUrl = proxyUrl;
        track.accessToken = token.access_token;
        track.cloudProvider = track.provider;
        track.cloudId = ref;
        track.isCloud = true;
        const db = await openBrickDB();
        const tx = db.transaction(['cloudTracks'], 'readwrite');
        tx.objectStore('cloudTracks').put(track);
        setCloudTracks(prev => prev.map(t => t.id === track.id ? track : t));
        return proxyUrl;
      } catch (err) {
        console.warn('Failed to resolve audio url for cloud track:', err);
        return null;
      }
    };

    const handlePlayTrack = async (track: CloudTrack) => {
      if (playLockRef.current) return;
      playLockRef.current = true;
      try {
        if (!track.audioUrl) {
          await resolveAudioUrlForCloudTrack(track);
        }
        if ((!track.artist || track.artist === 'Unknown Artist') && track.audioUrl) {
          const parsed = await parseRemoteMetadataFromUrl(track.audioUrl, track.name);
          if (parsed?.tags) {
            const tags: any = parsed.tags;
            track.artist = tags.artist || tags.TPE1 || track.artist;
            track.name = tags.title || tags.TIT2 || track.name;
            track.album = tags.album || tags.TALB || track.album;
            if (tags.picture) {
              const { data, format: imgFormat } = tags.picture;
              let base64String = '';
              for (let j = 0; j < data.length; j++) base64String += String.fromCharCode(data[j]);
              track.coverArt = `data:${imgFormat};base64,${btoa(base64String)}`;
            }
            const db = await openBrickDB();
            const tx = db.transaction(['cloudTracks'], 'readwrite');
            tx.objectStore('cloudTracks').put(track);
            setCloudTracks(prev => prev.map(t => t.id === track.id ? track : t));
          }
        }
        onPlayTrack(track);
      } finally {
        setTimeout(() => { playLockRef.current = false; }, 250);
      }
    };

    const handleDeleteAllCloudTracks = async () => {
      try {
        const db = await openBrickDB();
        const tx = db.transaction(['cloudTracks'], 'readwrite');
        tx.objectStore('cloudTracks').clear();
        setCloudTracks([]);
      } catch (err) {
        console.warn('Failed to delete cloud tracks', err);
      }
    };

    const totalSizeMb = cloudTracks.reduce((acc, t) => acc + (t.size || 0), 0) / (1024 * 1024);

    const parseRemoteMetadataForTrack = async (track: CloudTrack) => {
      try {
        if (!track.audioUrl) await resolveAudioUrlForCloudTrack(track);
        if (!track.audioUrl) return null;
        const parsed = await parseRemoteMetadataFromUrl(track.audioUrl, track.name);
        if (!parsed || !parsed.tags) return null;
        const tags: any = parsed.tags;
        track.artist = tags.artist || tags.TPE1 || track.artist;
        track.name = tags.title || tags.TIT2 || track.name;
        track.album = tags.album || tags.TALB || track.album;
        if (tags.picture) {
          const { data, format: imgFormat } = tags.picture;
          let base64String = '';
          for (let j = 0; j < data.length; j++) base64String += String.fromCharCode(data[j]);
          track.coverArt = `data:${imgFormat};base64,${btoa(base64String)}`;
        }
        const db = await openBrickDB();
        const tx = db.transaction(['cloudTracks'], 'readwrite');
        tx.objectStore('cloudTracks').put(track);
        setCloudTracks(prev => prev.map(t => t.id === track.id ? track : t));
        return parsed;
      } catch (err) {
        console.warn('Failed to parse remote metadata', err);
        return null;
      }
    };

    return (
      <div className="local-vault hydraulic-container">
        <div
          className="hydraulic-header cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }
          }}
        >
          <div className="flex items-center gap-3">
            <Cloud size={20} color="#00bcd4" />
            <h3 className="mono text-lg" style={{ color: '#00bcd4' }}>
              Cloud Library
            </h3>
            <span className="mono text-sm opacity-60" style={{ color: '#00bcd4' }}>
              ({cloudTracks.length} tracks, {totalSizeMb.toFixed(1)} MB)
            </span>
          </div>

          <div className="local-vault-indicator" aria-hidden="true" />

          <div className="flex items-center gap-3 local-vault-actions flex-nowrap" style={{ alignItems: 'center', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGoogleDriveConnect();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105"
              style={{
                background: 'linear-gradient(120deg, rgba(66, 133, 244, 0.2), rgba(66, 133, 244, 0.32))',
                border: '1px solid #4285f4',
                boxShadow: '0 0 0 1px rgba(66, 133, 244, 0.25)',
              }}
              title="Connect Google Drive"
            >
              <Upload size={16} color="#4285f4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOneDriveConnect();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105"
              style={{
                backgroundColor: 'rgba(0, 120, 212, 0.15)',
                border: '1px solid #0078d4',
              }}
              title="Connect OneDrive"
            >
              <FolderOpen size={16} color="#0078d4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteAllCloudTracks();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105"
              style={{
                marginLeft: 0,
                backgroundColor: 'transparent',
                border: '1px solid #ff1744',
                color: '#ff1744',
                paddingLeft: '12px',
                paddingRight: '12px',
                paddingTop: '8px',
                paddingBottom: '8px',
                minWidth: '110px'
              }}
              title="Delete all cloud tracks"
            >
              <Trash2 size={16} color="#ff1744" />
            </button>
          </div>
        </div>

        <div className={`hydraulic-panel ${isExpanded ? 'open' : ''}`} id="cloud-vault-panel">
          <div className="hydraulic-content">
            <div className="p-4 space-y-4">

              <div className="flex flex-wrap gap-2">
                <button className="px-3 py-2 rounded bg-cyan-900/30 border border-cyan-700 text-cyan-200" onClick={() => listDriveFiles()}>
                  Browse Drive
                </button>
                <button className="px-3 py-2 rounded bg-blue-900/30 border border-blue-700 text-blue-200" onClick={() => listOneDriveFiles()}>
                  Browse OneDrive
                </button>
                <button className="px-3 py-2 rounded bg-emerald-900/30 border border-emerald-700 text-emerald-200 disabled:opacity-50" disabled={isImporting} onClick={importSelectedDriveFiles}>
                  Import Drive Selection
                </button>
                <button className="px-3 py-2 rounded bg-indigo-900/30 border border-indigo-700 text-indigo-200 disabled:opacity-50" disabled={isImporting} onClick={importSelectedOneDriveFiles}>
                  Import OneDrive Selection
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto" />
                  <p className="mt-2 text-gray-400">Loading cloud tracks...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div className="rounded-lg border border-slate-700 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-cyan-200 flex items-center gap-2"><Cloud size={16} /> Google Drive</h4>
                      <button className="text-xs text-gray-400 flex items-center gap-1" onClick={() => setDriveFiles([])}><RefreshCcw size={14} />Clear</button>
                    </div>
                    {driveFiles.length === 0 ? (
                      <p className="text-xs text-gray-500">No files loaded. Click Browse Drive.</p>
                    ) : (
                      <div className="max-h-56 overflow-auto space-y-2">
                        {driveFiles.map(f => (
                          <label key={f.id} className="flex items-center gap-2 text-sm text-gray-200">
                            <input type="checkbox" checked={!!selectedDriveFiles[f.id]} onChange={(e) => setSelectedDriveFiles(prev => ({ ...prev, [f.id]: e.target.checked }))} />
                            <span className="truncate">{f.name}</span>
                            <span className="text-[11px] text-gray-500">{f.mimeType?.includes('folder') ? 'Folder' : 'Audio'}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-700 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-blue-200 flex items-center gap-2"><Cloud size={16} /> OneDrive</h4>
                      <button className="text-xs text-gray-400 flex items-center gap-1" onClick={() => setOneDriveFiles([])}><RefreshCcw size={14} />Clear</button>
                    </div>
                    {oneDriveFiles.length === 0 ? (
                      <p className="text-xs text-gray-500">No files loaded. Click Browse OneDrive.</p>
                    ) : (
                      <div className="max-h-56 overflow-auto space-y-2">
                        {oneDriveFiles.map(f => (
                          <label key={f.id} className="flex items-center gap-2 text-sm text-gray-200">
                            <input type="checkbox" checked={!!selectedOneDriveFiles[f.id]} onChange={(e) => setSelectedOneDriveFiles(prev => ({ ...prev, [f.id]: e.target.checked }))} />
                            <span className="truncate">{f.name}</span>
                            <span className="text-[11px] text-gray-500">{f.folder ? 'Folder' : 'Audio'}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-800 pt-3">
                {cloudTracks.length === 0 ? (
                  <div className="text-center py-8">
                    <Cloud size={48} className="mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400">No cloud tracks yet.</p>
                    <p className="text-gray-500 text-sm">Connect Google Drive or OneDrive, select folders, and import.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cloudTracks
                      .sort((a, b) => b.addedAt - a.addedAt)
                      .map(track => (
                        <div key={track.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 bg-slate-900/40">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-cyan-200 uppercase">{track.provider}</span>
                              <span className="text-sm text-gray-100 truncate">{track.name}</span>
                            </div>
                            <div className="text-xs text-gray-500 truncate">{track.artist || 'Unknown Artist'} • {track.album || 'Unknown Album'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="text-xs px-3 py-1 rounded bg-cyan-800 text-white flex items-center gap-1" onClick={() => handlePlayTrack(track)}>
                              <Play size={14} /> Play
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
}
