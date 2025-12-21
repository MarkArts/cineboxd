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

interface MovieCardProps {
  film: {
    title: string;
    slug: string;
    poster?: { url: string };
    duration: number;
    directors: string[];
  };
  showsByDateAndTheater: Map<string, any>;
  formatTime: (dateString: string) => string;
  formatDuration: (minutes: number) => string;
}

function MovieCard({ film, showsByDateAndTheater, formatTime, formatDuration }: MovieCardProps) {
  const sortedEntries = Array.from(showsByDateAndTheater.entries()).sort((a, b) => {
    const dateA = a[1].date;
    const dateB = b[1].date;
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a[1].theater.name.localeCompare(b[1].theater.name);
  });

  // Group shows by date for the horizontal date list
  const showsByDate = new Map<string, Map<string, any>>();
  sortedEntries.forEach(([key, data]) => {
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
        style={{
          display: 'flex',
          gap: '16px'
        }}
      >
        {/* Poster */}
        <div style={{
          width: '200px',
          height: '300px',
          flexShrink: 0,
          backgroundColor: '#2f3336',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
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
              {film.duration && (
                <span>{formatDuration(film.duration)}</span>
              )}
            </div>

            {/* Horizontal Date List */}
            <div style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '12px',
              marginBottom: '12px',
              borderBottom: '1px solid #2f3336'
            }}>
              {Array.from(showsByDate.keys()).map((date) => {
                const dateStr = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
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
                    onMouseOver={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#2f3336';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#0f1419';
                      }
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
                          .sort((a: Show, b: Show) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                          .map((show: Show) => (
                            <a
                              key={show.id}
                              href={show.ticketingUrl || '#'}
                              target={show.ticketingUrl ? "_blank" : "_self"}
                              rel="noopener noreferrer"
                              style={{
                                padding: '4px 10px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '4px',
                                fontSize: '13px',
                                fontWeight: '500',
                                cursor: show.ticketingUrl ? 'pointer' : 'default',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseOver={(e) => {
                                if (show.ticketingUrl) {
                                  e.currentTarget.style.backgroundColor = '#2563eb';
                                }
                              }}
                              onMouseOut={(e) => {
                                if (show.ticketingUrl) {
                                  e.currentTarget.style.backgroundColor = '#3b82f6';
                                }
                              }}
                            >
                              {formatTime(show.startDate)}
                            </a>
                          ))}
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

export default function Home() {
  const [username, setUsername] = useState('105424');
  const [showtimes, setShowtimes] = useState<Show[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedTheaters, setSelectedTheaters] = useState<string[]>([]);
  const [selectedFilms, setSelectedFilms] = useState<string[]>([]);
  const [showCityFilter, setShowCityFilter] = useState(false);
  const [showMovieFilter, setShowMovieFilter] = useState(false);
  const [showTheaterFilter, setShowTheaterFilter] = useState(false);

  // Initialize from URL params on mount (client-side only)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlUsername = params.get('username');
    const urlStartDate = params.get('startDate');
    const urlEndDate = params.get('endDate');
    const urlTheaters = params.get('theaters')?.split(',').filter(Boolean);
    const urlFilms = params.get('films')?.split(',').filter(Boolean);
    const urlCities = params.get('cities')?.split(',').filter(Boolean);

    if (urlUsername) setUsername(urlUsername);
    if (urlStartDate) setStartDate(urlStartDate);
    if (urlEndDate) setEndDate(urlEndDate);
    if (urlTheaters && urlTheaters.length > 0) setSelectedTheaters(urlTheaters);
    if (urlFilms && urlFilms.length > 0) setSelectedFilms(urlFilms);
    if (urlCities && urlCities.length > 0) setSelectedCities(urlCities);
  }, []);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if click is outside all dropdown areas
      if (!target.closest('[data-dropdown]')) {
        setShowCityFilter(false);
        setShowMovieFilter(false);
        setShowTheaterFilter(false);
      }
    };

    if (showCityFilter || showMovieFilter || showTheaterFilter) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCityFilter, showMovieFilter, showTheaterFilter]);


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
  const { uniqueCities, uniqueTheaters, uniqueFilms, filteredTheaters } = useMemo(() => {
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

    // Filter theaters by selected cities
    const theatersInSelectedCities = selectedCities.length > 0
      ? allTheaters.filter(theater => selectedCities.includes(theater.address?.city || ''))
      : allTheaters;

    return {
      uniqueCities: allCities,
      uniqueTheaters: allTheaters,
      uniqueFilms: allFilms,
      filteredTheaters: theatersInSelectedCities,
    };
  }, [showtimes, selectedCities]);

  // Auto-cleanup: Remove selected theaters that are not in selected cities
  useEffect(() => {
    if (selectedCities.length > 0 && selectedTheaters.length > 0) {
      const validTheaters = selectedTheaters.filter(theaterName => {
        const theater = uniqueTheaters.find(t => t.name === theaterName);
        return theater && selectedCities.includes(theater.address?.city || '');
      });

      if (validTheaters.length !== selectedTheaters.length) {
        setSelectedTheaters(validTheaters);
      }
    }
  }, [selectedCities]);

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

  const groupedFilms = useMemo(() => {
    const films = filteredShowtimes.reduce((acc, show) => {
      if (!acc[show.film.slug]) {
        acc[show.film.slug] = {
          film: show.film,
          shows: [],
          showsByDateAndTheater: new Map()
        };
      }
      acc[show.film.slug].shows.push(show);

      // Group shows by date and theater
      const showDate = show.startDate.split('T')[0];
      const key = `${showDate}_${show.theater.name}`;
      if (!acc[show.film.slug].showsByDateAndTheater.has(key)) {
        acc[show.film.slug].showsByDateAndTheater.set(key, {
          date: showDate,
          theater: show.theater,
          shows: []
        });
      }
      acc[show.film.slug].showsByDateAndTheater.get(key)!.shows.push(show);

      return acc;
    }, {} as Record<string, any>);

    return Object.values(films).sort((a, b) => a.film.title.localeCompare(b.film.title));
  }, [filteredShowtimes]);

  const films = groupedFilms;

  const handleMultiSelect = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f1419',
      color: '#e1e8ed',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#1e293b',
        borderBottom: '1px solid #2f3336',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#3b82f6'
          }}>
            Cineboxd
          </h1>

          <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Username Input */}
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #2f3336',
                backgroundColor: '#0f1419',
                color: '#e1e8ed',
                fontSize: '14px',
                width: '120px'
              }}
            />
            <button
              onClick={fetchShowtimes}
              disabled={isLoading}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                fontSize: '14px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1
              }}
            >
              {isLoading ? 'Loading...' : 'Get Shows'}
            </button>

            {/* Date Shortcuts */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setStartDate(today);
                  setEndDate(today);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid #2f3336',
                  backgroundColor: '#0f1419',
                  color: '#e1e8ed',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2f3336'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0f1419'}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const endOfWeek = new Date(today);
                  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
                  setStartDate(today.toISOString().split('T')[0]);
                  setEndDate(endOfWeek.toISOString().split('T')[0]);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid #2f3336',
                  backgroundColor: '#0f1419',
                  color: '#e1e8ed',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2f3336'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0f1419'}
              >
                This Week
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                  setStartDate(today.toISOString().split('T')[0]);
                  setEndDate(endOfMonth.toISOString().split('T')[0]);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid #2f3336',
                  backgroundColor: '#0f1419',
                  color: '#e1e8ed',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2f3336'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0f1419'}
              >
                This Month
              </button>
            </div>

            {/* Date Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: '#71767b' }}>From:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid #2f3336',
                    backgroundColor: '#0f1419',
                    color: '#e1e8ed',
                    fontSize: '14px',
                    cursor: 'pointer',
                    minWidth: '140px',
                    width: '140px'
                  }}
                />
                {startDate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStartDate('');
                    }}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #2f3336',
                      borderRadius: '3px',
                      color: '#71767b',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontSize: '14px',
                      lineHeight: '1',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#2f3336';
                      e.currentTarget.style.color = '#e1e8ed';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#1e293b';
                      e.currentTarget.style.color = '#71767b';
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <span style={{ fontSize: '12px', color: '#71767b' }}>To:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid #2f3336',
                    backgroundColor: '#0f1419',
                    color: '#e1e8ed',
                    fontSize: '14px',
                    cursor: 'pointer',
                    minWidth: '140px',
                    width: '140px'
                  }}
                />
                {endDate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEndDate('');
                    }}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #2f3336',
                      borderRadius: '3px',
                      color: '#71767b',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontSize: '14px',
                      lineHeight: '1',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#2f3336';
                      e.currentTarget.style.color = '#e1e8ed';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#1e293b';
                      e.currentTarget.style.color = '#71767b';
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div style={{ position: 'relative' }} data-dropdown="city">
              <button
                onClick={() => {
                  setShowCityFilter(!showCityFilter);
                  setShowMovieFilter(false);
                  setShowTheaterFilter(false);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid #2f3336',
                  backgroundColor: selectedCities.length > 0 ? '#3b82f6' : '#0f1419',
                  color: selectedCities.length > 0 ? 'white' : '#e1e8ed',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                All Cities {selectedCities.length > 0 && `(${selectedCities.length})`}
              </button>
              {showCityFilter && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #2f3336',
                  borderRadius: '4px',
                  padding: '8px',
                  minWidth: '200px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 1000
                }}>
                  {uniqueCities.map(city => (
                    <label key={city} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedCities.includes(city)}
                        onChange={() => handleMultiSelect(setSelectedCities)(city)}
                        style={{ marginRight: '8px' }}
                      />
                      {city}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }} data-dropdown="theater">
              <button
                onClick={() => {
                  setShowTheaterFilter(!showTheaterFilter);
                  setShowCityFilter(false);
                  setShowMovieFilter(false);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid #2f3336',
                  backgroundColor: selectedTheaters.length > 0 ? '#3b82f6' : '#0f1419',
                  color: selectedTheaters.length > 0 ? 'white' : '#e1e8ed',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                All Theaters {selectedTheaters.length > 0 ? `(${selectedTheaters.length})` : selectedCities.length > 0 ? `(${filteredTheaters.length} available)` : ''}
              </button>
              {showTheaterFilter && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #2f3336',
                  borderRadius: '4px',
                  padding: '8px',
                  minWidth: '250px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 1000
                }}>
                  {filteredTheaters.map(theater => (
                    <label key={theater.name} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedTheaters.includes(theater.name)}
                        onChange={() => handleMultiSelect(setSelectedTheaters)(theater.name)}
                        style={{ marginRight: '8px' }}
                      />
                      {theater.name} {theater.address?.city && `(${theater.address.city})`}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }} data-dropdown="movie">
              <button
                onClick={() => {
                  setShowMovieFilter(!showMovieFilter);
                  setShowCityFilter(false);
                  setShowTheaterFilter(false);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid #2f3336',
                  backgroundColor: selectedFilms.length > 0 ? '#3b82f6' : '#0f1419',
                  color: selectedFilms.length > 0 ? 'white' : '#e1e8ed',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                All Movies {selectedFilms.length > 0 && `(${selectedFilms.length})`}
              </button>
              {showMovieFilter && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #2f3336',
                  borderRadius: '4px',
                  padding: '8px',
                  minWidth: '250px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 1000
                }}>
                  {uniqueFilms.map(film => (
                    <label key={film.slug} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedFilms.includes(film.slug)}
                        onChange={() => handleMultiSelect(setSelectedFilms)(film.slug)}
                        style={{ marginRight: '8px' }}
                      />
                      {film.title}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px'
      }}>
        {isLoading && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#71767b'
          }}>
            Loading showtimes...
          </div>
        )}

        {error && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#f4212e'
          }}>
            {error}
          </div>
        )}

        {!isLoading && !error && films.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#71767b'
          }}>
            No movies found
          </div>
        )}

        {!isLoading && !error && films.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {films.map(({ film, showsByDateAndTheater }) => (
              <MovieCard
                key={film.slug}
                film={film}
                showsByDateAndTheater={showsByDateAndTheater}
                formatTime={formatTime}
                formatDuration={formatDuration}
              />
            ))}
          </div>
        )}
      </main>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}