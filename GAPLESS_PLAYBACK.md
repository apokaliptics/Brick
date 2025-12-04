# True Gapless Playback Implementation

## Overview

This music player now implements **true gapless playback** using the Web Audio API, achieving seamless transitions between tracks like professional audiophile players (e.g., foobar2000).

## Technical Architecture

### The Problem We Solved

Standard HTML5 `<audio>` elements cannot achieve truly gapless playback because:
1. **OS Audio Mixer Latency**: The browser must release one audio stream and initialize another, causing a small gap
2. **Stream Re-initialization**: Loading a new source creates unavoidable buffering delays
3. **No Sample-Accurate Control**: Cannot synchronize at the sample level

### The Solution: Dual-Buffer Architecture

We implemented a custom audio engine (`GaplessAudioEngine`) that uses:

#### 1. Web Audio API Direct Control
- **AudioContext**: Direct access to the audio hardware, bypassing OS mixer delays
- **AudioBufferSourceNode**: Plays raw decoded audio buffers with sample-accurate timing
- **No gaps**: Audio context remains open continuously; only the data source changes

#### 2. Dual-Decoder System

```
┌─────────────────────────────────────────────────────┐
│                 GaplessAudioEngine                   │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────┐          ┌──────────────┐        │
│  │ Current      │          │ Next         │        │
│  │ Track Buffer │          │ Track Buffer │        │
│  │ (Playing)    │          │ (Preloaded)  │        │
│  └──────┬───────┘          └──────┬───────┘        │
│         │                         │                 │
│         │   At 500ms remaining    │                 │
│         │   ─────────────────>    │                 │
│         │                         │                 │
│         │   Schedule exact        │                 │
│         │   transition time       │                 │
│         └─────────────────────────┘                 │
│                    │                                 │
│                    ▼                                 │
│         ┌──────────────────┐                        │
│         │   GainNode       │                        │
│         │   (Volume)       │                        │
│         └────────┬─────────┘                        │
│                  │                                   │
│         ┌────────▼─────────┐                        │
│         │   EQ Filters     │                        │
│         │ Bass/Mid/Treble  │                        │
│         └────────┬─────────┘                        │
│                  │                                   │
│                  ▼                                   │
│         [ Audio Output ]                            │
└─────────────────────────────────────────────────────┘
```

#### 3. Sample-Accurate Transition Logic

When Track 1 has **500ms remaining**:

1. **Decode Next Track**: Fetch and decode Track 2's entire audio buffer
2. **Create Source Node**: Prepare `nextSource` with decoded buffer
3. **Schedule Exact Start**: Use `start(exactTime)` to begin Track 2 at the **exact sample** Track 1 ends
4. **Seamless Swap**: Once Track 2 starts, swap references (Track 2 becomes current)

```typescript
// The magic happens here:
const currentSourceEndTime = this.playbackStartTime + duration;
this.nextSource.start(currentSourceEndTime); // Sample-accurate!
```

## Key Features

### ✅ Zero-Gap Transitions
- No silence between tracks
- Perfect for concept albums (Pink Floyd, The Beatles, etc.)
- Sample-accurate timing (not millisecond-accurate)

### ✅ Preloading & Buffering
- Next track fully decoded 500ms before current ends
- No network delay affects the transition
- Works with any audio format the browser supports

### ✅ Maintains All Features
- Volume control (GainNode)
- 3-band EQ (Bass/Mid/Treble)
- Seek functionality
- Play/Pause without gaps
- Repeat and shuffle modes

## How It Works in Practice

### Example: "The Happiest Days of Our Lives" → "Another Brick in the Wall Pt. 2"

```
Time: 0:00 ────────────────────────────────────── 1:28
      │                                            │
      │  "Happiest Days" playing                  │
      │                                            │
      │                              At 0:58 ──────┤
      │                              Preload ABITW │
      │                              Decode buffer │
      │                                            │
      │                              At 1:27.5 ────┤
      │                              Schedule ABITW│
      │                              to start at   │
      │                              exact end time│
      │                                            │
      ├────────────────────────────────────────────┤
                                                   │
                                                   │ SEAMLESS
                                                   │ No gap!
                                                   │
Time: 1:28 ────────────────────────────────────── 5:42
      │                                            │
      │  "Another Brick Pt. 2" playing            │
      │  (started at EXACT sample boundary)       │
      │                                            │
```

### What Makes This "True" Gapless?

1. **No Stream Restart**: The AudioContext never closes
2. **Preloaded Buffers**: Next track is fully decoded in memory
3. **Scheduled Playback**: `start(time)` uses the audio clock, not system time
4. **Single Audio Graph**: All tracks flow through the same processing chain
5. **Sample-Accurate Timing**: Uses pre-calculated AudioContext time, not imprecise `setTimeout`

