import { Cloud, Upload, FolderOpen, Trash2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { openBrickDB } from '../utils/db';

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
  fileId: string; // Google Drive or OneDrive file ID
  accessToken: string; // OAuth access token
  provider: 'google' | 'onedrive';
  format: string;
  size: number;
  coverArt?: string; // Base64 encoded image (lazy loaded)
  bitDepth?: number;
  sampleRate?: number;
  codec?: string;
  bitrate?: number;
  duration?: number;
  url?: string; // Lazy loaded
  isLong?: boolean;
}

interface CloudMusicConnectorProps {
  onPlayTrack: (track: CloudTrack) => void;
  onPlayAlbum: (tracks: CloudTrack[]) => void;
  currentPlayingId: string | null;
  isPlaying: boolean;
}

export function CloudMusicConnector({ onPlayTrack, onPlayAlbum, currentPlayingId, isPlaying }: CloudMusicConnectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [cloudTracks, setCloudTracks] = useState<CloudTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleDriveConnect = async () => {
    // TODO: Implement Google Drive OAuth and file picker
    console.log('Connecting to Google Drive...');
  };

  const handleOneDriveConnect = async () => {
    // TODO: Implement OneDrive OAuth and file picker
    console.log('Connecting to OneDrive...');
  };

  const handleDeleteAllCloudTracks = async () => {
    // TODO: Implement delete all cloud tracks
    console.log('Deleting all cloud tracks...');
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
            ({cloudTracks.length} tracks)
          </span>
        </div>

        <div className="local-vault-indicator" aria-hidden="true" />

        {/* Cloud Connect Buttons */}
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

      {/* Cloud Track List */}
      <div className={`hydraulic-panel ${isExpanded ? 'open' : ''}`} id="cloud-vault-panel">
        <div className="hydraulic-content">
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto"></div>
                <p className="mt-2 text-gray-400">Loading cloud tracks...</p>
              </div>
            ) : cloudTracks.length === 0 ? (
              <div className="text-center py-8">
                <Cloud size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">No cloud tracks yet.</p>
                <p className="text-gray-500 text-sm">Connect your Google Drive or OneDrive to import music.</p>
              </div>
            ) : (
              // TODO: Render cloud tracks list similar to LocalMusicUploader
              <div>
                {/* Track list implementation */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}