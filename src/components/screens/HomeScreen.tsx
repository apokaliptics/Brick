import { ChosenArtistCard } from '../ChosenArtistCard';
import { BrickCard } from '../BrickCard';
import { mockArtists, mockPlaylists } from '../../data/mockData';

interface HomeScreenProps {
  onPlaylistClick: (playlistId: string) => void;
}

export function HomeScreen({ onPlaylistClick }: HomeScreenProps) {
  const { colors } = useTheme();
  const chosenArtists = mockArtists.slice(0, 2);
  const connectionPlaylists = mockPlaylists.slice(0, 4);
  const recentPlaylists = mockPlaylists.slice(0, 3);

  return (
    <div className="pb-24 px-6 pt-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="mb-2" style={{ color: colors.text.primary }}>Good Morning, Architect.</h2>
        <p style={{ color: colors.text.secondary }}>Your foundation is growing stronger.</p>
      </div>

      {/* The Payroll - Chosen Artists */}
      <section className="mb-10">
        <h3 className="mb-4">The Payroll</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {chosenArtists.map((artist) => (
            <ChosenArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      </section>

      {/* Trusted Materials - Connection Feed */}
      <section className="mb-10">
        <h3 className="mb-4">Trusted Materials</h3>
        <p className="mb-4 mono" style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
          From Your 12 Connections
        </p>
        <div className="overflow-x-auto -mx-6 px-6">
          <div className="flex gap-4" style={{ width: 'max-content' }}>
            {connectionPlaylists.map((playlist) => (
              <div key={playlist.id} style={{ width: '260px' }}>
                <BrickCard
                  playlist={playlist}
                  onClick={() => onPlaylistClick(playlist.id)}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Builds */}
      <section className="mb-6">
        <h3 className="mb-4" style={{ color: colors.text.primary }}>Recent Builds</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentPlaylists.map((playlist) => (
            <BrickCard
              key={playlist.id}
              playlist={playlist}
              onClick={() => onPlaylistClick(playlist.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
