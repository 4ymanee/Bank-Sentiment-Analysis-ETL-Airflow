import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Star,
  ThumbsUp,
  ThumbsDown,
  Smile,
  MapPin,
  Calendar,
  RefreshCw,
  Search,
  Award,
  MessageSquare,

  Info,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Phone,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from 'react-simple-maps';

const API_BASE = "http://localhost:8000";

// Real geographic coordinates (lat/lng) for Morocco cities
const MOROCCO_COORDS = {
  "Fnideq": { lat: 35.8467, lng: -5.3597 },
  "Tanger": { lat: 35.7673, lng: -5.7998 },
  "Oujda": { lat: 34.6814, lng: -1.9086 },
  "Fès": { lat: 34.0333, lng: -5.0000 },
  "Meknès": { lat: 33.8935, lng: -5.5473 },
  "Kénitra": { lat: 34.2610, lng: -6.5802 },
  "Rabat": { lat: 34.0209, lng: -6.8416 },
  "Casablanca": { lat: 33.5731, lng: -7.5898 },
  "El Jadida": { lat: 33.2542, lng: -8.5088 },
  "Marrakech": { lat: 31.6295, lng: -7.9811 },
  "Safi": { lat: 32.2994, lng: -9.2371 },
  "Agadir": { lat: 30.4278, lng: -9.5981 },
  "Laayoune": { lat: 27.1471, lng: -13.1959 },
  "Dakhla": { lat: 23.7031, lng: -15.9547 },
};

