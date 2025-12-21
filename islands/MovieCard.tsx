import { useState } from "preact/hooks";

interface Show {
  id: string;
  startDate: string;
  ticketingUrl: string;
  chain?: 'cineville' | 'pathe';
}

interface TheaterData {
  date: string;
  theater: {
    name: string;
    address?: { city: string };
  };
  shows: Show[];
}

interface MovieCardProps {
  film: {
    title: string;
    slug: string;
    poster?: { url: string };
    duration: number;
    directors: string[];
  };
  showsByDateAndTheater: [string, TheaterData][];
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatDuration(minutes: number): string {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export default function MovieCard({ film, showsByDateAndTheater }: MovieCardProps) {
  const sortedEntries = showsByDateAndTheater.sort((a, b) => {
    const dateA = a[1].date;
    const dateB = b[1].date;
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a[1].theater.name.localeCompare(b[1].theater.name);
  });

  // Group shows by date for the horizontal date list
  const showsByDate = new Map<string, Map<string, TheaterData>>();
  sortedEntries.forEach(([_key, data]) => {
    const date = data.date;
    if (!showsByDate.has(date)) {
      showsByDate.set(date, new Map());
    }
    showsByDate.get(date)!.set(data.theater.name, data);
  });

  const [selectedDate, setSelectedDate] = useState<string>(
    showsByDate.size > 0 ? Array.from(showsByDate.keys())[0] : ''
  );

  return (
    <article
      style={{
        backgroundColor: '#1e293b',
        borderRadius: '8px',
        border: '1px solid #2f3336',
        overflow: 'hidden',
        padding: '16px'
      }}
    >
      <div
        class="movie-card-layout"
        style={{
          display: 'flex',
          gap: '16px'
        }}
      >
        {/* Poster */}
        <div
          class="movie-poster"
          style={{
            width: '200px',
            height: '300px',
            flexShrink: 0,
            backgroundColor: '#2f3336',
            borderRadius: '4px',
            overflow: 'hidden'
          }}
        >
          {film.poster?.url ? (
            <img
              src={film.poster.url}
              alt={film.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              color: '#71767b',
              textAlign: 'center',
              padding: '8px'
            }}>
              {film.title.substring(0, 20)}
            </div>
          )}
        </div>

        {/* Right side: Film Info + Theaters */}
        <div class="movie-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
          {/* Film Info */}
          <div>
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#e1e8ed'
            }}>
              {film.title}
            </h3>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '12px',
              fontSize: '14px',
              color: '#71767b'
            }}>
              {film.directors.length > 0 && (
                <span>Directed by {film.directors.join(', ')}</span>
              )}
              {film.duration > 0 && (
                <span>{formatDuration(film.duration)}</span>
              )}
            </div>

            {/* Horizontal Date List */}
            <div
              class="date-list"
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '12px',
                marginBottom: '12px',
                borderBottom: '1px solid #2f3336'
              }}
            >
              {Array.from(showsByDate.keys()).map((date) => {
                const dateStr = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short'
                });
                const isSelected = date === selectedDate;

                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: isSelected ? '#3b82f6' : '#0f1419',
                      color: isSelected ? 'white' : '#e1e8ed',
                      border: `1px solid ${isSelected ? '#3b82f6' : '#2f3336'}`,
                      borderRadius: '4px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                    }}
                  >
                    {dateStr}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theater Locations for Selected Date */}
          {selectedDate && showsByDate.get(selectedDate) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '220px',
              overflowY: 'auto'
            }}>
              {Array.from(showsByDate.get(selectedDate)!.values())
                .sort((a, b) => a.theater.name.localeCompare(b.theater.name))
                .map((data) => (
                  <div key={data.theater.name} style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    padding: '8px',
                    backgroundColor: '#0f1419',
                    borderRadius: '6px'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#e1e8ed',
                        marginBottom: '4px'
                      }}>
                        {data.theater.name}
                        {data.theater.address?.city && (
                          <span style={{
                            fontSize: '12px',
                            color: '#71767b',
                            fontWeight: 'normal',
                            marginLeft: '8px'
                          }}>
                            • {data.theater.address.city}
                          </span>
                        )}
                      </div>

                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px'
                      }}>
                        {data.shows
                          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                          .map((show) => {
                            const isPathe = show.chain === 'pathe';
                            const bgColor = isPathe ? '#f59e0b' : '#3b82f6';
                            return (
                              <a
                                key={show.id}
                                href={show.ticketingUrl || '#'}
                                target={show.ticketingUrl ? "_blank" : "_self"}
                                rel="noopener noreferrer"
                                style={{
                                  padding: '4px 10px',
                                  backgroundColor: bgColor,
                                  color: 'white',
                                  textDecoration: 'none',
                                  borderRadius: '4px',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  cursor: show.ticketingUrl ? 'pointer' : 'default',
                                  transition: 'background-color 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {formatTime(show.startDate)}
                                {show.chain && (
                                  <span style={{
                                    fontSize: '9px',
                                    opacity: 0.8,
                                    fontWeight: 'bold'
                                  }}>
                                    {isPathe ? 'P' : 'CV'}
                                  </span>
                                )}
                              </a>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
