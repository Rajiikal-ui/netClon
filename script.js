// TMDB API Configuration
const API_KEY = '06b2b140360a0fa43651657d4ffdb071';
const API_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

// Genre mapping
const GENRE_MAP = {
    28: 'Action',
    35: 'Comedy',
    18: 'Drama',
    12: 'Adventure',
    16: 'Animation',
    80: 'Crime',
    99: 'Documentary',
    14: 'Fantasy',
    36: 'History',
    27: 'Horror',
    10402: 'Music',
    9648: 'Mystery',
    10749: 'Romance',
    878: 'Science Fiction',
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'War',
    37: 'Western'
};

// Cache for storing fetched movies
let moviesCache = {
    popular: [],
    topRated: [],
    action: [],
    comedy: [],
    drama: []
};

// User preferences
let userPreferences = {
    favoriteGenres: [],
    watchedMovies: JSON.parse(localStorage.getItem('watchedMovies')) || [],
    ratings: JSON.parse(localStorage.getItem('ratings')) || {}
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadAllMovies();
});

// Fetch data from TMDB API
async function fetchFromTMDB(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}&api_key=${API_KEY}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching from TMDB:', error);
        showError('Failed to load movies. Please check your internet connection.');
        return null;
    }
}

// Transform TMDB movie data to our format
function transformMovieData(tmdbMovie) {
    return {
        id: tmdbMovie.id,
        title: tmdbMovie.title,
        genre: tmdbMovie.genre_ids.map(id => GENRE_MAP[id] || 'Unknown'),
        rating: (tmdbMovie.vote_average / 10).toFixed(1),
        year: new Date(tmdbMovie.release_date).getFullYear(),
        description: tmdbMovie.overview || 'No description available.',
        poster: tmdbMovie.poster_path ? `${IMAGE_BASE_URL}${tmdbMovie.poster_path}` : null,
        backdrop: tmdbMovie.backdrop_path ? `${BACKDROP_BASE_URL}${tmdbMovie.backdrop_path}` : null,
        releaseDate: tmdbMovie.release_date,
        popularity: tmdbMovie.popularity,
        voteCount: tmdbMovie.vote_count
    };
}

// Load all movie categories
async function loadAllMovies() {
    showLoading();
    
    try {
        // Load all categories in parallel
        const [popularData, topRatedData, actionData, comedyData, dramaData] = await Promise.all([
            fetchFromTMDB('/movie/popular?language=en-US&page=1'),
            fetchFromTMDB('/movie/top_rated?language=en-US&page=1'),
            fetchFromTMDB('/discover/movie?with_genres=28&sort_by=popularity.desc&page=1'),
            fetchFromTMDB('/discover/movie?with_genres=35&sort_by=popularity.desc&page=1'),
            fetchFromTMDB('/discover/movie?with_genres=18&sort_by=popularity.desc&page=1')
        ]);

        if (popularData) {
            moviesCache.popular = popularData.results.map(transformMovieData);
            displayMovies(moviesCache.popular, 'trending');
        }

        if (topRatedData) {
            moviesCache.topRated = topRatedData.results.map(transformMovieData);
            displayMovies(moviesCache.topRated, 'topRated');
        }

        if (actionData) {
            moviesCache.action = actionData.results.map(transformMovieData);
            displayMovies(moviesCache.action, 'action');
        }

        if (comedyData) {
            moviesCache.comedy = comedyData.results.map(transformMovieData);
            displayMovies(moviesCache.comedy, 'comedy');
        }

        if (dramaData) {
            moviesCache.drama = dramaData.results.map(transformMovieData);
            displayMovies(moviesCache.drama, 'drama');
        }

        // Load recommendations
        await loadRecommendations();

        // Update hero section with a popular movie
        if (moviesCache.popular.length > 0) {
            updateHeroSection(moviesCache.popular[0]);
        }

        hideLoading();
    } catch (error) {
        console.error('Error loading movies:', error);
        hideLoading();
        showError('Failed to load movies. Please try again later.');
    }
}

// Load personalized recommendations
async function loadRecommendations() {
    try {
        // Get a mix of popular and top-rated movies for recommendations
        const allMovies = [...moviesCache.popular, ...moviesCache.topRated];
        const uniqueMovies = Array.from(new Map(allMovies.map(m => [m.id, m])).values());
        
        // Filter out watched movies and get top rated
        const recommendations = uniqueMovies
            .filter(m => !userPreferences.watchedMovies.includes(m.id))
            .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))
            .slice(0, 6);
        
        displayMovies(recommendations, 'nextWatch');
    } catch (error) {
        console.error('Error loading recommendations:', error);
    }
}

