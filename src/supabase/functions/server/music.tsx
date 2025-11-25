import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';

const music = new Hono();

// Enable CORS
music.use('*', cors());

// Get all playlists
music.get('/make-server-36806465/playlists', async (c) => {
  try {
    const playlists = await kv.getByPrefix('playlist:');
    return c.json({ playlists: playlists || [] });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return c.json({ error: 'Failed to fetch playlists' }, 500);
  }
});

// Get single playlist
music.get('/make-server-36806465/playlists/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const playlist = await kv.get(`playlist:${id}`);
    
    if (!playlist) {
      return c.json({ error: 'Playlist not found' }, 404);
    }
    
    return c.json({ playlist });
  } catch (error) {
    console.error('Error fetching playlist:', error);
    return c.json({ error: 'Failed to fetch playlist' }, 500);
  }
});

// Create playlist
music.post('/make-server-36806465/playlists', async (c) => {
  try {
    const body = await c.req.json();
    const { name, coverImage, creator, tracks } = body;
    
    const id = `playlist-${Date.now()}`;
    const playlist = {
      id,
      name,
      coverImage,
      creator,
      tracks: tracks || [],
      trackCount: tracks?.length || 0,
      structuralIntegrity: Math.floor(Math.random() * 30) + 70, // 70-100
      createdAt: new Date().toISOString(),
    };
    
    await kv.set(`playlist:${id}`, playlist);
    return c.json({ playlist }, 201);
  } catch (error) {
    console.error('Error creating playlist:', error);
    return c.json({ error: 'Failed to create playlist' }, 500);
  }
});

// Get all tracks
music.get('/make-server-36806465/tracks', async (c) => {
  try {
    const tracks = await kv.getByPrefix('track:');
    return c.json({ tracks: tracks || [] });
  } catch (error) {
    console.error('Error fetching tracks:', error);
    return c.json({ error: 'Failed to fetch tracks' }, 500);
  }
});

// Add track to playlist
music.post('/make-server-36806465/playlists/:id/tracks', async (c) => {
  try {
    const playlistId = c.req.param('id');
    const body = await c.req.json();
    const { track } = body;
    
    const playlist = await kv.get(`playlist:${playlistId}`);
    if (!playlist) {
      return c.json({ error: 'Playlist not found' }, 404);
    }
    
    playlist.tracks = playlist.tracks || [];
    playlist.tracks.push(track);
    playlist.trackCount = playlist.tracks.length;
    
    await kv.set(`playlist:${playlistId}`, playlist);
    return c.json({ playlist });
  } catch (error) {
    console.error('Error adding track to playlist:', error);
    return c.json({ error: 'Failed to add track' }, 500);
  }
});

export default music;