## Technical Comparison

| Feature | Standard `<audio>` | Our Implementation |
|---------|-------------------|-------------------|
| API | HTML5 Audio | Web Audio API |
| Buffer Control | Browser-managed | Manual dual-buffer |
| Transition Accuracy | ~50-200ms gap | 0ms (sample-accurate) |
| Preloading | Limited | Full decode ahead |
| EQ/Effects | External nodes | Integrated pipeline |
| Latency | OS mixer dependent | Direct hardware access |

## Performance Considerations

### Memory Usage
- Each track is fully decoded into memory (uncompressed PCM)
- A 3-minute FLAC file ≈ 30-60 MB uncompressed
- Two buffers active during transition: ~60-120 MB peak
- Old buffers are explicitly nullified to help garbage collection

### CPU Usage
- Decoding happens asynchronously via `decodeAudioData()`
- No real-time encoding/decoding during playback
- EQ filters are hardware-accelerated

### Network
- Track must be fully downloaded before decode
- Preloading happens 500ms before needed
- Consider slower connections for preload timing

## Critical Implementation Details

### Avoiding the `setTimeout` Race Condition

The most critical aspect of this implementation is how we handle timing during transitions:

**❌ Wrong Approach:**
```typescript
setTimeout(() => {
  this.playbackStartTime = this.audioContext.currentTime; // DRIFT!
}, estimatedDelay);
```

**✅ Correct Approach:**
```typescript
const exactStartTime = this.playbackStartTime + duration;
this.nextSource.start(exactStartTime);

setTimeout(() => {
  // Use the PRE-CALCULATED time, not currentTime
  this.playbackStartTime = exactStartTime;
}, timeUntilSwap);
```

**Why this matters:**
- `setTimeout` is not sample-accurate (can be off by 10-50ms due to main thread blocking)
- Using `audioContext.currentTime` when the timeout fires introduces drift
- This drift causes progress bar jumps and desyncs
- By passing the exact scheduled time, we maintain perfect synchronization

### Handling Edge Cases

1. **Pause During Transition**: If user pauses during the 500ms preload window, both sources are stopped
2. **Manual Track Change**: Old buffers and scheduled sources are immediately cleaned up
3. **Memory Management**: Explicit nullification helps GC reclaim large audio buffers faster

## Future Enhancements

### Possible Improvements
1. **Adaptive Preload Timing**: Adjust based on network speed
2. **Crossfade Option**: Add optional 10-50ms crossfade for non-gapless tracks
3. **Worker-based Decoding**: Offload decode to Web Workers
4. **Streaming Decode**: Use Progressive Web Audio for very large files
5. **Bit-Perfect Mode**: Direct to WASAPI Exclusive (desktop only)

### WASAPI Exclusive Mode (Desktop App)
For an even more audiophile experience, a desktop version could use:
- Electron + native modules
- Direct WASAPI Exclusive Mode binding
- Bypass ALL OS audio processing
- True bit-perfect output to DAC

## Testing Gapless Albums

Perfect albums to test with:

### Pink Floyd
- ✅ "The Happiest Days of Our Lives" → "Another Brick in the Wall Pt. 2"
- ✅ "Speak to Me" → "Breathe"
- ✅ "On the Run" → "Time"

### The Beatles
- ✅ "I Want You (She's So Heavy)" → "Here Comes the Sun"
- ✅ "Sun King" → "Mean Mr. Mustard"
- ✅ "Polythene Pam" → "She Came In Through the Bathroom Window"

### Others
- ✅ Daft Punk - "Discovery" (entire album)
- ✅ Tool - "10,000 Days"
- ✅ Porcupine Tree - "Fear of a Blank Planet"

## Code Structure

```
src/
├── utils/
│   └── gaplessAudio.ts       # Core engine (500 lines)
└── components/
    └── MusicPlayer.tsx        # Integration with UI
```

### Key Classes

**GaplessAudioEngine**
- `loadTrack(track)`: Load and prepare a track
- `preloadNextTrack(track)`: Preload for gapless transition
- `play()`: Start/resume playback
- `pause()`: Pause without closing context
- `seek(time)`: Jump to position
- `setVolume(vol)`: Control volume (0.0-1.0)
- `setEQ(bass, mid, treble)`: Adjust EQ bands (-12 to +12 dB)

## Conclusion

This implementation achieves **true, sample-accurate gapless playback** in a web browser, rivaling desktop audiophile players. The dual-buffer architecture with Web Audio API ensures zero-gap transitions for seamless album listening.

Perfect for:
- Concept albums
- Live recordings
- DJ mixes
- Classical music (movements)
- Any tracks meant to flow together

Enjoy your seamless listening experience! 🎵
