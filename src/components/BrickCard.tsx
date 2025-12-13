// @ts-nocheck
/* eslint-disable */
import { Playlist } from '../types';
import { Lock, Trash2 } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface BrickCardProps {
  playlist: Playlist;
  isLocked?: boolean;
  onClick?: () => void;
  onDelete?: (playlistId: string) => void;
  onCancelDelete?: (playlistId: string) => void;
  onConfirmDelete?: (playlistId: string) => void;
  size?: 'small' | 'medium' | 'large';
  compact?: boolean;
  canDelete?: boolean;
  timeUntilDeletion?: string;
}

export function BrickCard({ 
  playlist, 
  isLocked = false, 
  onClick, 
  onDelete,
  onCancelDelete,
  onConfirmDelete,
  size = 'medium', 
  compact = false,
  canDelete = false,
  timeUntilDeletion,
}: BrickCardProps) {
  const sizeClasses = {
    small: 'w-full',
    medium: 'w-full',
    large: 'w-full col-span-2',
  };

  const isDeletionQueued = playlist.deletionQueuedAt !== undefined;

  return (
    <div
      onClick={onClick}
      className={`${sizeClasses[size]} bg-[#252525] rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:bg-[#2a2a2a] group relative`}
      style={{
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Album Art */}
      <div className="relative w-full aspect-square">
        <ImageWithFallback
          src={playlist.customCoverImage || playlist.coverImage}
          alt={playlist.name}
          className={`w-full h-full object-cover ${isLocked ? 'blur-xl' : ''}`}
        />
        
        {/* Gradient Overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)',
          }}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          {playlist.hiRes && (
            <div className="px-2 py-1 rounded border border-[#c6a700] bg-transparent backdrop-blur-sm">
              <span className="mono" style={{ color: '#c6a700', fontSize: '0.7rem' }}>
                Hi-Res
              </span>
            </div>
          )}
          <div className="flex-1"></div>
          {!playlist.isPublic && (
            <div className="px-2 py-1 rounded border border-[#a0a0a0] bg-transparent backdrop-blur-sm">
              <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.7rem' }}>
                Draft
              </span>
            </div>
          )}
        </div>

        {/* Lock Icon */}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock size={48} color="#a0a0a0" strokeWidth={1.5} />
          </div>
        )}

        {/* Track Count - Bottom Left */}
        <div className="absolute bottom-3 left-3">
          <span className="mono" style={{ color: '#e0e0e0', fontSize: '0.8rem' }}>
            {playlist.trackCount} tracks
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="mb-1 truncate" style={{ color: '#e0e0e0', fontSize: '0.875rem' }}>
          {playlist.name}
        </h4>
        <div className="flex items-center gap-2">
          {playlist.creator && (
            <>
              <ImageWithFallback
                src={playlist.creator.avatar}
                alt={playlist.creator.name}
                className="w-4 h-4 rounded-full"
              />
              <p style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
                {playlist.creator.name}
              </p>
            </>
          )}
          {!playlist.creator && (
            <p style={{ color: '#a0a0a0', fontSize: '0.75rem' }}>
              Your Collection
            </p>
          )}
        </div>
        {playlist.structuralIntegrity !== undefined && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="mono" style={{ color: '#a0a0a0', fontSize: '0.65rem' }}>
                Structural Integrity
              </span>
              <span
                className="mono"
                style={{
                  color: playlist.structuralIntegrity >= 70 ? '#4caf50' : '#d32f2f',
                  fontSize: '0.7rem',
                }}
              >
                {playlist.structuralIntegrity}%
              </span>
            </div>
            <div className="w-full bg-[#1a1a1a] rounded-full h-1">
              <div
                className="h-1 rounded-full transition-all"
                style={{
                  width: `${playlist.structuralIntegrity}%`,
                  background:
                    playlist.structuralIntegrity >= 70
                      ? 'linear-gradient(to right, #4caf50, #8bc34a)'
                      : 'linear-gradient(to right, #d32f2f, #b71c1c)',
                }}
              />
            </div>
          </div>
        )}
        
        {/* Deletion Status and Actions */}
        {isDeletionQueued && (
          <div className="mt-3 p-2 rounded" style={{ backgroundColor: 'rgba(211, 47, 47, 0.1)', border: '1px solid #d32f2f' }}>
            <p className="mono text-center text-sm mb-2" style={{ color: '#d32f2f', fontSize: '0.7rem' }}>
              {timeUntilDeletion}
            </p>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelDelete?.(playlist.id);
                }}
                className="flex-1 py-1 px-2 rounded text-xs transition-all hover:scale-105"
                style={{ backgroundColor: '#252525', border: '1px solid #a0a0a0', color: '#a0a0a0' }}
              >
                Cancel
              </button>
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfirmDelete?.(playlist.id);
                  }}
                  className="flex-1 py-1 px-2 rounded text-xs transition-all hover:scale-105"
                  style={{ backgroundColor: '#d32f2f', color: '#e0e0e0' }}
                >
                  Delete Now
                </button>
              )}
            </div>
          </div>
        )}
        
        {!isDeletionQueued && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(playlist.id);
            }}
            className="w-full mt-3 py-2 px-3 rounded flex items-center justify-center gap-2 transition-all hover:bg-red-900/20"
            style={{ backgroundColor: 'rgba(211, 47, 47, 0.1)', border: '1px solid #d32f2f', color: '#d32f2f' }}
          >
            <Trash2 size={14} />
            <span className="mono text-xs">Delete Brick</span>
          </button>
        )}
      </div>
    </div>
  );
}