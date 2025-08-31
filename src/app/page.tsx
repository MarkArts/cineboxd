'use client';

import { useState, useEffect, useMemo } from 'react';

interface Show {
  id: string;
  startDate: string;
  endDate: string;
  ticketingUrl: string;
  film: {
    title: string;
    slug: string;
    poster?: {
      url: string;
    };
    duration: number;
    directors: string[];
  };
  theater: {
    name: string;
    address?: {
      city: string;
    };
  };
}

const getInitialStateFromURL = () => {
  if (typeof window === 'undefined') return {
    username: '105424',
    startDate: '',
    endDate: '',
    selectedTheaters: [],
    selectedFilms: [],
    selectedCities: [],
  };

  const params = new URLSearchParams(window.location.search);
  return {
    username: params.get('username') || '105424',
    startDate: params.get('startDate') || '',
    endDate: params.get('endDate') || '',
    selectedTheaters: params.get('theaters')?.split(',').filter(Boolean) || [],
    selectedFilms: params.get('films')?.split(',').filter(Boolean) || [],
    selectedCities: params.get('cities')?.split(',').filter(Boolean) || [],
  };
};

export default function Home() {
  const [initialState] = useState(getInitialStateFromURL());
  const [username, setUsername] = useState(initialState.username);
  const [showtimes, setShowtimes] = useState<Show[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const [startDate, setStartDate] = useState(initialState.startDate);
  const [endDate, setEndDate] = useState(initialState.endDate);
  const [selectedCities, setSelectedCities] = useState<string[]>(initialState.selectedCities);
  const [selectedTheaters, setSelectedTheaters] = useState<string[]>(initialState.selectedTheaters);
  const [selectedFilms, setSelectedFilms] = useState<string[]>(initialState.selectedFilms);

  // URL synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const params = new URLSearchParams();
    if (username && username !== '105424') params.set('username', username);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (selectedCities.length > 0) params.set('cities', selectedCities.join(','));
    if (selectedTheaters.length > 0) params.set('theaters', selectedTheaters.join(','));
    if (selectedFilms.length > 0) params.set('films', selectedFilms.join(','));
    
    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    
    try {
      window.history.replaceState({ path: newUrl }, '', newUrl);
    } catch (e) {
      console.warn("Could not update URL");
    }
  }, [username, startDate, endDate, selectedCities, selectedTheaters, selectedFilms]);

  const fetchShowtimes = async () => {
    if (!username.trim()) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cineboxd?username=${username.trim()}`);
      if (!response.ok) {
        throw new Error(response.status === 500 ? 'User not found' : 'API error');
      }
      const data = await response.json();
      setShowtimes(data?.data?.showtimes?.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
      setShowtimes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShowtimes();
  }, []);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  };

  const formatDuration = (minutes: number) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Extract unique filter options
  const { uniqueCities, uniqueTheaters, uniqueFilms } = useMemo(() => {
    const theatersMap = new Map();
    const filmsMap = new Map();
    
    showtimes.forEach(show => {
      if (show.theater && !theatersMap.has(show.theater.name)) {
        theatersMap.set(show.theater.name, show.theater);
      }
      if (show.film && !filmsMap.has(show.film.slug)) {
        filmsMap.set(show.film.slug, show.film);
      }
    });

    const allTheaters = Array.from(theatersMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const allFilms = Array.from(filmsMap.values()).sort((a, b) => a.title.localeCompare(b.title));

    const citiesSet = new Set<string>();
    allTheaters.forEach(theater => {
      if (theater.address?.city) citiesSet.add(theater.address.city);
    });
    const allCities = Array.from(citiesSet).sort();

    return {
      uniqueCities: allCities,
      uniqueTheaters: allTheaters,
      uniqueFilms: allFilms,
    };
  }, [showtimes]);

  // Filter showtimes based on selected filters
  const filteredShowtimes = useMemo(() => {
    let filtered = showtimes;
    
    if (startDate) {
      filtered = filtered.filter(s => s.startDate.split('T')[0] >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(s => s.startDate.split('T')[0] <= endDate);
    }
    if (selectedTheaters.length > 0) {
      filtered = filtered.filter(s => selectedTheaters.includes(s.theater.name));
    }
    if (selectedFilms.length > 0) {
      filtered = filtered.filter(s => selectedFilms.includes(s.film.slug));
    }
    if (selectedCities.length > 0) {
      filtered = filtered.filter(s => selectedCities.includes(s.theater.address?.city || ''));
    }
    
    return filtered;
  }, [showtimes, startDate, endDate, selectedTheaters, selectedFilms, selectedCities]);

  const groupedFilms = filteredShowtimes.reduce((acc, show) => {
    if (!acc[show.film.slug]) {
      acc[show.film.slug] = {
        film: show.film,
        shows: []
      };
    }
    acc[show.film.slug].shows.push(show);
    return acc;
  }, {} as Record<string, { film: Show['film']; shows: Show[] }>);

  const films = Object.values(groupedFilms);

  const handleMultiSelect = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <header style={{
        padding: '1rem',
        borderBottom: '1px solid #334155',
        backgroundColor: '#1e293b'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div>
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="50" cy="50" r="46" stroke="#3b82f6" strokeWidth="4" fill="rgba(59, 130, 246, 0.1)"/>
              <circle cx="35" cy="50" r="8" fill="#3b82f6"/>
              <circle cx="65" cy="50" r="8" fill="#3b82f6"/>
              <path d="M20 30H80" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round"/>
              <path d="M20 70H80" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>Cineboxd</h1>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>Find cinema showtimes for your watchlist</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Letterboxd username"
              style={{
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #475569',
                backgroundColor: '#334155',
                color: '#e2e8f0',
                fontSize: '0.875rem',
                width: '200px'
              }}
            />
            <button
              onClick={fetchShowtimes}
              disabled={isLoading}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: 'white',
                fontSize: '0.875rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              {isLoading ? 'Loading...' : 'Search'}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: '1px solid #475569',
                backgroundColor: showFilters ? '#3b82f6' : '#334155',
                color: 'white',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/>
              </svg>
              Filters
              {(selectedCities.length + selectedTheaters.length + selectedFilms.length + (startDate ? 1 : 0) + (endDate ? 1 : 0)) > 0 && (
                <span style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 'bold'
                }}>
                  {selectedCities.length + selectedTheaters.length + selectedFilms.length + (startDate ? 1 : 0) + (endDate ? 1 : 0)}
                </span>
              )}
            </button>
          </div>
        </div>
        
        {/* Filter Panel */}
        {showFilters && (
          <div style={{
            borderTop: '1px solid #334155',
            padding: '1rem',
            backgroundColor: '#334155'
          }}>
            <div style={{
              maxWidth: '1200px',
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              {/* Date Range */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 'bold' }}>
                  Date Range
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #475569',
                      backgroundColor: '#1e293b',
                      color: '#e2e8f0',
                      fontSize: '0.875rem'
                    }}
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #475569',
                      backgroundColor: '#1e293b',
                      color: '#e2e8f0',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setStartDate(today);
                      setEndDate(today);
                    }}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #475569',
                      backgroundColor: '#374151',
                      color: '#d1d5db',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const tomorrow = new Date(today);
                      tomorrow.setDate(today.getDate() + 1);
                      const tomorrowStr = tomorrow.toISOString().split('T')[0];
                      setStartDate(tomorrowStr);
                      setEndDate(tomorrowStr);
                    }}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #475569',
                      backgroundColor: '#374151',
                      color: '#d1d5db',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Tomorrow
                  </button>
                  <button
                    onClick={() => {
                      const today = new Date();
                      const nextWeek = new Date(today);
                      nextWeek.setDate(today.getDate() + 7);
                      setStartDate(today.toISOString().split('T')[0]);
                      setEndDate(nextWeek.toISOString().split('T')[0]);
                    }}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #475569',
                      backgroundColor: '#374151',
                      color: '#d1d5db',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    This Week
                  </button>
                </div>
              </div>

              {/* Cities */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 'bold' }}>
                  Cities ({uniqueCities.length})
                </label>
                <div style={{ 
                  maxHeight: '150px', 
                  overflowY: 'auto',
                  border: '1px solid #475569',
                  borderRadius: '0.375rem',
                  backgroundColor: '#1e293b',
                  padding: '0.5rem'
                }}>
                  {uniqueCities.map(city => (
                    <label key={city} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      padding: '0.25rem 0',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedCities.includes(city)}
                        onChange={() => handleMultiSelect(setSelectedCities)(city)}
                        style={{ margin: 0 }}
                      />
                      {city}
                    </label>
                  ))}
                </div>
              </div>

              {/* Theaters */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 'bold' }}>
                  Theaters ({uniqueTheaters.length})
                </label>
                <div style={{ 
                  maxHeight: '150px', 
                  overflowY: 'auto',
                  border: '1px solid #475569',
                  borderRadius: '0.375rem',
                  backgroundColor: '#1e293b',
                  padding: '0.5rem'
                }}>
                  {uniqueTheaters.map(theater => (
                    <label key={theater.name} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      padding: '0.25rem 0',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedTheaters.includes(theater.name)}
                        onChange={() => handleMultiSelect(setSelectedTheaters)(theater.name)}
                        style={{ margin: 0 }}
                      />
                      {theater.name} {theater.address?.city && `(${theater.address.city})`}
                    </label>
                  ))}
                </div>
              </div>

              {/* Films */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 'bold' }}>
                  Films ({uniqueFilms.length})
                </label>
                <div style={{ 
                  maxHeight: '150px', 
                  overflowY: 'auto',
                  border: '1px solid #475569',
                  borderRadius: '0.375rem',
                  backgroundColor: '#1e293b',
                  padding: '0.5rem'
                }}>
                  {uniqueFilms.map(film => (
                    <label key={film.slug} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      padding: '0.25rem 0',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedFilms.includes(film.slug)}
                        onChange={() => handleMultiSelect(setSelectedFilms)(film.slug)}
                        style={{ margin: 0 }}
                      />
                      {film.title}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Clear Filters */}
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setSelectedCities([]);
                  setSelectedTheaters([]);
                  setSelectedFilms([]);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #475569',
                  backgroundColor: '#374151',
                  color: '#d1d5db',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </header>

      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 1rem'
      }}>
        {isLoading && (
          <div style={{
            textAlign: 'center',
            padding: '4rem 0',
            color: '#94a3b8'
          }}>
            Loading watchlist...
          </div>
        )}

        {error && (
          <div style={{
            textAlign: 'center',
            padding: '4rem 0',
            color: '#ef4444'
          }}>
            {error}
          </div>
        )}

        {!isLoading && !error && films.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '4rem 0',
            color: '#94a3b8'
          }}>
            No movies found. Check your username or try a different user.
          </div>
        )}

        {!isLoading && !error && films.length > 0 && (
          <div>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 'bold' }}>
              {films.length} {films.length === 1 ? 'movie' : 'movies'} found
            </h2>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              maxWidth: '100%'
            }}>
              {films.map(({ film, shows }) => (
                <div
                  key={film.slug}
                  style={{
                    backgroundColor: '#1e293b',
                    borderRadius: '0.75rem',
                    border: '1px solid #334155',
                    overflow: 'hidden',
                    height: '300px',
                    display: 'flex'
                  }}
                >
                  {/* Full height poster */}
                  <div style={{
                    width: '200px',
                    height: '100%',
                    flexShrink: 0,
                    backgroundColor: '#334155',
                    overflow: 'hidden'
                  }}>
                    {film.poster?.url ? (
                      <img
                        src={film.poster.url}
                        alt={`${film.title} poster`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement.innerHTML = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: #64748b; font-weight: bold;">${film.title.substring(0, 3).toUpperCase()}</div>`;
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        color: '#64748b',
                        fontWeight: 'bold'
                      }}>
                        {film.title.substring(0, 3).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Movie content */}
                  <div style={{
                    flex: '1',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0
                  }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <h3 style={{
                        margin: '0 0 0.75rem 0',
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        lineHeight: '1.2',
                        color: '#e2e8f0'
                      }}>
                        {film.title}
                      </h3>
                      
                      <div style={{
                        fontSize: '1rem',
                        color: '#94a3b8',
                        marginBottom: '0.5rem'
                      }}>
                        {film.directors.join(', ')}
                        {film.duration && ` • ${formatDuration(film.duration)}`}
                      </div>
                      
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#64748b'
                      }}>
                        {shows.length} showtime{shows.length !== 1 ? 's' : ''} available
                      </div>
                    </div>
                    
                    {/* Showtimes grid */}
                    <div style={{
                      flex: '1',
                      overflow: 'auto',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: '0.75rem',
                      alignContent: 'start'
                    }}>
                      {shows.slice(0, 8).map(show => (
                        <div key={show.id} style={{
                          padding: '0.75rem',
                          backgroundColor: '#334155',
                          borderRadius: '0.5rem',
                          border: '1px solid #475569',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.75rem'
                        }}>
                          <div style={{
                            flex: '1',
                            minWidth: 0
                          }}>
                            <div style={{ 
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              color: '#e2e8f0',
                              marginBottom: '0.25rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {show.theater.name}
                            </div>
                            {show.theater.address?.city && (
                              <div style={{ 
                                fontSize: '0.75rem',
                                color: '#94a3b8'
                              }}>
                                {show.theater.address.city}
                              </div>
                            )}
                          </div>
                          {show.ticketingUrl ? (
                            <a
                              href={show.ticketingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                flexShrink: 0,
                                transition: 'background-color 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                            >
                              {formatTime(show.startDate)}
                            </a>
                          ) : (
                            <span style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#374151',
                              color: '#9ca3af',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              flexShrink: 0
                            }}>
                              {formatTime(show.startDate)}
                            </span>
                          )}
                        </div>
                      ))}
                      {shows.length > 8 && (
                        <div style={{
                          padding: '0.75rem',
                          backgroundColor: '#374151',
                          borderRadius: '0.5rem',
                          border: '1px solid #475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.875rem',
                          color: '#94a3b8',
                          fontStyle: 'italic'
                        }}>
                          +{shows.length - 8} more showtimes
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
