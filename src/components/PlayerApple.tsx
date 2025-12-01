import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, X } from 'lucide-react';
import { Track } from '../types';
import { lastFmService, type LastFmArtistInfo } from '../utils/lastfm';

interface PlayerAppleProps {
  track: Track;
  connectionName?: string;
  isPlaying: boolean;
  onPlayPause: () => void;
  onClose: () => void;
  isPatronageUnlock?: boolean;
  onArtistClick?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  currentTime?: number;
  duration?: number;
  formatTime?: (seconds: number) => string;
}

type PlayerView = 'bio' | 'cover' | 'lyrics';

export function PlayerApple({
  track,
  connectionName,
  isPlaying,
  onPlayPause,
  onClose,
  isPatronageUnlock = false,
  onArtistClick,
  onNext,
  onPrevious,
  currentTime = 0,
  duration = 0,
  formatTime = (s: number) => '0:00',
}: PlayerAppleProps) {
  const [activeView, setActiveView] = useState<PlayerView>('cover');
  const [artistInfo, setArtistInfo] = useState<LastFmArtistInfo | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [isLoadingBio, setIsLoadingBio] = useState(false);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [localIsPlaying, setLocalIsPlaying] = useState(isPlaying);

  // Sync local state with prop changes
  useEffect(() => {
    setLocalIsPlaying(isPlaying);
  }, [isPlaying]);

  // Fetch artist bio and lyrics when track changes
  useEffect(() => {
    const fetchArtistData = async () => {
      if (!track.artist) return;

      setIsLoadingBio(true);
      try {
        const info = await lastFmService.getArtistInfo(track.artist);
        setArtistInfo(info);
      } catch (error) {
        console.error('Failed to fetch artist info:', error);
      } finally {
        setIsLoadingBio(false);
      }
    };

    const fetchLyrics = async () => {
      if (!track.artist || !track.title) return;

      setIsLoadingLyrics(true);
      try {
        // Use LRCLIB API to fetch lyrics
        const response = await fetch(
          `https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artist)}&track_name=${encodeURIComponent(track.title)}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.plainLyrics || data.syncedLyrics) {
            setLyrics(data.plainLyrics || data.syncedLyrics);
          } else {
            setLyrics(null); // Will use default lyrics
          }
        } else {
          setLyrics(null); // Will use default lyrics
        }
      } catch (error) {
        console.error('Failed to fetch lyrics from LRCLIB:', error);
        setLyrics(null); // Will use default lyrics
      } finally {
        setIsLoadingLyrics(false);
      }
    };

    fetchArtistData();
    fetchLyrics();
  }, [track.artist, track.title]);

  // Fallback lyrics if none fetched
  const defaultLyrics = `In the depths of concrete walls
Where the echoes softly call
Building dreams from brick and stone
Finding strength we've always known

Industrial soundscapes fill the air
Melodies beyond compare
In this fortress that we've made
Our foundation will not fade

[Chorus]
Concrete dreams take flight tonight
Through the shadows into light
Every beat a brick we lay
Building futures day by day`;

  // Fallback artist bio if none fetched
  const defaultArtistBio = `${track.artist} emerged as a pioneering force in the industrial music scene during the early 2000s, revolutionizing the genre with their groundbreaking fusion of harsh electronic soundscapes and ethereal, melodic elements. Their distinctive style creates a unique auditory experience that challenges conventional boundaries between noise and harmony, establishing them as visionary innovators in the post-industrial music landscape. Through their work, they've redefined what experimental music can achieve, blending the mechanical with the organic in ways that resonate deeply with listeners seeking something beyond traditional musical forms.

Formed in the heart of a sprawling industrial city, ${track.artist} draws profound inspiration from the raw power of heavy machinery and the stark, uncompromising beauty of concrete landscapes. Their music serves as both a mirror reflecting the urban environment that shaped their sound and a rebellion against the sterile modernity of contemporary life. Each track is meticulously crafted over months of experimentation, designed to evoke the complex tension between human emotion and mechanical precision. The result is a soundscape that feels both intimately personal and monumentally architectural, creating immersive environments that transport listeners to alternate realities where the boundaries between the natural and artificial dissolve.

The album "${track.album}" represents the pinnacle of ${track.artist}'s artistic evolution, a culmination of years of relentless experimentation and sonic refinement. Released to widespread critical acclaim across international music publications, it features tracks that have been prominently featured in numerous prestigious international exhibitions, architectural showcases, and contemporary art installations worldwide. The album's success helped establish ${track.artist} as a leading voice in the emerging genre of "structural sound design," with their work being praised for its architectural sensibility, emotional depth, and innovative approach to sound as a physical medium. Music critics have described their compositions as "sonic sculptures" that transform listening spaces into experiential environments.

Deeply influenced by brutalist architecture, ambient music pioneers like Brian Eno and Aphex Twin, the industrial revolution's legacy, and experimental composers from the 20th century, ${track.artist}'s work transcends traditional musical boundaries in profound ways. Their compositions are designed to feel as permanent and substantial as the concrete structures that inspire them, creating immersive sound environments that challenge listeners' perceptions of space and time. The band's approach to rhythm and texture has been compared to the works of experimental composers like John Cage and Karlheinz Stockhausen, yet maintains a distinctly contemporary edge that speaks directly to the digital age. Their use of found sounds, processed industrial noise, and carefully layered harmonics creates a musical language that is both ancient and futuristic.

Beyond their recorded work, ${track.artist} has collaborated extensively with visual artists, architects, and designers to create groundbreaking multimedia experiences that blur the lines between sound, space, and emotion. Their installations have been featured in prestigious galleries from Berlin to Tokyo, and they've contributed sound design to architectural projects, contemporary dance performances, and interactive art installations. One notable collaboration involved creating a site-specific sound installation for a brutalist building in their hometown, where the music responded to the physical architecture of the space itself. Their work continues to push the boundaries of how we experience and understand music in the modern world, challenging listeners to reconsider the relationship between sound and physical space, and between technology and human creativity.

${track.artist}'s discography spans over a decade of continuous evolution, with each release building upon their signature sound while exploring new sonic territories and conceptual frameworks. Their live performances are renowned for their immersive quality, often incorporating custom lighting design, projection mapping, and interactive elements that complement their sonic landscapes. These performances transform concert venues into total sensory experiences, where the music becomes a physical presence in the space. The band's influence extends far beyond their own recordings, inspiring a new generation of artists working at the intersection of music, architecture, and technology. They've been cited as influences by numerous emerging artists in the experimental and electronic music scenes.

In an era of disposable digital music and algorithmic composition, ${track.artist} stands as a powerful testament to the enduring power of carefully crafted, emotionally resonant sound design. Their work serves as a reminder that music can be both ephemeral and eternal, both deeply personal and universally architectural. Through their innovative approach, they've demonstrated that experimental music can be both intellectually rigorous and emotionally compelling, challenging listeners to engage with sound on multiple levels simultaneously. Their legacy continues to grow as more listeners discover the profound depth and complexity of their work, cementing their place as one of the most important voices in contemporary experimental music.`;

  const goToView = (view: PlayerView) => {
    setActiveView(view);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 50,
      backgroundColor: 'transparent',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          width: '3rem',
          height: '3rem',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(0, 0, 0, 0.2)',
          cursor: 'pointer',
          transition: 'transform 0.2s',
          zIndex: 20
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <X size={20} color="#000000" />
      </button>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: '100%'
      }}>
        {/* Carousel */}
        <div style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          width: '100%'
        }}>
          {/* Bio View */}
          {activeView === 'bio' && (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: '2rem',
              overflowY: 'auto',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              <div style={{
                maxWidth: '800px',
                width: '100%',
                textAlign: 'center',
                margin: '0 auto'
              }}>
                {/* Artist Image */}
                <div style={{
                  width: '192px',
                  height: '192px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  margin: '0 auto 2rem',
                  boxShadow: '0 16px 32px rgba(0, 0, 0, 0.3)'
                }}>
                  <img
                    src={artistInfo?.image || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400"}
                    alt={track.artist}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>

                {/* Artist Name */}
                <h1 style={{
                  fontSize: '2.5rem',
                  fontWeight: '300',
                  color: '#e0e0e0',
                  marginBottom: '1rem',
                  fontFamily: "'JetBrains Mono', 'Space Mono', monospace"
                }}>
                  {track.artist}
                </h1>

                {/* Bio Text */}
                <div style={{
                  color: '#a0a0a0',
                  fontSize: '1.125rem',
                  lineHeight: '1.75',
                  textAlign: 'left',
                  fontFamily: "'JetBrains Mono', 'Space Mono', monospace"
                }}>
                  {isLoadingBio ? (
                    <div>
                      <div style={{
                        height: '1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '0.25rem',
                        marginBottom: '0.5rem'
                      }}></div>
                      <div style={{
                        height: '1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '0.25rem',
                        marginBottom: '0.5rem'
                      }}></div>
                      <div style={{
                        height: '1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '0.25rem'
                      }}></div>
                    </div>
                  ) : (
                    <p style={{ textAlign: 'left' }}>
                      {artistInfo?.bio || defaultArtistBio}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cover View */}
          {activeView === 'cover' && (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: '2rem',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              {/* Centered Content */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden'
              }}>
                <div style={{
                  textAlign: 'center'
                }}>
                  {/* Album Cover */}
                  <div style={{
                    width: '300px',
                    height: '300px',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    margin: '0 auto 2rem',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
                  }}>
                    <img
                      src={track.coverArt || track.coverImage || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400"}
                      alt={track.album}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.currentTarget.src = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400";
                      }}
                    />
                  </div>

                  {/* Track Info */}
                  <div style={{
                    marginBottom: '1rem'
                  }}>
                    <h2 style={{
                      fontSize: '2rem',
                      fontWeight: '300',
                      color: '#e0e0e0',
                      marginBottom: '0.5rem',
                      fontFamily: "'JetBrains Mono', 'Space Mono', monospace"
                    }}>
                      {track.title || track.name || 'Untitled'}
                    </h2>
                    <button
                      onClick={onArtistClick}
                      style={{
                        fontSize: '1.25rem',
                        color: '#a0a0a0',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        marginBottom: '0.5rem',
                        fontFamily: "'JetBrains Mono', 'Space Mono', monospace"
                      }}
                    >
                      {track.artist}
                    </button>
                    <p style={{
                      fontSize: '1rem',
                      color: '#888888',
                      fontFamily: "'JetBrains Mono', 'Space Mono', monospace"
                    }}>
                      {track.album}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Bar & Controls at Bottom */}
              <div style={{
                width: '100%',
                maxWidth: '400px',
                margin: '0 auto'
              }}>
                {/* Progress Bar */}
                <div style={{
                  width: '100%',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{
                    width: '100%',
                    height: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '2px',
                    marginBottom: '0.5rem'
                  }}>
                    <div
                      style={{
                        height: '4px',
                        backgroundColor: '#d32f2f',
                        borderRadius: '2px',
                        width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.875rem',
                    color: '#a0a0a0'
                  }}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2rem'
                }}>
                  <button
                    onClick={onPrevious}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <SkipBack size={20} color="#e0e0e0" />
                  </button>

                  <button
                    onClick={() => {
                      console.log('Play/Pause button clicked, toggling local state');
                      setLocalIsPlaying(!localIsPlaying);
                      onPlayPause();
                    }}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: '#d32f2f',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      boxShadow: '0 4px 20px rgba(211, 47, 47, 0.4)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {localIsPlaying ? (
                      <Pause size={28} color="#ffffff" fill="#ffffff" />
                    ) : (
                      <Play size={28} color="#ffffff" fill="#ffffff" />
                    )}
                  </button>

                  <button
                    onClick={onNext}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <SkipForward size={20} color="#e0e0e0" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lyrics View */}
          {activeView === 'lyrics' && (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: '2rem',
              overflowY: 'auto',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              <div style={{
                maxWidth: '800px',
                width: '100%',
                textAlign: 'center',
                margin: '0 auto'
              }}>
                {/* Track Info Header */}
                <div style={{
                  marginBottom: '3rem'
                }}>
                  <h2 style={{
                    fontSize: '2.25rem',
                    fontWeight: '300',
                    color: '#e0e0e0',
                    marginBottom: '0.5rem',
                    fontFamily: "'JetBrains Mono', 'Space Mono', monospace"
                  }}>
                    {track.title || track.name || 'Untitled'}
                  </h2>
                  <button
                    onClick={onArtistClick}
                    style={{
                      fontSize: '1.5rem',
                      color: '#a0a0a0',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: "'JetBrains Mono', 'Space Mono', monospace"
                    }}
                  >
                    {track.artist}
                  </button>
                </div>

                {/* Lyrics */}
                <div style={{
                  color: '#a0a0a0',
                  fontSize: '1.125rem',
                  lineHeight: '1.75',
                  textAlign: 'left',
                  fontFamily: "'JetBrains Mono', 'Space Mono', monospace"
                }}>
                  {isLoadingLyrics ? (
                    <div>
                      <div style={{
                        height: '1.5rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '0.25rem',
                        marginBottom: '1rem'
                      }}></div>
                      <div style={{
                        height: '1.5rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '0.25rem',
                        marginBottom: '1rem'
                      }}></div>
                      <div style={{
                        height: '1.5rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '0.25rem',
                        marginBottom: '1rem'
                      }}></div>
                      <div style={{
                        height: '1.5rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '0.25rem'
                      }}></div>
                    </div>
                  ) : (
                    <pre style={{
                      whiteSpace: 'pre-wrap',
                      textAlign: 'left',
                      fontWeight: '300',
                      fontFamily: "'JetBrains Mono', 'Space Mono', monospace"
                    }}>
                      {lyrics || defaultLyrics}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* View Indicators */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.75rem',
          paddingBottom: '1.5rem'
        }}>
          {(['bio', 'cover', 'lyrics'] as PlayerView[]).map((view) => (
            <button
              key={view}
              onClick={() => goToView(view)}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: activeView === view ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s',
                transform: activeView === view ? 'scale(1.25)' : 'scale(1)'
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
