# Brick v0.6.0 — Detailed Development Plan

## Overview
Brick v0.6.0 represents the transition from a strictly local, offline-focused player into a **hybrid-capable, album-centric music platform**. This release focuses on:

- Cloud library integration  
- Hybrid gapless playback  
- Major RAM and performance optimizations  
- Preparing the foundation for the Brick Web Player  
- Strengthening UX for album-first listening

---

## 1. Cloud Library Integration (“Local Cloud”)

### 1.1. New Component: `CloudMusicConnector`
A UI module for importing audio files from cloud storage providers.

**Responsibilities:**
- OAuth2 authentication (Google Drive, OneDrive)
- File/folder picker interface
- Cloud audio file listing with pagination
- Mapping cloud file metadata into Brick’s internal track structure

**Tasks:**
- [ ] Implement OAuth2 workflow
- [ ] Fetch and display cloud audio files
- [ ] Handle folder-level recursive imports
- [ ] Normalize track metadata for cloud items

---

### 1.2. IndexedDB Schema Update
Cloud imports require storing IDs instead of `File` objects.

**New Schema Fields:**
- `cloudProvider: "google" | "onedrive"`
- `cloudId: string`
- `accessToken: string`
- `filePath: string | null`
- `isCloud: boolean`

**Tasks:**
- [ ] Add migration to existing DB
- [ ] Maintain backward compatibility

---

### 1.3. Metadata Strategy (“Lazy Parsing”)
To reduce bandwidth usage:

- Extract only filename-derived metadata at import.
- Fetch and parse ID3 tags **on playback**.
- Cache parsed metadata afterward.

**Tasks:**
- [ ] Add lazy metadata mode
- [ ] Cache metadata in DB
- [ ] Integrate into playback and preload pipeline

---

## 2. Gapless Engine Upgrade (“Hybrid Cloud Gapless”)

### 2.1. Strategy: “Play 1, Fetch 2”
Ensures gapless transitions even with cloud files.

**Process:**
1. Play Track A → download full buffer.  
2. Immediately begin downloading Track B.  
3. If Track B completes before A ends → seamless gapless handoff.  
4. If not → pause with a buffer indicator (never skip).

**Tasks:**
- [ ] Add cloud-aware preloader
- [ ] Add “nextBuffer not ready” safety pause
- [ ] Improve preload timing logic

---

### 2.2. Adjust `shouldStreamWithHtml()`
Change streaming fallback rules:

- Only use `<audio>` for massive files (>200MB)
- Default to Web Audio Engine for cloud/local FLACs

**Tasks:**
- [ ] Update fallback conditions
- [ ] Test mixed queues (cloud + local)

---

### 2.3. Buffering UI
Improve user experience during cloud loading.

**UI Elements:**
- “Buffering album…” toast
- Preload spinner for next track
- Error/retry state when network issues occur

**Tasks:**
- [ ] Implement buffering indicators
- [ ] Add retry logic

---

## 3. RAM & Performance Optimizations

### 3.1. Remove Blob URL Storage
Current importer loads everything into memory; fix by using **path-based** imports.

**Solution:**
- Store `filePath` only
- Generate temporary `convertFileSrc()` URL on playback
- Revoke URLs on track changes

**Tasks:**
- [ ] Rewrite `LocalMusicUploader` import logic
- [ ] Update DB writes to store paths only

---

### 3.2. Preload Timing Heuristic (“30-second rule”)
Reduce memory usage by delaying preload.

**Rule:**
- Only preload next track when **< 30 seconds remain** in current track.

**Tasks:**
- [ ] Add `hasPreloadedNextRef`
- [ ] Add time-based preload condition

---

### 3.3. Visualizer Optimization
Reduce CPU/GPU load.

**Tasks:**
- [ ] Pause animations when tab is hidden
- [ ] Use `requestAnimationFrame` efficiently
- [ ] Reduce FFT size where possible

---

## 4. Preparation for Brick Web Player

### 4.1. Unified Engine Core
Create a shared engine that works in both Tauri and the web browser.

**Tasks:**
- [ ] Extract common engine code to a shared module
- [ ] Abstract file-loading logic (path/File/cloud)
- [ ] Build browser-safe caching system

---

### 4.2. Browser File Import
Mirror local importer using `<input type="file">`.

**Tasks:**
- [ ] Build browser local-file uploader
- [ ] Add metadata parsing via File API
- [ ] Use IndexedDB for caching

---

## 5. UI / UX Enhancements

### 5.1. Cloud Track Indicators
Small icons or badges:

- Local → disk icon  
- Cloud → cloud icon  
- Preloading → spinner  
- Buffering → glow or pulse  

**Tasks:**
- [ ] Add icons + conditional rendering

---

### 5.2. Web Player UI Parity
Prepare components for reuse:

- Now Playing  
- Seismic Monitor  
- Mini-Wall  
- Mini-Vault  

**Tasks:**
- [ ] Create responsive variations
- [ ] Ensure components run in browser environment

---

## 6. Quality Assurance & Testing

### 6.1. Gapless Albums
Test complex transitions:

- Pink Floyd — *The Wall*
- Pink Floyd — *Dark Side of the Moon*
- Beatles — Abbey Road Medley
- Queen + David Bowie — *Under Pressure*
- MCR — *The Black Parade*
- Bowie — *Station to Station*

---

### 6.2. Cloud Conditions
Simulate:

- 5 Mbps throttled network
- Latency spikes
- Connection loss mid-track

Ensure:

- Buffer state works
- No track skipping
- Resume is stable

---

### 6.3. RAM Profiling
Measure memory usage for:

- Large FLAC libraries (100–300 tracks)
- Mixed local/cloud queues
- Long listening sessions

---

## 7. Deliverables for v0.6.0

### Core Features
- [ ] Cloud library import
- [ ] Hybrid gapless playback
- [ ] RAM-optimized import system
- [ ] Buffering UI
- [ ] Smarter preload timing
- [ ] Shared engine groundwork

### Web Player Preparation
- [ ] Browser mode importer
- [ ] Engine abstraction

### Testing
- [ ] Album gapless verification
- [ ] Cloud reliability testing
- [ ] RAM performance validation

---

## 8. Versioning Strategy

- **0.5.x** → Bug fixes  
- **0.6.0** → Cloud foundations + hybrid gapless  
- **0.7.x** → UX redesign, vault expansion  
- **0.8.x** → Web Player (internal alpha)  
- **0.9.x** → Release candidate  
- **1.0.0** → Public release + website + Stripe donations  

---

_End of Document._