const CustomSelect = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="custom-select-container" ref={selectRef}>
      <div 
        className={`custom-select-header ${isOpen ? 'open' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={14} className={`select-arrow ${isOpen ? 'open' : ''}`} />
      </div>
      {isOpen && (
        <div className="custom-select-dropdown animate-fade-in">
          <div 
            className={`custom-select-option ${value === "" ? 'selected' : ''}`}
            onClick={() => { onChange(""); setIsOpen(false); }}
          >
            {placeholder}
          </div>
          {options.map((opt, idx) => (
            <div 
              key={idx}
              className={`custom-select-option ${value === opt.value ? 'selected' : ''}`}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  // Theme State
  const [darkMode, setDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Navigation State
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard", "reviews", "agencies"

  // Filter States
  const [filters, setFilters] = useState({
    city: "",
    agency: "",
    sentiment: "",
    rating: "",
    startDate: "",
    endDate: ""
  });

  // Lists for dropdown filters
  const [cities, setCities] = useState([]);
  const [agencies, setAgencies] = useState([]);

  // API Data States
  const [kpis, setKpis] = useState({
    total_reviews: 0,
    average_rating: 0,
    positive_reviews: 0,
    negative_reviews: 0,
    neutral_reviews: 0,
    average_sentiment_label: "Neutral"
  });
  const [trends, setTrends] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [rankedAgencies, setRankedAgencies] = useState([]);
  const [reviewsData, setReviewsData] = useState({ total: 0, page: 1, limit: 8, reviews: [] });


  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Local states for UI
  const [hoveredCity, setHoveredCity] = useState(null);
  const [reviewPage, setReviewPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch filters (Cities & Agencies) - Loaded once on start
  const fetchFilters = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/filters`);
      if (!res.ok) throw new Error("Failed to fetch filter lists");
      const data = await res.json();
      setCities(data.cities);
      setAgencies(data.agencies);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Dashboard Stats/KPIs
  const fetchKPIs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.city) params.append("city", filters.city);
      if (filters.agency) params.append("agency", filters.agency);
      if (filters.sentiment) params.append("sentiment", filters.sentiment);
      if (filters.rating) params.append("rating", filters.rating);
      if (filters.startDate) params.append("start_date", filters.startDate);
      if (filters.endDate) params.append("end_date", filters.endDate);

      const res = await fetch(`${API_BASE}/api/stats?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch metrics");
      const data = await res.json();
      setKpis(data);
    } catch (err) {
      setError("Unable to connect to the backend server. Please verify the backend container is running.");
      console.error(err);
    }
  }, [filters]);

  // Fetch Monthly Sentiment Evolution
  const fetchTrends = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.city) params.append("city", filters.city);
      if (filters.agency) params.append("agency", filters.agency);

      const res = await fetch(`${API_BASE}/api/trends?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch trend data");
      const data = await res.json();
      setTrends(data);
    } catch (err) {
      console.error(err);
    }
  }, [filters.city, filters.agency]);

  // Fetch Review Distribution (1-5 Stars)
  const fetchDistribution = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.city) params.append("city", filters.city);
      if (filters.agency) params.append("agency", filters.agency);
      if (filters.sentiment) params.append("sentiment", filters.sentiment);
      if (filters.rating) params.append("rating", filters.rating);
      if (filters.startDate) params.append("start_date", filters.startDate);
      if (filters.endDate) params.append("end_date", filters.endDate);

      const res = await fetch(`${API_BASE}/api/distribution?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch rating distribution");
      const data = await res.json();
      setDistribution(data);
    } catch (err) {
      console.error(err);
    }
  }, [filters]);

  // Fetch Ranked Agencies
  const fetchRankedAgencies = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agencies`);
      if (!res.ok) throw new Error("Failed to fetch agency rankings");
      const data = await res.json();
      setRankedAgencies(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch Paginated Reviews Feed
  const fetchReviews = useCallback(async (pageVal = 1) => {
    try {
      const params = new URLSearchParams();
      params.append("page", pageVal.toString());
      params.append("limit", "8");
      if (filters.city) params.append("city", filters.city);
      if (filters.agency) params.append("agency", filters.agency);
      if (filters.sentiment) params.append("sentiment", filters.sentiment);
      if (filters.rating) params.append("rating", filters.rating);
      if (filters.startDate) params.append("start_date", filters.startDate);
      if (filters.endDate) params.append("end_date", filters.endDate);

      const res = await fetch(`${API_BASE}/api/reviews?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      const data = await res.json();
      setReviewsData(data);
    } catch (err) {
      console.error(err);
    }
  }, [filters]);



  // Combined Refresh Handler
  const refreshData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    setError(null);
    await Promise.all([
      fetchKPIs(),
      fetchTrends(),
      fetchDistribution(),
      fetchRankedAgencies(),
      fetchReviews(reviewPage)
    ]);
    setRefreshing(false);
  }, [fetchKPIs, fetchTrends, fetchDistribution, fetchRankedAgencies, fetchReviews, reviewPage]);

  // Initial Load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await fetchFilters();
      await refreshData(true);
      setLoading(false);
    };
    loadAll();
  }, [refreshData]);

  // Scroll reveal hook
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        } else {
          entry.target.classList.remove('visible');
        }
      });
    }, { threshold: 0.1 });

    const elements = document.querySelectorAll('.scroll-reveal');
    elements.forEach(el => observer.observe(el));

    return () => {
      elements.forEach(el => observer.unobserve(el));
    };
  }, [activeTab, loading, refreshing, reviewsData, rankedAgencies]);

  // Trigger review pagination
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= Math.ceil(reviewsData.total / reviewsData.limit)) {
      setReviewPage(newPage);
      fetchReviews(newPage);
    }
  };

  // Map circle interactions
  const handleCityClick = (cityName) => {
    setFilters(prev => ({
      ...prev,
      city: prev.city === cityName ? "" : cityName,
      agency: "" // reset agency when city changes
    }));
  };

  // Calcule les coordonnées dynamiquement depuis les données API
  const getDynamicCities = () => {
    const uniqueCities = [...new Set(rankedAgencies.map(a => a.city).filter(Boolean))];
    return uniqueCities
      .filter(city => MOROCCO_COORDS[city])
      .map(city => ({
        name: city,
        lat: MOROCCO_COORDS[city].lat,
        lng: MOROCCO_COORDS[city].lng,
      }));
  };

  // Helper to get stats of hovered city for map tooltips
  const getCityBrief = (cityName) => {
    const matchedAg = rankedAgencies.filter(a => a.city === cityName);
    if (!matchedAg.length) return { totalReviews: 0, avgRating: 0 };
    const totalReviews = matchedAg.reduce((sum, item) => sum + item.nb_avis, 0);
    const sumNotes = matchedAg.reduce((sum, item) => sum + (item.note_moyenne * item.nb_avis), 0);
    const avgRating = totalReviews > 0 ? (sumNotes / totalReviews).toFixed(2) : 0.0;
    return { totalReviews, avgRating };
  };

  // Filter handlers
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      ...(field === "city" ? { agency: "" } : {}) // Reset agency if city is changed
    }));
    setReviewPage(1);
  };

  const resetFilters = () => {
    setFilters({
      city: "",
      agency: "",
      sentiment: "",
      rating: "",
      startDate: "",
      endDate: ""
    });
    setReviewPage(1);
  };

  // Local filtered reviews (for search bar input on front-end)
  const filteredReviewsList = reviewsData.reviews.filter(r => {
    if (!searchTerm) return true;
    return (r.commentaire || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.agence || "").toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className={`app-container ${darkMode ? 'dark' : 'light'}`}>

      {/* ─── SIDEBAR NAVIGATION ──────────────────────────────────────────────── */}
      <aside className={`sidebar-nav ${!isSidebarOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-brand">
          {isSidebarOpen ? (
            <img
              src="/logo-cih.png"
              alt="CIH Bank"
              style={{
                width: '170px',
                objectFit: 'contain',
                filter: darkMode ? 'brightness(0) invert(1)' : 'none'
              }}
            />
          ) : (
            <img
              src="/SmallLogo.png"
              alt="CIH"
              style={{
                width: '40px',
                objectFit: 'contain',
                filter: darkMode ? 'brightness(0) invert(1)' : 'none'
              }}
            />
          )}
          <button className="toggle-sidebar-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        <nav className="nav-menu">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <TrendingUp size={18} />
            <span>Executive Dashboard</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            <MessageSquare size={18} />
            <span>Reviews Explorer</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'agencies' ? 'active' : ''}`}
            onClick={() => setActiveTab('agencies')}
          >
            <Award size={18} />
            <span>Agency Ranking</span>
          </button>

        </nav>
      </aside>

      {/* ─── MAIN CONTENT AREA ──────────────────────────────────────────────── */}
      <main className={`main-wrapper ${!isSidebarOpen ? 'expanded' : ''}`}>

        {/* ─── TOP BAR: TITLE AND DYNAMIC REFRESH ──────────────────────────────── */}
        <header className="main-header">
          <div className="header-title">
            <h1>Customer Feedback Analytics</h1>
            <p>Real-time NPS, sentiment extraction, and agency performance monitoring</p>
          </div>

          <div className="header-actions">
            <button className="btn btn-secondary" onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
              <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
            </button>
            <button
              className={`btn btn-primary ${refreshing ? 'spinning' : ''}`}
              onClick={() => refreshData()}
              disabled={loading || refreshing}
            >
              <RefreshCw size={15} />
              <span>{refreshing ? "Refreshing..." : "Sync Database"}</span>
            </button>
          </div>
        </header>

        {/* ─── ADVANCED FILTER BAR ────────────────────────────────────────────── */}
        <section className="filter-card glass-panel animate-fade-in">
          <div className="filter-header">
            <div className="filter-title">
              <SlidersHorizontal size={16} />
              <span>Advanced Segment Filters</span>
            </div>
            {(filters.city || filters.agency || filters.sentiment || filters.rating || filters.startDate || filters.endDate) && (
              <button className="clear-filters-btn" onClick={resetFilters}>Clear All</button>
            )}
          </div>

          <div className="filter-grid">
            <div className="filter-group">
              <label>City</label>
              <CustomSelect
                value={filters.city}
                onChange={(val) => handleFilterChange("city", val)}
                placeholder="All Cities"
                options={cities.map(c => ({ value: c, label: c }))}
              />
            </div>

            <div className="filter-group">
              <label>Agency</label>
              <CustomSelect
                value={filters.agency}
                onChange={(val) => handleFilterChange("agency", val)}
                placeholder="All Agencies"
                options={agencies
                  .filter(a => !filters.city || a.toLowerCase().includes(filters.city.toLowerCase()) || rankedAgencies.find(ra => ra.agence === a && ra.city === filters.city))
                  .map(a => ({ value: a, label: a }))
                }
              />
            </div>

            <div className="filter-group">
              <label>Sentiment</label>
              <CustomSelect
                value={filters.sentiment}
                onChange={(val) => handleFilterChange("sentiment", val)}
                placeholder="All Sentiments"
                options={[
                  { value: "positive", label: "Positive (BERT 4-5)" },
                  { value: "neutral", label: "Neutral (BERT 3)" },
                  { value: "negative", label: "Negative (BERT 1-2)" }
                ]}
              />
            </div>

            <div className="filter-group">
              <label>Rating</label>
              <CustomSelect
                value={filters.rating}
                onChange={(val) => handleFilterChange("rating", val !== "" ? parseInt(val) : "")}
                placeholder="All Ratings"
                options={[5, 4, 3, 2, 1].map(num => ({ value: num, label: `${num} ${num === 1 ? 'Star' : 'Stars'}` }))}
              />
            </div>

            <div className="filter-group">
              <label>Start Date</label>
              <div className="date-input-wrapper">
                <Calendar size={14} className="calendar-icon" />
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                />
              </div>
            </div>

            <div className="filter-group">
              <label>End Date</label>
              <div className="date-input-wrapper">
                <Calendar size={14} className="calendar-icon" />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── ERROR ALERT PANEL ──────────────────────────────────────────────── */}
        {error && (
          <div className="error-banner animate-fade-in">
            <Info size={18} />
            <div className="error-text">
              <strong>Database Sync Issue:</strong> {error}
            </div>
            <button className="error-close" onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* ─── LOADING STATE SPINNER ─────────────────────────────────────────── */}
        {loading ? (
          <div className="loading-state">
            <div className="premium-spinner"></div>
            <p>Loading analytics workspace...</p>
          </div>
        ) : (
          <div className="tab-content animate-fade-in">

            {/* ─── VIEW 1: EXECUTIVE DASHBOARD ─────────────────────────────────── */}
            {activeTab === 'dashboard' && (
              <>
                {/* KPI Card Metrics Grid */}
                <section className="kpi-grid">
                  <div className="kpi-card glass-panel animate-scale-up">
                    <div className="kpi-header">
                      <span className="kpi-title">Total Reviews</span>
                      <div className="kpi-icon-bg info"><MessageSquare size={16} /></div>
                    </div>
                    <div className="kpi-value">{kpis.total_reviews}</div>
                    <div className="kpi-footer">
                      <span className="kpi-trend positive">Total feedback collected</span>
                    </div>
                  </div>

                  <div className="kpi-card glass-panel animate-scale-up" style={{ animationDelay: '0.1s' }}>
                    <div className="kpi-header">
                      <span className="kpi-title">Average Rating</span>
                      <div className="kpi-icon-bg warning"><Star size={16} /></div>
                    </div>
                    <div className="kpi-value">
                      {kpis.average_rating} <span className="kpi-unit">/ 5</span>
                    </div>
                    <div className="kpi-footer">
                      <div className="stars-indicator">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            fill={i < Math.round(kpis.average_rating) ? "#FFC107" : "transparent"}
                            color={i < Math.round(kpis.average_rating) ? "#FFC107" : "#8a9eb5"}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="kpi-card glass-panel animate-scale-up" style={{ animationDelay: '0.2s' }}>
                    <div className="kpi-header">
                      <span className="kpi-title">Positive Rating</span>
                      <div className="kpi-icon-bg success"><ThumbsUp size={16} /></div>
                    </div>
                    <div className="kpi-value">
                      {kpis.total_reviews > 0 ? ((kpis.positive_reviews / kpis.total_reviews) * 100).toFixed(0) : 0}%
                    </div>
                    <div className="kpi-footer">
                      <span className="kpi-subtext">{kpis.positive_reviews} reviews (stars ≥ 4)</span>
                    </div>
                  </div>

                  <div className="kpi-card glass-panel animate-scale-up" style={{ animationDelay: '0.3s' }}>
                    <div className="kpi-header">
                      <span className="kpi-title">Negative Rating</span>
                      <div className="kpi-icon-bg danger"><ThumbsDown size={16} /></div>
                    </div>
                    <div className="kpi-value">
                      {kpis.total_reviews > 0 ? ((kpis.negative_reviews / kpis.total_reviews) * 100).toFixed(0) : 0}%
                    </div>
                    <div className="kpi-footer">
                      <span className="kpi-subtext">{kpis.negative_reviews} reviews (stars ≤ 2)</span>
                    </div>
                  </div>

                  <div className="kpi-card glass-panel animate-scale-up" style={{ animationDelay: '0.4s' }}>
                    <div className="kpi-header">
                      <span className="kpi-title">Average Sentiment</span>
                      <div className="kpi-icon-bg primary"><Smile size={16} /></div>
                    </div>
                    <div className="kpi-value small-text">{kpis.average_sentiment_label}</div>
                    <div className="kpi-footer">
                      <span className="kpi-subtext">Classification</span>
                    </div>
                  </div>
                </section>

                {/* ─── ROW 1: Monthly Trends + Review Distribution ─── */}
                <div className="dashboard-row double-grid-equal scroll-reveal">

                  {/* Monthly Sentiment Trend Chart */}
                  <div className="glass-panel chart-widget">
                    <div className="panel-header">
                      <div className="panel-title-wrapper">
                        <h2>Monthly Sentiment Trends</h2>
                        <p>Customer rating averages and feedback volume evolution over time</p>
                      </div>
                    </div>

                    <div className="chart-container">
                      {trends.length === 0 ? (
                        <div className="no-data">No trend data available for this selection.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height={320}>
                          <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00afef" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#00afef" stopOpacity={0.0} />
                              </linearGradient>
                              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#FF5E00" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#FF5E00" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="period" stroke="#8a9eb5" fontSize={11} tickLine={false} />
                            <YAxis yAxisId="left" stroke="#00afef" fontSize={11} domain={[0, 5]} tickLine={false} label={{ value: 'Average Rating', angle: -90, position: 'insideLeft', offset: 10, fill: '#00afef', style: { fontSize: 10 } }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#FF5E00" fontSize={11} tickLine={false} label={{ value: 'Reviews Volume', angle: 90, position: 'insideRight', offset: 10, fill: '#FF5E00', style: { fontSize: 10 } }} />
                            <ChartTooltip
                              contentStyle={{
                                backgroundColor: darkMode ? '#0e1d35' : '#ffffff',
                                borderColor: '#00afef',
                                borderRadius: '8px',
                                color: darkMode ? '#ffffff' : '#000000'
                              }}
                            />
                            <Area yAxisId="left" type="monotone" dataKey="rating" name="Rating Avg" stroke="#00afef" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRating)" />
                            <Area yAxisId="right" type="monotone" dataKey="count" name="Reviews Count" stroke="#FF5E00" strokeWidth={1.5} strokeDasharray="3 3" fillOpacity={1} fill="url(#colorCount)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Rating distribution chart */}
                  <div className="glass-panel chart-widget">
                    <div className="panel-header">
                      <h2>Review Distribution</h2>
                      <p>Number of customer reviews categorised by rating scale</p>
                    </div>

                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={distribution} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                          <XAxis type="number" stroke="#8a9eb5" fontSize={11} tickLine={false} />
                          <YAxis dataKey="stars" type="category" stroke="#8a9eb5" fontSize={11} tickLine={false} />
                          <ChartTooltip
                            contentStyle={{
                              backgroundColor: darkMode ? '#0e1d35' : '#ffffff',
                              borderColor: '#FF5E00',
                              borderRadius: '8px',
                              color: darkMode ? '#ffffff' : '#000000'
                            }}
                          />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                            {distribution.map((entry, index) => {
                              let color = "#8a9eb5"; // neutral
                              if (entry.rating >= 4) color = "#00afef"; // Positive CIH blue
                              if (entry.rating <= 2) color = "#FF5E00"; // Negative CIH orange
                              return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* ─── ROW 2: Agency Rankings + Regional Performance Map ─── */}
                <div className="dashboard-row double-grid-equal scroll-reveal">

                  {/* Ranked agency list */}
                  <div className="glass-panel list-widget">
                    <div className="panel-header-row">
                      <div>
                        <h2>Agency Rankings</h2>
                        <p>Agencies ranked by aggregate feedback note</p>
                      </div>
                      <button className="btn btn-text" onClick={() => setActiveTab('agencies')}>View All</button>
                    </div>

                    <div className="table-responsive">
                      <table className="dashboard-table">
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Agency Name</th>
                            <th>City</th>
                            <th>Avg Rating</th>
                            <th>Reviews</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rankedAgencies
                            .filter(ag => !filters.city || ag.city === filters.city)
                            .filter(ag => !filters.agency || ag.agence === filters.agency)
                            .filter(ag => !filters.rating || Math.round(ag.note_moyenne) === filters.rating)
                            .filter(ag => {
                              if (!filters.sentiment) return true;
                              if (filters.sentiment === 'positive') return ag.nb_positifs > ag.nb_negatifs;
                              if (filters.sentiment === 'negative') return ag.nb_negatifs > ag.nb_positifs;
                              if (filters.sentiment === 'neutral') return Math.round(ag.note_moyenne) === 3;
                              return true;
                            })
                            .slice(0, 5).map((ag, idx) => (
                            <tr key={idx} className={filters.agency === ag.agence ? 'row-highlight' : ''} onClick={() => handleFilterChange("agency", ag.agence)}>
                              <td>
                                <span className={`rank-badge rank-${idx + 1}`}>{idx + 1}</span>
                              </td>
                              <td><strong>{ag.agence}</strong></td>
                              <td>{ag.city}</td>
                              <td>
                                <span className="rating-badge">
                                  {ag.note_moyenne} ★
                                </span>
                              </td>
                              <td>{ag.nb_avis} reviews</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Morocco map widget */}
                  <div className="glass-panel map-widget">
                    <div className="panel-header">
                      <h2>Regional Performance Map</h2>
                      <p>Click on any city marker to apply filter</p>
                    </div>

                    <div className="map-container-relative">
                      <ComposableMap
                        projection="geoMercator"
                        projectionConfig={{
                          scale: 2200,
                          center: [-9, 28.5]
                        }}
                        style={{ width: '100%', height: '100%' }}
                      >
                        <Geographies geography="/data/morocco-regions.json">
                          {({ geographies }) =>
                            geographies.map(geo => (
                              <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                fill="rgba(0, 175, 239, 0.04)"
                                stroke="rgba(0, 175, 239, 0.35)"
                                strokeWidth={0.6}
                                style={{
                                  default: { outline: 'none' },
                                  hover: { fill: 'rgba(0, 175, 239, 0.12)', outline: 'none' },
                                  pressed: { outline: 'none' }
                                }}
                              />
                            ))
                          }
                        </Geographies>

                        {getDynamicCities().map(city => {
                          const isActive = filters.city === city.name;
                          const brief = getCityBrief(city.name);

                          return (
                            <Marker
                              key={city.name}
                              coordinates={[city.lng, city.lat]}
                            >
                              <g
                                className={`map-marker ${isActive ? "active" : ""}`}
                                onClick={() => handleCityClick(city.name)}
                                onMouseEnter={() => setHoveredCity({ ...city, ...brief })}
                                onMouseLeave={() => setHoveredCity(null)}
                              >
                                <circle r="24" fill="transparent" />
                                <circle r="8" fill="rgba(255, 94, 0, 0.15)" stroke="#FF5E00" strokeWidth={1} />
                                <circle r="5" fill="#FF5E00" stroke="var(--bg-panel-solid)" strokeWidth={1.5} />
                                <text textAnchor="start" dx={10} dy={4} fill="var(--text-main)" fontSize={10} fontWeight={600}>
                                  {city.name}
                                </text>
                              </g>
                            </Marker>
                          );
                        })}
                      </ComposableMap>

                      {/* Floating tooltip on map layout */}
                      {hoveredCity && (
                        <div
                          className="map-tooltip glass-panel animate-fade-in"
                          style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            left: 'auto',
                            transform: 'none'
                          }}
                        >
                          <h4>{hoveredCity.name}</h4>
                          <div className="tooltip-stat">
                            <span>Reviews:</span>
                            <strong>{hoveredCity.totalReviews}</strong>
                          </div>
                          <div className="tooltip-stat">
                            <span>Avg Rating:</span>
                            <strong className={hoveredCity.avgRating >= 3.5 ? 'text-success' : hoveredCity.avgRating >= 2.5 ? 'text-warning' : 'text-danger'}>
                              {hoveredCity.avgRating} ★
                            </strong>
                          </div>
                          <div className="tooltip-footer">Click to filter dashboard</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ─── ROW 3: Recent Reviews Feed (full width) ─── */}
                <div className="dashboard-row scroll-reveal">
                  <div className="glass-panel list-widget">
                    <div className="panel-header-row">
                      <div>
                        <h2>Recent Reviews Feed</h2>
                        <p>Latest customer comments and computed sentiment scores</p>
                      </div>
                      <button className="btn btn-text" onClick={() => setActiveTab('reviews')}>Browse Feed</button>
                    </div>

                    <div className="quick-reviews-list">
                      {reviewsData.reviews.slice(0, 3).map((rev) => (
                        <div key={rev.id} className="quick-review-item glass-panel">
                          <div className="qr-header">
                            <div>
                              <h4>{rev.agence}</h4>
                              <span className="qr-meta">{rev.city} • {rev.published_at}</span>
                            </div>
                            <span className={`badge badge-${rev.sentiment_label.toLowerCase()}`}>
                              {rev.sentiment_label}
                            </span>
                          </div>
                          <p className="qr-text">"{rev.commentaire}"</p>
                          <div className="qr-stars">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={11}
                                fill={i < rev.rating ? "#FFC107" : "transparent"}
                                color={i < rev.rating ? "#FFC107" : "#8a9eb5"}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ─── VIEW 2: REVIEWS EXPLORER ────────────────────────────────────── */}
            {activeTab === 'reviews' && (
              <div className="explorer-view glass-panel">
                <div className="panel-header-row border-bottom">
                  <div>
                    <h2>Reviews Explorer</h2>
                    <p>Total {reviewsData.total} feedbacks found matching filter selections</p>
                  </div>

                  <div className="search-bar-wrapper">
                    <Search size={15} />
                    <input
                      type="text"
                      placeholder="Search reviews or agency name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="reviews-large-feed">
                  {filteredReviewsList.length === 0 ? (
                    <div className="no-data padding-lg">
                      <MessageSquare size={48} className="muted-icon" />
                      <p>No matching reviews found. Change your filter query or search keyword.</p>
                    </div>
                  ) : (
                    filteredReviewsList.map((rev) => (
                      <div key={rev.id} className="feed-review-card glass-panel animate-scale-up">
                        <div className="frc-header">
                          <div className="frc-agency-info">
                            <MapPin size={14} className="accent-color" />
                            <strong>{rev.agence}</strong>
                            <span className="frc-city">({rev.city})</span>
                          </div>

                          <div className="frc-badges">
                            <span className={`badge badge-${rev.sentiment_label.toLowerCase()}`}>
                              BERT: {rev.sentiment_label}
                            </span>
                            <span className="frc-date">{rev.published_at}</span>
                          </div>
                        </div>

                        <p className="frc-comment">"{rev.commentaire}"</p>

                        <div className="frc-footer">
                          <div className="stars-indicator">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={14}
                                fill={i < rev.rating ? "#FFC107" : "transparent"}
                                color={i < rev.rating ? "#FFC107" : "#8a9eb5"}
                              />
                            ))}
                          </div>
                          {rev.phone && <span className="frc-phone"><Phone size={11} /> {rev.phone}</span>}
                          {rev.address && <span className="frc-address">{rev.address}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination Controls */}
                {reviewsData.total > reviewsData.limit && (
                  <div className="pagination-bar">
                    <button
                      className="btn btn-icon"
                      disabled={reviewPage === 1}
                      onClick={() => handlePageChange(reviewPage - 1)}
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <span className="pagination-text">
                      Page <strong>{reviewPage}</strong> of <strong>{Math.ceil(reviewsData.total / reviewsData.limit)}</strong>
                    </span>

                    <button
                      className="btn btn-icon"
                      disabled={reviewPage === Math.ceil(reviewsData.total / reviewsData.limit)}
                      onClick={() => handlePageChange(reviewPage + 1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ─── VIEW 3: AGENCY RANKING ──────────────────────────────────────── */}
            {activeTab === 'agencies' && (
              <div className="explorer-view glass-panel">
                <div className="panel-header border-bottom">
                  <h2>Agency Ranking & Score Cards</h2>
                  <p>Detailed performance index of CIH Bank agencies by customer evaluation ratings</p>
                </div>

                <div className="agencies-cards-grid">
                  {rankedAgencies
                    .filter(ag => !filters.city || ag.city === filters.city)
                    .filter(ag => !filters.agency || ag.agence === filters.agency)
                    .filter(ag => !filters.rating || Math.round(ag.note_moyenne) === filters.rating)
                    .filter(ag => {
                      if (!filters.sentiment) return true;
                      if (filters.sentiment === 'positive') return ag.nb_positifs > ag.nb_negatifs;
                      if (filters.sentiment === 'negative') return ag.nb_negatifs > ag.nb_positifs;
                      if (filters.sentiment === 'neutral') return Math.round(ag.note_moyenne) === 3;
                      return true;
                    })
                    .map((ag, idx) => {
                    const posPct = ag.nb_avis > 0 ? Math.round((ag.nb_positifs / ag.nb_avis) * 100) : 0;
                    const negPct = ag.nb_avis > 0 ? Math.round((ag.nb_negatifs / ag.nb_avis) * 100) : 0;

                    return (
                      <div
                        key={idx}
                        className={`agency-perf-card glass-panel animate-scale-up ${filters.agency === ag.agence ? 'focused' : ''}`}
                        onClick={() => handleFilterChange("agency", ag.agence)}
                      >
                        <div className="apc-rank-badge">Rank #{ag.classement || (idx + 1)}</div>

                        <div className="apc-header">
                          <h3>{ag.agence}</h3>
                          <span className="apc-city">{ag.city}</span>
                        </div>

                        <div className="apc-rating-row">
                          <span className="apc-rating-value">{ag.note_moyenne.toFixed(2)}</span>
                          <div className="stars-indicator">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={14}
                                fill={i < Math.round(ag.note_moyenne) ? "#FFC107" : "transparent"}
                                color={i < Math.round(ag.note_moyenne) ? "#FFC107" : "#8a9eb5"}
                              />
                            ))}
                          </div>
                          <span className="apc-count">{ag.nb_avis} reviews</span>
                        </div>

                        <div className="apc-sentiment-bar-label">
                          <span>Positive ({posPct}%)</span>
                          <span>Negative ({negPct}%)</span>
                        </div>

                        <div className="apc-sentiment-bar-track">
                          <div className="bar-positive" style={{ width: `${posPct}%` }}></div>
                          <div className="bar-negative" style={{ width: `${negPct}%` }}></div>
                        </div>

                        <div className="apc-contact-info">
                          {ag.address && <p><strong>Address:</strong> {ag.address}</p>}
                          {ag.phone && <p><strong>Phone:</strong> {ag.phone}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}



          </div>
        )}
      </main>
    </div>
  );
}
