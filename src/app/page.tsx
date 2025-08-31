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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('title');

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
    
    // Apply search query filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(s => 
        s.film.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.film.directors.some(d => d.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.theater.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.theater.address?.city?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
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
  }, [showtimes, startDate, endDate, selectedTheaters, selectedFilms, selectedCities, searchQuery]);

  const groupedFilms = useMemo(() => {
    const films = filteredShowtimes.reduce((acc, show) => {
      if (!acc[show.film.slug]) {
        acc[show.film.slug] = {
          film: show.film,
          shows: [],
          showsByDate: new Map()
        };
      }
      acc[show.film.slug].shows.push(show);
      
      // Group shows by date
      const showDate = show.startDate.split('T')[0];
      if (!acc[show.film.slug].showsByDate.has(showDate)) {
        acc[show.film.slug].showsByDate.set(showDate, []);
      }
      acc[show.film.slug].showsByDate.get(showDate)!.push(show);
      
      return acc;
    }, {} as Record<string, { film: Show['film']; shows: Show[]; showsByDate: Map<string, Show[]> }>);

    // Sort films based on selected criteria
    return Object.values(films).sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.film.title.localeCompare(b.film.title);
        case 'showtimes':
          return b.shows.length - a.shows.length;
        case 'date':
          const aNextShow = a.shows.sort((x, y) => new Date(x.startDate).getTime() - new Date(y.startDate).getTime())[0];
          const bNextShow = b.shows.sort((x, y) => new Date(x.startDate).getTime() - new Date(y.startDate).getTime())[0];
          return new Date(aNextShow.startDate).getTime() - new Date(bNextShow.startDate).getTime();
        default:
          return 0;
      }
    });
  }, [filteredShowtimes, sortBy]);

  const films = groupedFilms;

  const handleMultiSelect = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0f1c',
      color: '#f1f5f9',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <header style={{
        padding: '1.25rem',
        borderBottom: '2px solid #1e293b',
        backgroundColor: '#0f172a',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <svg width="40" height="40" viewBox="0 0 100 100" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="50" cy="50" r="46" stroke="#3b82f6" strokeWidth="4" fill="rgba(59, 130, 246, 0.1)"/>
              <circle cx="35" cy="50" r="8" fill="#3b82f6"/>
              <circle cx="65" cy="50" r="8" fill="#3b82f6"/>
              <path d="M20 30H80" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round"/>
              <path d="M20 70H80" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: 'bold', color: '#f8fafc' }}>Cineboxd</h1>
              <p style={{ margin: 0, fontSize: '1rem', color: '#cbd5e1' }}>Find cinema showtimes for your watchlist</p>
            </div>
          </div>
          
          <div style={{ 
            marginLeft: 'auto', 
            display: 'flex', 
            gap: '0.75rem', 
            alignItems: 'center', 
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, minWidth: '300px' }}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter Letterboxd username"
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: '2px solid #334155',
                  backgroundColor: '#1e293b',
                  color: '#f1f5f9',
                  fontSize: '1rem',
                  flex: 1,
                  minWidth: '200px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
              <button
                onClick={fetchShowtimes}
                disabled={isLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: isLoading ? '#64748b' : '#3b82f6',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  boxShadow: isLoading ? 'none' : '0 2px 4px rgba(59, 130, 246, 0.3)',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => {
                  if (!isLoading) e.currentTarget.style.backgroundColor = '#2563eb';
                }}
                onMouseOut={(e) => {
                  if (!isLoading) e.currentTarget.style.backgroundColor = '#3b82f6';
                }}
              >
                {isLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #ffffff30',
                      borderTop: '2px solid #ffffff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Loading...
                  </div>
                ) : 'Search'}
              </button>
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                padding: '0.75rem 1.25rem',
                borderRadius: '0.5rem',
                border: `2px solid ${showFilters ? '#3b82f6' : '#334155'}`,
                backgroundColor: showFilters ? '#3b82f6' : '#1e293b',
                color: showFilters ? 'white' : '#cbd5e1',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                boxShadow: showFilters ? '0 2px 4px rgba(59, 130, 246, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                position: 'relative'
              }}
              onMouseOver={(e) => {
                if (!showFilters) {
                  e.currentTarget.style.borderColor = '#475569';
                  e.currentTarget.style.backgroundColor = '#334155';
                }
              }}
              onMouseOut={(e) => {
                if (!showFilters) {
                  e.currentTarget.style.borderColor = '#334155';
                  e.currentTarget.style.backgroundColor = '#1e293b';
                }
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/>
              </svg>
              Filters
              {(selectedCities.length + selectedTheaters.length + selectedFilms.length + (startDate ? 1 : 0) + (endDate ? 1 : 0)) > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  border: '2px solid #0f172a',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
                }}>
                  {selectedCities.length + selectedTheaters.length + selectedFilms.length + (startDate ? 1 : 0) + (endDate ? 1 : 0)}
                </div>
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
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '2rem 1.25rem'
      }}>
        {isLoading && (
          <div style={{
            textAlign: 'center',
            padding: '6rem 0',
            backgroundColor: '#1e293b',
            borderRadius: '1rem',
            border: '2px solid #334155'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              border: '4px solid #334155',
              borderTop: '4px solid #3b82f6',
              borderRadius: '50%',
              margin: '0 auto 2rem',
              animation: 'spin 1s linear infinite'
            }}></div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f1f5f9', marginBottom: '0.5rem' }}>
              Loading your watchlist...
            </h2>
            <p style={{ fontSize: '1rem', color: '#cbd5e1' }}>
              Fetching movies and showtimes from Dutch cinemas
            </p>
          </div>
        )}

        {error && (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            backgroundColor: '#7f1d1d',
            borderRadius: '1rem',
            border: '2px solid #b91c1c'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              backgroundColor: '#dc2626',
              borderRadius: '50%',
              margin: '0 auto 2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4"/>
                <path d="M12 16h.01"/>
              </svg>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fef2f2', marginBottom: '0.5rem' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '1rem', color: '#fecaca', marginBottom: '1.5rem' }}>
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && films.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            backgroundColor: '#1e293b',
            borderRadius: '1rem',
            border: '2px solid #334155'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              backgroundColor: '#334155',
              borderRadius: '50%',
              margin: '0 auto 2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-1.414-.586H14l-3-3 2.5-2.5L18 9.5l3 3v2.5z"/>
              </svg>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f1f5f9', marginBottom: '0.5rem' }}>
              No movies found
            </h2>
            <p style={{ fontSize: '1rem', color: '#cbd5e1' }}>
              {searchQuery ? 'Try adjusting your search terms or filters.' : 'Check your username or try a different Letterboxd user.'}
            </p>
          </div>
        )}

        {!isLoading && !error && films.length > 0 && (
          <div>
            {/* Search and Sort Controls */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
              gap: '1rem',
              flexWrap: 'wrap',
              padding: '1.5rem',
              backgroundColor: '#1e293b',
              borderRadius: '1rem',
              border: '2px solid #334155'
            }}>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#f8fafc', marginBottom: '0.25rem' }}>
                  {films.length} {films.length === 1 ? 'movie' : 'movies'} found
                </h2>
                <p style={{ fontSize: '1rem', color: '#cbd5e1', margin: 0 }}>
                  {filteredShowtimes.length} total showtimes available
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search movies, directors, theaters..."
                    style={{
                      padding: '0.75rem 1rem 0.75rem 2.5rem',
                      borderRadius: '0.5rem',
                      border: '2px solid #334155',
                      backgroundColor: '#0f172a',
                      color: '#f1f5f9',
                      fontSize: '1rem',
                      width: '300px',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#334155'}
                  />
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#94a3b8" 
                    strokeWidth="2"
                    style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)'
                    }}
                  >
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                
                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: '2px solid #334155',
                    backgroundColor: '#0f172a',
                    color: '#f1f5f9',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="title">Sort by Title</option>
                  <option value="date">Sort by Next Showtime</option>
                  <option value="showtimes">Sort by Most Showtimes</option>
                </select>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2rem',
              maxWidth: '100%'
            }}>
              {films.map(({ film, shows, showsByDate }) => {
                const sortedDates = Array.from(showsByDate.keys()).sort();
                return (
                  <article
                    key={film.slug}
                    style={{
                      backgroundColor: '#1e293b',
                      borderRadius: '1rem',
                      border: '2px solid #334155',
                      overflow: 'hidden',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    role="article"
                    aria-labelledby={`movie-${film.slug}`}
                  >
                    {/* Movie Header */}
                    <div style={{
                      display: 'flex',
                      gap: '2rem',
                      padding: '2rem',
                      borderBottom: '2px solid #334155'
                    }}>
                      {/* Poster */}
                      <div style={{
                        width: '140px',
                        height: '210px',
                        flexShrink: 0,
                        backgroundColor: '#334155',
                        borderRadius: '0.75rem',
                        overflow: 'hidden',
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
                      }}>
                        {film.poster?.url ? (
                          <img
                            src={film.poster.url}
                            alt={`${film.title} movie poster`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.parentElement) {
                                e.currentTarget.parentElement.innerHTML = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: #94a3b8; font-weight: bold; text-align: center; padding: 1rem;">${film.title.substring(0, 10).toUpperCase()}</div>`;
                              }
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
                            color: '#94a3b8',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            padding: '1rem'
                          }}>
                            {film.title.substring(0, 10).toUpperCase()}
                          </div>
                        )}
                      </div>
                      
                      {/* Movie Info */}
                      <div style={{ flex: '1', minWidth: 0 }}>
                        <h3 
                          id={`movie-${film.slug}`}
                          style={{
                            margin: '0 0 1rem 0',
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            lineHeight: '1.1',
                            color: '#f8fafc'
                          }}
                        >
                          {film.title}
                        </h3>
                        
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '1.5rem',
                          marginBottom: '1rem'
                        }}>
                          {film.directors.length > 0 && (
                            <div>
                              <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Director</div>
                              <div style={{ fontSize: '1.125rem', color: '#f1f5f9', fontWeight: '500' }}>
                                {film.directors.join(', ')}
                              </div>
                            </div>
                          )}
                          {film.duration && (
                            <div>
                              <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Runtime</div>
                              <div style={{ fontSize: '1.125rem', color: '#f1f5f9', fontWeight: '500' }}>
                                {formatDuration(film.duration)}
                              </div>
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Showtimes</div>
                            <div style={{ fontSize: '1.125rem', color: '#f1f5f9', fontWeight: '500' }}>
                              {shows.length} available
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Showtimes by Date */}
                    <div style={{ padding: '2rem' }}>
                      {sortedDates.map((date, dateIndex) => {
                        const dateShows = showsByDate.get(date) || [];
                        const theaters = dateShows.reduce((acc, show) => {
                          const theaterName = show.theater.name;
                          if (!acc[theaterName]) {
                            acc[theaterName] = {
                              theater: show.theater,
                              shows: []
                            };
                          }
                          acc[theaterName].shows.push(show);
                          return acc;
                        }, {} as Record<string, { theater: Show['theater']; shows: Show[] }>);

                        return (
                          <div 
                            key={date} 
                            style={{ 
                              marginBottom: dateIndex < sortedDates.length - 1 ? '2rem' : 0 
                            }}
                          >
                            <h4 style={{
                              fontSize: '1.25rem',
                              fontWeight: 'bold',
                              color: '#f8fafc',
                              marginBottom: '1rem',
                              padding: '0.75rem 1rem',
                              backgroundColor: '#334155',
                              borderRadius: '0.5rem',
                              border: '1px solid #475569'
                            }}>
                              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </h4>
                            
                            <div style={{
                              display: 'grid',
                              gap: '1rem',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))'
                            }}>
                              {Object.values(theaters).map(({ theater, shows: theaterShows }) => (
                                <div
                                  key={theater.name}
                                  style={{
                                    backgroundColor: '#334155',
                                    borderRadius: '0.75rem',
                                    border: '1px solid #475569',
                                    padding: '1.25rem'
                                  }}
                                >
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '1rem'
                                  }}>
                                    <div>
                                      <h5 style={{
                                        fontSize: '1.125rem',
                                        fontWeight: '600',
                                        color: '#f1f5f9',
                                        margin: '0 0 0.25rem 0'
                                      }}>
                                        {theater.name}
                                      </h5>
                                      {theater.address?.city && (
                                        <p style={{
                                          fontSize: '1rem',
                                          color: '#cbd5e1',
                                          margin: 0
                                        }}>
                                          {theater.address.city}
                                        </p>
                                      )}
                                    </div>
                                    <div style={{
                                      backgroundColor: '#1e293b',
                                      padding: '0.5rem 0.75rem',
                                      borderRadius: '0.375rem',
                                      fontSize: '0.875rem',
                                      color: '#94a3b8'
                                    }}>
                                      {theaterShows.length} show{theaterShows.length !== 1 ? 's' : ''}
                                    </div>
                                  </div>
                                  
                                  <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '0.75rem'
                                  }}>
                                    {theaterShows
                                      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                                      .map(show => (
                                        <a
                                          key={show.id}
                                          href={show.ticketingUrl || '#'}
                                          target={show.ticketingUrl ? "_blank" : "_self"}
                                          rel={show.ticketingUrl ? "noopener noreferrer" : undefined}
                                          style={{
                                            padding: '0.75rem 1.25rem',
                                            backgroundColor: show.ticketingUrl ? '#3b82f6' : '#6b7280',
                                            color: 'white',
                                            textDecoration: 'none',
                                            borderRadius: '0.5rem',
                                            fontSize: '1rem',
                                            fontWeight: '600',
                                            cursor: show.ticketingUrl ? 'pointer' : 'default',
                                            boxShadow: show.ticketingUrl ? '0 2px 4px rgba(59, 130, 246, 0.3)' : 'none',
                                            transition: 'all 0.2s',
                                            border: 'none',
                                            outline: 'none'
                                          }}
                                          onMouseOver={(e) => {
                                            if (show.ticketingUrl) {
                                              e.currentTarget.style.backgroundColor = '#2563eb';
                                              e.currentTarget.style.transform = 'translateY(-1px)';
                                            }
                                          }}
                                          onMouseOut={(e) => {
                                            if (show.ticketingUrl) {
                                              e.currentTarget.style.backgroundColor = '#3b82f6';
                                              e.currentTarget.style.transform = 'translateY(0)';
                                            }
                                          }}
                                        >
                                          {formatTime(show.startDate)}
                                        </a>
                                      ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