// Display movies in a category
function displayMovies(movieList, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!movieList || movieList.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Loading movies...</p></div>';
        return;
    }
    
    movieList.forEach(movie => {
        const movieCard = createMovieCard(movie);
        container.appendChild(movieCard);
    });
}

// Create a movie card element
function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    
    const posterUrl = movie.poster || `https://via.placeholder.com/200x300/333/fff?text=${encodeURIComponent(movie.title)}`;
    
    card.innerHTML = `
        <img src="${posterUrl}" alt="${movie.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300/333/fff?text=${encodeURIComponent(movie.title)}'">
        <div class="movie-info">
            <div class="movie-title">${movie.title}</div>
            <div class="movie-rating">⭐ ${movie.rating}/10</div>
        </div>
    `;
    
    card.addEventListener('click', () => showMovieDetails(movie));
    return card;
}

// Show movie details in modal
async function showMovieDetails(movie) {
    const modal = document.getElementById('movieModal');
    const modalBody = document.getElementById('modalBody');
    
    // Show loading state
    modalBody.innerHTML = '<div class="empty-state"><p>Loading...</div>';
    modal.classList.add('show');
    
    try {
        // Fetch detailed movie information
        const movieDetails = await fetchFromTMDB(`/movie/${movie.id}?language=en-US`);
        
        if (movieDetails) {
            const detailedMovie = {
                ...movie,
                runtime: movieDetails.runtime || 'N/A',
                budget: movieDetails.budget,
                revenue: movieDetails.revenue,
                genres: movieDetails.genres || [],
                productionCompanies: movieDetails.production_companies || [],
                tagline: movieDetails.tagline || '',
                homepage: movieDetails.homepage
            };
            
            const posterUrl = detailedMovie.poster || `https://via.placeholder.com/300x450/333/fff?text=${encodeURIComponent(detailedMovie.title)}`;
            
            modalBody.innerHTML = `
                <img src="${posterUrl}" alt="${detailedMovie.title}" class="modal-poster" onerror="this.src='https://via.placeholder.com/300x450/333/fff?text=${encodeURIComponent(detailedMovie.title)}'">
                <h2 class="modal-title">${detailedMovie.title}</h2>
                ${detailedMovie.tagline ? `<p style="font-style: italic; color: #b3b3b3; margin-bottom: 15px;">${detailedMovie.tagline}</p>` : ''}
                <div class="modal-details">
                    <span class="modal-detail">⭐ ${detailedMovie.rating}/10</span>
                    <span class="modal-detail">📅 ${detailedMovie.year}</span>
                    <span class="modal-detail">⏱️ ${detailedMovie.runtime} min</span>
                </div>
                <div class="modal-genres">
                    ${detailedMovie.genres.map(g => `<span class="genre-tag">${g.name}</span>`).join('')}
                </div>
                <p class="modal-description">${detailedMovie.description}</p>
                <div class="hero-buttons">
                    <button class="btn btn-play" onclick="playMovie(${detailedMovie.id}, '${detailedMovie.title}')">▶ Play</button>
                    <button class="btn btn-info" onclick="addToWatchlist(${detailedMovie.id})">+ My List</button>
                </div>
            `;
        } else {
            // Fallback to basic movie info if API call fails
            const posterUrl = movie.poster || `https://via.placeholder.com/300x450/333/fff?text=${encodeURIComponent(movie.title)}`;
            
            modalBody.innerHTML = `
                <img src="${posterUrl}" alt="${movie.title}" class="modal-poster" onerror="this.src='https://via.placeholder.com/300x450/333/fff?text=${encodeURIComponent(movie.title)}'">
                <h2 class="modal-title">${movie.title}</h2>
                <div class="modal-details">
                    <span class="modal-detail">⭐ ${movie.rating}/10</span>
                    <span class="modal-detail">📅 ${movie.year}</span>
                </div>
                <div class="modal-genres">
                    ${movie.genre.map(g => `<span class="genre-tag">${g}</span>`).join('')}
                </div>
                <p class="modal-description">${movie.description}</p>
                <div class="hero-buttons">
                    <button class="btn btn-play" onclick="playMovie(${movie.id}, '${movie.title}')">▶ Play</button>
                    <button class="btn btn-info" onclick="addToWatchlist(${movie.id})">+ My List</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading movie details:', error);
        modalBody.innerHTML = '<div class="empty-state"><h3>Error</h3><p>Failed to load movie details. Please try again.</p></div>';
    }
}

// Close modal
function closeModal() {
    const modal = document.getElementById('movieModal');
    modal.classList.remove('show');
}

// Play movie
function playMovie(movieId, movieTitle) {
    alert(`Playing: ${movieTitle}\n\nThis is a demo. In a real application, this would start video playback.`);
}

// Add to watchlist
function addToWatchlist(movieId) {
    if (!userPreferences.watchedMovies.includes(movieId)) {
        userPreferences.watchedMovies.push(movieId);
        localStorage.setItem('watchedMovies', JSON.stringify(userPreferences.watchedMovies));
        alert('Added to your watchlist!');
    } else {
        alert('Already in your watchlist!');
    }
}

// Search movies
async function searchMovies(query) {
    if (!query || query.trim() === '') {
        return [];
    }
    
    try {
        const searchData = await fetchFromTMDB(`/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=1`);
        
        if (searchData && searchData.results) {
            return searchData.results.map(transformMovieData);
        }
        return [];
    } catch (error) {
        console.error('Error searching movies:', error);
        return [];
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.querySelector('.search-btn');
    const searchResults = document.getElementById('searchResults');
    const contentContainer = document.querySelector('.content-container');
    
    let searchTimeout;
    
    async function performSearch() {
        const query = searchInput.value.trim();
        
        if (query === '') {
            searchResults.classList.add('hidden');
            contentContainer.style.display = 'block';
            return;
        }
        
        // Show loading
        searchResults.classList.remove('hidden');
        contentContainer.style.display = 'none';
        document.getElementById('searchResultsRow').innerHTML = '<div class="empty-state"><p>Searching...</p></div>';
        
        const results = await searchMovies(query);
        
        if (results.length > 0) {
            displayMovies(results, 'searchResultsRow');
        } else {
            document.getElementById('searchResultsRow').innerHTML = 
                '<div class="empty-state"><h3>No results found</h3><p>Try a different search term</p></div>';
        }
    }
    
    searchBtn.addEventListener('click', performSearch);
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            performSearch();
        }
    });
    
    // Debounced search on input
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        
        if (searchInput.value === '') {
            searchResults.classList.add('hidden');
            contentContainer.style.display = 'block';
        } else {
            searchTimeout = setTimeout(performSearch, 500);
        }
    });
    
    // Modal close
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    // Close modal on outside click
    const modal = document.getElementById('movieModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
    
    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    // Navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// Update hero section with featured movie
function updateHeroSection(movie) {
    const heroTitle = document.querySelector('.hero-title');
    const heroDescription = document.querySelector('.hero-description');
    const heroSection = document.querySelector('.hero-section');
    
    if (heroTitle && movie) heroTitle.textContent = movie.title;
    if (heroDescription && movie) {
        heroDescription.textContent = movie.description || 'Experience this amazing story.';
    }
    if (heroSection && movie) {
        const backdropUrl = movie.backdrop || movie.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1920';
        heroSection.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${backdropUrl}')`;
    }
    
    // Update play button
    const playBtn = document.querySelector('.btn-play');
    if (playBtn && movie) {
        playBtn.onclick = () => playMovie(movie.id, movie.title);
    }
    
    const infoBtn = document.querySelector('.btn-info');
    if (infoBtn && movie) {
        infoBtn.onclick = () => showMovieDetails(movie);
    }
}

// Show loading state
function showLoading() {
    const containers = ['trending', 'topRated', 'nextWatch', 'action', 'comedy', 'drama'];
    containers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = '<div class="empty-state"><p>Loading movies...</p></div>';
        }
    });
}

// Hide loading state
function hideLoading() {
    // Loading is automatically replaced when movies are displayed
}

// Show error message
function showError(message) {
    const containers = ['trending', 'topRated', 'nextWatch', 'action', 'comedy', 'drama'];
    containers.forEach(id => {
        const container = document.getElementById(id);
        if (container && container.innerHTML.includes('Loading')) {
            container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${message}</p></div>`;
        }
    });
}

// Make functions globally available
window.playMovie = playMovie;
window.addToWatchlist = addToWatchlist;
