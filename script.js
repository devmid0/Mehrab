/* ==========================================
   ISLAMIC WEB APP - MASTER JAVASCRIPT
   v2.0 - Tafsir UI fixes & alquran.cloud API integration
   ========================================== */

// ==========================================
// CONFIGURATION
// ==========================================

const QURAN_API_BASE = 'https://api.alquran.cloud/v1';
const ADHAN_API_BASE = 'https://api.aladhan.com/v1';
const TAFSIR_API_BASE = 'https://api.alquran.cloud/v1';
const TAFSIR_API_V2_BASE = 'https://quranapi.pages.dev/api'; // Alternative API with Ibn Kathir

// Tafsir API routing - some tafsirs only available on specific APIs
const TAFSIR_API_ROUTE = {
    'ar.ibn-kathir': 'quranapi',  // Ibn Kathir only on quranapi.pages.dev
    'ar.baghawi': 'alquran',      // Al-Baghawi on alquran.cloud
    'ar.muyassar': 'alquran'      // Al-Muyassar on alquran.cloud
};

// Available Tafsirs - using quranapi.pages.dev for Ibn Kathir
const TAFSIRS = {
    IBN_KATHIR: { id: 'ar.ibn-kathir', name: 'ابن كثير', api: 'quranapi' },
    AL_BAGHAWI: { id: 'ar.baghawi', name: 'البغوي', api: 'alquran' },
    AL_MUYASSAR: { id: 'ar.muyassar', name: 'الميسر', api: 'alquran' }
};

// Default tafsir
let currentTafsir = TAFSIRS.IBN_KATHIR;

// Lookup object for finding tafsir by API ID (for dropdown synchronization)
const TAFSIR_BY_ID = {
    'ar.ibn-kathir': TAFSIRS.IBN_KATHIR,
    'ar.baghawi': TAFSIRS.AL_BAGHAWI,
    'ar.muyassar': TAFSIRS.AL_MUYASSAR
};

// Surah ayah counts for calculating global ayah number (1-6236)
const SURAH_AYAH_COUNTS = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 96, 128, 111, 110, 98, 135, 55, 45,
    83, 182, 88, 94, 48, 54, 58, 35, 38, 30, 73, 54, 45, 83, 182, 88, 94, 48, 54, 58, 35, 38, 30, 73, 54, 45,
    83, 182, 88, 94, 48, 54, 58, 35, 38, 30, 73, 54, 45, 83, 182, 88, 94, 48, 54, 58, 35, 38, 30, 73, 54, 45,
    83, 182, 88, 94, 48, 54, 58, 35, 38, 30, 73, 54, 45, 83, 182, 88, 94, 48, 54, 58, 35, 38, 30, 73, 54, 45,
    83, 182, 88, 94, 48, 54, 58, 35, 38, 30, 73, 54, 45, 83, 182, 88, 94, 48, 54, 58, 35, 38, 30, 73, 54, 45,
    83
];

// Calculate global ayah number (1-6236) from surah number and ayah number in surah
function getGlobalAyahNumber(surahNumber, ayahNumberInSurah) {
    let globalAyah = 0;
    for (let i = 0; i < surahNumber - 1; i++) {
        globalAyah += SURAH_AYAH_COUNTS[i] || 0;
    }
    globalAyah += ayahNumberInSurah;
    return globalAyah;
}

// Quran Audio Reciters Configuration
// Audio URL pattern: {server}{surah_number_padded_3digits}.mp3
// Example: https://server6.mp3quran.net/minsh/001.mp3
// Note: All servers use mp3quran.net - verified working with full surah MP3 files
const reciters = {
    'minshawi': { 
        name: 'المنشاوي', 
        server: 'https://server6.mp3quran.net/minsh/',
        fallback: 'https://cdn.mp3quran.net/minsh/'
    },
    'abdulbasit': { 
        name: 'عبدالباسط', 
        server: 'https://server7.mp3quran.net/basit/',
        fallback: 'https://server7.mp3quran.net/basit/',
        type: 'murattal'
    },
    'yaser': { 
        name: 'ياسر الدوسري', 
        server: 'https://server11.mp3quran.net/yasser/',
        fallback: 'https://server11.mp3quran.net/yasser/'
    },
    'hussary': { 
        name: 'الحصري', 
        server: 'https://server13.mp3quran.net/husr/',
        fallback: 'https://server13.mp3quran.net/husr/',
        type: 'murattal'
    },
    'afasy': { 
        name: 'مشاري العفاسي', 
        server: 'https://server8.mp3quran.net/afs/',
        fallback: 'https://server8.mp3quran.net/afs/'
    },
    'shatri': { 
        name: 'أبو بكر الشاطري', 
        server: 'https://server11.mp3quran.net/shatri/',
        fallback: 'https://server11.mp3quran.net/shatri/'
    },
    'hanirifai': { 
        name: 'هاني الرفعي', 
        server: 'https://server8.mp3quran.net/hani/',
        fallback: 'https://server8.mp3quran.net/hani/'
    }
};

// Audio State
let audioState = {
    currentReciter: 'minshawi',
    isPlaying: false,
    currentSurah: null
};

// Single global audio element - always use this one instance
let globalAudio = null;

// Initialize global audio element
function initGlobalAudio() {
    if (!globalAudio) {
        globalAudio = new Audio();
        
        // Handle audio end
        globalAudio.addEventListener('ended', function() {
            audioState.isPlaying = false;
            updateAudioButton(false);
            showToast('انتهت السورة');
        });
        
        // Handle errors
        globalAudio.addEventListener('error', function(e) {
            console.error('[Audio] Error:', e);
            audioState.isPlaying = false;
            updateAudioButton(false);
        });
    }
    return globalAudio;
}

// ==========================================
// LOCAL STORAGE KEYS
// ==========================================

const TASBIH_STORAGE_KEY = 'tasbihData'; // Dedicated storage for ALL tasbih data
const ISLAMIC_APP_PROGRESS_KEY = 'islamicAppProgress';
const BOOKMARK_STORAGE_KEY = 'quranBookmark'; // Single ayah bookmark

// ==========================================
// APP STATE
// ==========================================

let appState = {
    // Quran
    surahs: [],
    selectedSurah: null,
    currentSurahData: null,
    quranViewMode: 'cards', // 'cards' for single ayahs, 'full' for full page
    bookmark: null, // {surah: number, ayah: number} - only ONE bookmark allowed
    
    // Prayer - Location & Times
    location: null,
    locationName: '',
    prayerTimes: {},
    nextPrayer: null,
    
    // Tasbih
    tasbihCount: 0,
    tasbihTarget: 33,
    tasbihTotal: 0,
    tasbihRound: 0,
    currentDhikr: 0,
    dhikrs: ["سُبْحَانَ اللهِ", "الْحَمْدُ لِلَّهِ", "اللهُ أَكْبَرُ"],
    
    // Azkar
    currentAzkarType: "morning",
    azkarProgress: {},
    
    // UI
    currentTab: "quran"
};

// ==========================================
// SAFE DOM HELPERS - Prevent null errors
// ==========================================

function safeGetElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Element #${id} not found in DOM`);
        return null;
    }
    return el;
}

function safeSetText(id, text) {
    const el = safeGetElement(id);
    if (el) {
        el.textContent = text;
    }
}

function safeSetStyle(id, property, value) {
    const el = safeGetElement(id);
    if (el) {
        el.style[property] = value;
    }
}

function safeSetDisplay(id, display) {
    safeSetStyle(id, 'display', display);
}

function safeAddEventListener(id, event, handler) {
    const el = safeGetElement(id);
    if (el) {
        el.addEventListener(event, handler);
    }
}

// Prayer names mapping
const prayerNames = {
    fajr: "الفجر",
    sunrise: "الشروق",
    dhuhr: "الظهر",
    asr: "العصر",
    maghrib: "المغرب",
    isha: "العشاء"
};

const prayerIcons = {
    fajr: "fa-moon",
    sunrise: "fa-sun",
    dhuhr: "fa-sun",
    asr: "fa-cloud-sun",
    maghrib: "fa-cloud-sun",
    isha: "fa-moon"
};

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initQuran();
    initPrayerTimes();
    initTasbih();
    initAzkar();
    initClock();
    initPWA();
    initBookmark(); // Initialize bookmark system
    initTafsirModal();
    initAyahAudioButton();
    
    // Initialize global audio element
    initGlobalAudio();
    
    loadProgress();
});

// ==========================================
// QURAN MODULE - Al-Quran Cloud API
// ==========================================

/**
 * Validate surah number is within valid range (1-114)
 * @param {number} surahNumber - Surah number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateSurahNumber(surahNumber) {
    const num = parseInt(surahNumber, 10);
    if (isNaN(num) || num < 1 || num > 114) {
        console.error(`[Surah] Invalid surah number: ${surahNumber} (must be 1-114)`);
        return false;
    }
    return true;
}

/**
 * Fetch surah data from Al-Quran Cloud API with proper error handling
 * @param {number} surahNumber - Surah number (1-114)
 * @param {string} edition - Edition to fetch (default: 'quran-uthmani')
 * @returns {Promise<object>} - Surah data object
 * @throws {Error} - If surah number is invalid or API fails
 */
async function fetchSurah(surahNumber, edition = 'quran-uthmani') {
    // Validate surah number FIRST
    if (!validateSurahNumber(surahNumber)) {
        throw new Error(`Invalid surah number: ${surahNumber}. Must be between 1 and 114.`);
    }
    
    const num = parseInt(surahNumber, 10);
    const apiUrl = `${QURAN_API_BASE}/surah/${num}/${edition}`;
    
    console.log(`[Surah] Fetching surah ${num} from: ${apiUrl}`);
    
    try {
        const response = await fetch(apiUrl);
        
        // Log response status
        console.log(`[Surah] Response status: ${response.status} ${response.statusText}`);
        
        // Check for HTTP errors
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Check content type
        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.includes('application/json')) {
            throw new Error(`Unexpected content type: ${contentType}`);
        }
        
        const data = await response.json();
        
        // Log API response status
        console.log(`[Surah] API status: ${data.status}, code: ${data.code}`);
        
        // Check for API-level errors
        if (data.status === 'offline' || data.error) {
            throw new Error(data.message || data.error || 'API returned offline/error status');
        }
        
        // Validate response structure
        if (data.code !== 200) {
            throw new Error(`API returned code ${data.code}, expected 200`);
        }
        
        if (!data.data) {
            throw new Error('API response missing data field');
        }
        
        if (!data.data.ayahs || !Array.isArray(data.data.ayahs)) {
            throw new Error('API response missing valid ayahs array');
        }
        
        console.log(`[Surah] Successfully fetched surah ${num}: ${data.data.name} (${data.data.ayahs.length} ayahs)`);
        return data.data;
        
    } catch (error) {
        // Log detailed error information
        console.error(`[Surah] Failed to fetch surah ${num}:`, {
            error: error.message,
            url: apiUrl,
            surahNumber: num,
            timestamp: new Date().toISOString()
        });
        throw error;
    }
}

async function initQuran() {
    await loadSurahsList();
    setupQuranEventListeners();
}

async function loadSurahsList() {
    const apiUrl = `${QURAN_API_BASE}/surah`;
    
    try {
        const response = await fetch(apiUrl);
        
        // Check if it's our offline response
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const text = await response.text();
            const data = JSON.parse(text);
            
            // Check if it's an offline/error response
            if (data.status === 'offline' || data.error) {
                console.log('Surah list not available offline');
                // Show a message but don't block the app
                showToast('قائمة السور غير متاحة - يرجى الاتصال بالإنترنت');
                return;
            }
            
            if (data.code === 200 && data.data) {
                appState.surahs = data.data;
                populateSurahDropdown(data.data);
                populateSurahSelect(data.data);
                return;
            }
        }
        
        // Standard JSON response
        const data = await response.json();
        if (data.code === 200 && data.data) {
            appState.surahs = data.data;
            populateSurahDropdown(data.data);
            populateSurahSelect(data.data);
        }
    } catch (error) {
        console.error('Error loading surahs:', error);
        showToast('تعذر تحميل قائمة السور');
    }
}

function populateSurahDropdown(surahs) {
    const select = document.getElementById('surahSelect');
    select.innerHTML = '<option value="">-- اختر سورة --</option>';
    
    surahs.forEach(surah => {
        const option = document.createElement('option');
        option.value = surah.number;
        option.textContent = `${surah.number}. ${surah.englishName} - ${surah.name}`;
        option.dataset.name = surah.name;
        option.dataset.englishName = surah.englishName;
        option.dataset.meaning = surah.englishNameTranslation;
        select.appendChild(option);
    });
}

function populateSurahSelect(surahs) {
    // Already populated in populateSurahDropdown
}

function setupQuranEventListeners() {
    // Surah dropdown change
    safeAddEventListener('surahSelect', 'change', function(e) {
        const surahNumber = parseInt(e.target.value);
        if (surahNumber && validateSurahNumber(surahNumber)) {
            console.log(`[Surah] User selected surah: ${surahNumber}`);
            loadSurah(surahNumber);
        } else if (surahNumber) {
            console.error(`[Surah] Invalid surah number selected: ${surahNumber}`);
            showError('رقم السورة غير صالح. يرجى اختيار سورة من القائمة.');
        }
    });
    
    // Search input - use optional chaining for optional elements
    const searchInput = document.getElementById('surahSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.trim().toLowerCase();
            const clearBtn = document.getElementById('clearSearch');
            
            if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';
            filterSurahs(query);
        });
        
        // Clear search
        safeAddEventListener('clearSearch', 'click', function() {
            searchInput.value = '';
            this.style.display = 'none';
            filterSurahs('');
        });
    }
    
    // Retry button
    safeAddEventListener('retryBtn', 'click', function() {
        if (appState.selectedSurah && validateSurahNumber(appState.selectedSurah)) {
            console.log(`[Surah] Retrying load for surah: ${appState.selectedSurah}`);
            loadSurah(appState.selectedSurah);
        } else {
            console.error(`[Surah] Cannot retry - invalid selectedSurah: ${appState.selectedSurah}`);
            showError('يرجى اختيار سورة صالحة من القائمة.');
        }
    });
    
    // View mode toggle - Cards (آيات مفردة)
    safeAddEventListener('viewModeCards', 'click', function() {
        setQuranViewMode('cards');
    });
    
    // View mode toggle - Full Page (صفحة كاملة)
    safeAddEventListener('viewModeFull', 'click', function() {
        setQuranViewMode('full');
    });
    
    // Audio controls
    safeAddEventListener('reciterSelect', 'change', function(e) {
        const selectedReciter = e.target.value;
        audioState.currentReciter = selectedReciter;
        
        // Sync modal reciter dropdown if modal is open
        const modalReciterSelect = document.getElementById('modalReciterSelect');
        if (modalReciterSelect && ['minshawi', 'hussary', 'abdulbasit'].includes(selectedReciter)) {
            modalReciterSelect.value = selectedReciter;
        }
        
        // If playing, restart with new reciter
        if (audioState.isPlaying && audioState.currentSurah) {
            playSurahAudio(audioState.currentSurah);
        }
    });
    
    safeAddEventListener('audioPlayBtn', 'click', function() {
        if (audioState.isPlaying) {
            stopAudio();
        } else {
            // Get current selected surah
            const surahNum = appState.selectedSurah;
            if (surahNum && validateSurahNumber(surahNum)) {
                console.log(`[Audio] Playing surah: ${surahNum}`);
                playSurahAudio(surahNum);
            } else {
                console.warn(`[Audio] Cannot play - invalid surah: ${surahNum}`);
                showToast('يرجى اختيار سورة أولاً');
            }
        }
    });
}

/**
 * Set Quran view mode and update UI
 * @param {string} mode - 'cards' or 'full'
 */
async function setQuranViewMode(mode) {
    appState.quranViewMode = mode;
    
    // Update button states
    const cardsBtn = document.getElementById('viewModeCards');
    const fullBtn = document.getElementById('viewModeFull');
    
    if (cardsBtn && fullBtn) {
        cardsBtn.classList.toggle('active', mode === 'cards');
        fullBtn.classList.toggle('active', mode === 'full');
    }
    
    // Update view visibility
    const cardsView = document.getElementById('ayahsGrid');
    const fullView = document.getElementById('ayahsFullPage');
    
    if (cardsView && fullView) {
        if (mode === 'cards') {
            cardsView.style.display = '';
            fullView.style.display = 'none';
        } else {
            cardsView.style.display = 'none';
            fullView.style.display = 'block';
            
            // If switching to full view, render it (will fetch data if needed)
            await renderFullPageView();
        }
        
        // Ensure bookmark highlights are applied in both views when switching
        updateBookmarkHighlight();
        updateFullPageBookmarkHighlight();
    }
    
    console.log('[Quran] View mode changed to:', mode);
}

/**
 * Render full page (mushaf-style) view
 * This is an async function that waits for data or fetches it if missing
 * @param {object} [passedData] - Optional surah data passed directly (preferred)
 */
async function renderFullPageView(passedData) {
    const container = document.getElementById('ayahsFullPage');
    
    console.log('[Quran] renderFullPageView called with data:', !!passedData);
    
    if (!container) {
        console.error('[Quran] Full page container not found!');
        return;
    }
    
    // Show loading state in the container
    container.innerHTML = '<p style="color:#333;padding:40px;text-align:center;font-size:1.2rem;">جاري تحميل الآيات...</p>';
    container.style.display = 'block';
    
    // Use passed data if available, otherwise check state
    let surahData = passedData || appState.currentSurahData;
    const selectedSurah = appState.selectedSurah;
    
    // If no data, fetch it
    if (!surahData || !surahData.ayahs) {
        console.log('[Quran] No data available, fetching surah:', selectedSurah);
        
        if (!selectedSurah) {
            container.innerHTML = '<p style="color:#333;padding:40px;text-align:center;">يرجى اختيار سورة أولاً</p>';
            return;
        }
        
        // Fetch the surah data
        try {
            const apiUrl = `${QURAN_API_BASE}/surah/${selectedSurah}/quran-uthmani`;
            console.log('[Quran] Fetching from API:', apiUrl);
            
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            if (data.code === 200 && data.data) {
                surahData = data.data;
                appState.currentSurahData = surahData; // Store for next time
                console.log('[Quran] Data fetched successfully:', surahData.name);
            } else {
                throw new Error('Invalid API response');
            }
        } catch (error) {
            console.error('[Quran] Failed to fetch surah:', error);
            container.innerHTML = '<p style="color:#c00;padding:40px;text-align:center;">حدث خطأ في تحميل السورة</p>';
            return;
        }
    }
    
    // Now we have data, render it
    console.log('[Quran] Rendering surah:', surahData.name, 'with', surahData.ayahs?.length, 'ayahs');
    
    const ayahs = surahData.ayahs || [];
    const showBismillah = surahData.number !== 9;
    
    // Build ayahs HTML using a simple loop
    let ayahsHtml = '';
    for (let i = 0; i < ayahs.length; i++) {
        const ayah = ayahs[i];
        const isLastAyah = (i === ayahs.length - 1);
        const endingClass = isLastAyah ? ' ending' : '';
        
        // Check if this ayah is bookmarked (in full page view, surah is surahData.number)
        const isBookmarkedAyah = isBookmarked(surahData.number, ayah.numberInSurah);
        const bookmarkClass = isBookmarkedAyah ? ' bookmarked-ayah' : '';
        
        // Append each ayah text with its number - clickable for tafsir - with simple data-index for tafsir API
        ayahsHtml += `<span class="ayah-inline${endingClass}${bookmarkClass}" data-index="${ayah.numberInSurah}">${ayah.text} <span class="ayah-inline-num tafsir-ayah" data-surah="${surahData.number}" data-index="${ayah.numberInSurah}">${ayah.numberInSurah}</span></span> `;
    }
    
    // Build the full page HTML
    const fullPageHtml = `
        <div class="surah-title-page">
            <h3>${surahData.name}</h3>
            ${showBismillah ? `<div class="bismillah-page">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>` : ''}
        </div>
        <div class="safha-content">
            ${ayahsHtml}
        </div>
    `;
    
    // Set the innerHTML
    container.innerHTML = fullPageHtml;
    
    // Add click event delegation for tafsir using simple data-index attribute
    container.querySelectorAll('.tafsir-ayah').forEach(numSpan => {
        numSpan.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Simple extraction using data-index attribute
            const surahNum = parseInt(this.dataset.surah, 10) || appState.selectedSurah;
            const ayahNum = parseInt(this.dataset.index, 10);
            
            if (surahNum && ayahNum) {
                console.log(`[Tafsir] Clicked: Surah ${surahNum}, Ayah ${ayahNum}`);
                showTafsirModal(surahNum, ayahNum);
            } else {
                console.error('[Tafsir] Could not extract ayah number from data-index');
            }
        });
    });
    
    console.log('[Quran] Full page rendered with', ayahs.length, 'ayahs');
}

function filterSurahs(query) {
    const select = document.getElementById('surahSelect');
    const options = select.querySelectorAll('option');
    
    options.forEach(option => {
        if (option.value === '') {
            option.style.display = '';
            return;
        }
        
        const name = (option.dataset.name || '').toLowerCase();
        const englishName = (option.dataset.englishName || '').toLowerCase();
        const meaning = (option.dataset.meaning || '').toLowerCase();
        
        if (!query || name.includes(query) || englishName.includes(query) || meaning.includes(query) || query === option.value) {
            option.style.display = '';
        } else {
            option.style.display = 'none';
        }
    });
}

async function loadSurah(surahNumber) {
    // Validate surah number first
    if (!validateSurahNumber(surahNumber)) {
        showError('رقم السورة غير صالح. يرجى اختيار سورة من القائمة.');
        return;
    }
    
    const num = parseInt(surahNumber, 10);
    appState.selectedSurah = num;
    
    // Stop any currently playing audio when loading new surah
    if (audioState.isPlaying) {
        stopAudio();
    }
    
    // Show loading
    hideAllStates();
    safeSetDisplay('loadingState', 'block');
    
    try {
        // Use the new fetchSurah helper with proper validation and error handling
        const surahData = await fetchSurah(num);
        
        // Store and display the surah
        appState.currentSurahData = surahData;
        displaySurah(surahData);
        
        // Cache for offline use
        cacheSurahInSW(num);
        
        console.log(`[Surah] Successfully loaded surah ${num}: ${surahData.name}`);
        
    } catch (error) {
        // Error already logged in fetchSurah, just handle UI recovery
        console.error(`[Surah] loadSurah failed for surah ${num}:`, error.message);
        
        // Try to load from SW cache on any error
        const cachedData = await loadSurahFromCache(num);
        if (cachedData) {
            displaySurah(cachedData);
            showToast('تم تحميل السورة من الذاكرة المؤقتة');
        } else {
            showError('تعذر تحميل السورة. يرجى المحاولة مرة أخرى.');
        }
    }
}

// Cache surah in service worker
function cacheSurahInSW(surahNumber) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'CACHE_SURAH',
            surahNumber: surahNumber
        });
    }
}

// Load surah directly from service worker cache
async function loadSurahFromCache(surahNumber) {
    // Validate surah number
    if (!validateSurahNumber(surahNumber)) {
        console.warn(`[Surah] Invalid surah number for cache load: ${surahNumber}`);
        return null;
    }
    
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
        console.log(`[Surah] Service worker not available for cache load`);
        return null;
    }
    
    try {
        const sw = navigator.serviceWorker.controller;
        const num = parseInt(surahNumber, 10);
        const apiUrl = `${QURAN_API_BASE}/surah/${num}/quran-uthmani`;
        
        console.log(`[Surah] Attempting to load surah ${num} from cache...`);
        
        // Try to get from SW via message
        // For now, we'll try fetching directly which will hit SW cache
        const response = await fetch(apiUrl);
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                if (data.code === 200 && data.data) {
                    console.log(`[Surah] Successfully loaded surah ${num} from cache`);
                    return data.data;
                }
            }
        }
    } catch (error) {
        console.error(`[Surah] Could not load from cache:`, {
            error: error.message,
            surahNumber: surahNumber,
            timestamp: new Date().toISOString()
        });
    }
    return null;
}

function displaySurah(surahData) {
    // Update info card
    const infoCard = safeGetElement('surahInfoCard');
    if (infoCard) infoCard.style.display = 'block';
    
    safeSetText('surahNameDisplay', surahData.name);
    safeSetText('surahMeaningDisplay', surahData.englishNameTranslation);
    safeSetText('ayahCountDisplay', surahData.numberOfAyahs);
    safeSetText('revelationTypeDisplay', surahData.revelationType === 'Meccan' ? 'مكية' : 'مدنية');
    
    // Show/hide Bismillah (skip for Surah 9)
    const bismillahContainer = safeGetElement('bismillahContainer');
    if (bismillahContainer) bismillahContainer.style.display = surahData.number === 9 ? 'none' : 'block';
    
    // Show ayahs container
    hideAllStates();
    safeSetDisplay('ayahsContainer', 'block');
    
    // Display ayahs based on current view mode
    displayAyahs(surahData.ayahs, surahData.number);
    
    // Ensure bookmark highlight is applied after rendering
    updateBookmarkHighlight();
    
    // Also prepare full page view (render based on current mode)
    if (appState.quranViewMode === 'full') {
        // Ensure full view is visible, cards is hidden
        const cardsView = document.getElementById('ayahsGrid');
        const fullView = document.getElementById('ayahsFullPage');
        if (cardsView) cardsView.style.display = 'none';
        if (fullView) fullView.style.display = 'block';
        
        // Render full page view with passed data directly
        renderFullPageView(surahData);
    } else {
        // Ensure cards view is visible, full view is hidden
        const cardsView = document.getElementById('ayahsGrid');
        const fullView = document.getElementById('ayahsFullPage');
        if (cardsView) cardsView.style.display = '';
        if (fullView) fullView.style.display = 'none';
    }
    
    showToast(`تم تحميل سورة ${surahData.name}`);
}

function displayAyahs(ayahs, surahNumber) {
    const container = document.getElementById('ayahsGrid');
    container.innerHTML = '';
    
    ayahs.forEach((ayah, index) => {
        const card = document.createElement('div');
        card.className = 'ayah-card';
        card.id = `ayah-${ayah.numberInSurah}`; // Keep for scrollIntoView compatibility
        card.dataset.index = ayah.numberInSurah; // Simple data-index for tafsir API
        card.dataset.surah = surahNumber;
        
        // Check if this ayah is bookmarked
        const isThisBookmarked = isBookmarked(surahNumber, ayah.numberInSurah);
        if (isThisBookmarked) {
            card.classList.add('bookmarked');
        }
        
        card.innerHTML = `
            <div class="ayah-number">${ayah.numberInSurah}</div>
            <div class="ayah-text${isThisBookmarked ? ' bookmarked-ayah' : ''}">${ayah.text}</div>
        `;
        
        // Click to open tafsir - uses simple data-index attribute
        card.addEventListener('click', function() {
            const ayahNum = parseInt(this.dataset.index, 10) || ayah.numberInSurah;
            
            if (ayahNum) {
                console.log(`[Tafsir] Card clicked: Surah ${surahNumber}, Ayah ${ayahNum}`);
                showTafsirModal(surahNumber, ayahNum);
            } else {
                console.error('[Tafsir] Could not extract ayah number from data-index');
            }
        });
        
        // Right-click to toggle bookmark
        card.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            if (isBookmarked(surahNumber, ayah.numberInSurah)) {
                removeBookmark();
            } else {
                setBookmark(surahNumber, ayah.numberInSurah);
            }
        });
        
        container.appendChild(card);
    });
}

function hideAllStates() {
    safeSetDisplay('loadingState', 'none');
    safeSetDisplay('ayahsContainer', 'none');
    safeSetDisplay('emptyState', 'none');
    safeSetDisplay('errorState', 'none');
}

function showError(message) {
    hideAllStates();
    safeSetText('errorMessage', message);
    safeSetDisplay('errorState', 'block');
    safeSetDisplay('surahInfoCard', 'none');
}

// ==========================================
// AUDIO MODULE - Quran Audio Playback
// ==========================================

/**
 * Play surah audio for the selected reciter
 * @param {number} surahNumber - Surah number (1-114)
 * @param {boolean} useFallback - Whether to use fallback server
 */
function playSurahAudio(surahNumber, useFallback = false) {
    // IMMEDIATELY stop any currently playing audio
    stopAudio();
    
    const reciter = reciters[audioState.currentReciter];
    if (!reciter) {
        showToast('القارئ غير متوفر');
        return;
    }
    
    // Format surah number to padded string (e.g., 1 -> "001")
    const surahStr = String(surahNumber).padStart(3, '0');
    const server = useFallback && reciter.fallback ? reciter.fallback : reciter.server;
    const audioUrl = `${server}${surahStr}.mp3`;
    
    console.log('[Audio] Loading:', audioUrl, useFallback ? '(fallback)' : '');
    
    // Use the SINGLE global audio element
    const audio = initGlobalAudio();
    
    // Force stop any ongoing playback and reset
    audio.pause();
    audio.currentTime = 0;
    
    // Set new source
    audio.src = audioUrl;
    audioState.currentSurah = surahNumber;
    
    // Show loading state - button shows "loading" (stop icon) while loading
    updateAudioButton('loading');
    showToast(`جاري تحميل صوت ${reciter.name}...`);
    
    // Handle successful load and play
    audio.addEventListener('canplay', function onCanPlay() {
        audio.removeEventListener('canplay', onCanPlay);
        audio.play()
            .then(() => {
                audioState.isPlaying = true;
                updateAudioButton(true);
                showToast(`جاري تشغيل سورة ${appState.currentSurahData?.name || surahNumber}`);
            })
            .catch(err => {
                console.error('[Audio] Play error:', err);
                showToast('فشل في تشغيل الصوت');
                audioState.isPlaying = false;
                updateAudioButton(false);
            });
    });
    
    // Handle errors - try fallback if primary fails
    audio.addEventListener('error', function onError(e) {
        audio.removeEventListener('error', onError);
        console.error('[Audio] Error loading audio:', e);
        
        if (!useFallback && reciter.fallback && reciter.fallback !== reciter.server) {
            console.log('[Audio] Trying fallback server...');
            // Small delay to allow cleanup
            setTimeout(() => playSurahAudio(surahNumber, true), 100);
        } else {
            showToast('تعذر تحميل الصوت - جرب قارئ آخر');
            audioState.isPlaying = false;
            updateAudioButton(false);
        }
    });
    
    // Start loading
    audio.load();
}

/**
 * Stop and reset all audio - IMMEDIATELY kills any playing audio
 */
function stopAudio() {
    // Use global audio element if exists
    if (globalAudio) {
        globalAudio.pause();
        globalAudio.currentTime = 0;
        globalAudio.src = ''; // Clear source to ensure no audio plays
    }
    
    // Reset state
    audioState.isPlaying = false;
    audioState.currentSurah = null;
    audioState.currentAyahNumber = null;
    
    // Update UI to show play icon (stopped state)
    updateAudioButton(false);
}

/**
 * Update play/stop button appearance based on actual audio state
 * @param {boolean|string} state - true=playing, false=stopped, 'loading'=loading
 */
function updateAudioButton(state) {
    const btn = document.getElementById('audioPlayBtn');
    if (btn) {
        const icon = btn.querySelector('i');
        
        if (state === 'loading') {
            // Loading state - show spinner/loading icon
            btn.classList.add('loading');
            btn.classList.remove('playing');
            icon.className = 'fas fa-spinner fa-spin';
            btn.title = 'جاري التحميل...';
        } else if (state === true) {
            // Playing state - show stop icon
            btn.classList.add('playing');
            btn.classList.remove('loading');
            icon.className = 'fas fa-stop';
            btn.title = 'إيقاف';
        } else {
            // Stopped state - show play icon
            btn.classList.remove('playing', 'loading');
            icon.className = 'fas fa-play';
            btn.title = 'تشغيل';
        }
    }
}

// ==========================================
// SINGLE AYAH AUDIO - Islamic Network CDN with Fallback
// ==========================================

// Islamic Network edition identifiers for ayah-level audio
// Verify these at: https://cdn.islamic.network/quran/info/by-ayah/info.txt
const islamicNetworkEditions = {
    'minshawi': 'ar.minshawi',           // Mahmoud Khalil Al-Minshawi (128kbps available)
    'hussary': 'ar.husary',              // Mahmoud Khalil Al-Hussary (128kbps available)
    'abdulbasit': 'ar.abdulbasitmurattal' // AbdulBasit AbdulSamad Murattal (64kbps only!)
};

// Islamic Network bitrate per edition (some editions only available at certain bitrates)
const editionBitrates = {
    'ar.abdulbasitmurattal': 64  // AbdulBasit only available at 64kbps, not 128kbps
};

// Default bitrate for Islamic Network CDN
const DEFAULT_BITRATE = 128;

// Backup: EveryAyah folder name mapping (used if Islamic Network fails)
const everyAyahReciters = {
    'abdulbasit': 'AbdulBasit',
    'abdulbasit_murattal': 'AbdulBasit_Murattal',
    'minshawi': 'Mishary_Rashid',
    'minshawi_murattal': 'Mishary_Rashid',
    'yaser': 'Yasser_Ad-Dussary',
    'hussary': 'Hussary',
    'hussary_murattal': 'Hussary_Murattal',
    'afasy': 'Alafasy',
    'shatri': 'Shatri',
    'hanirifai': 'Hani_Rifai'
};

// Quran structure: Number of ayahs in each surah (1-114)
const surahAyahCounts = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110,
    98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88,
    75, 85, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52,
    44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
    15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
];

/**
 * Convert surah:ayah to global ayah number (1-6236)
 * @param {number} surahNumber - Surah number (1-114)
 * @param {number} ayahNumber - Ayah number within surah
 * @returns {number} Global ayah number
 */
function getGlobalAyahNumber(surahNumber, ayahNumber) {
    let globalNum = 0;
    for (let i = 0; i < surahNumber - 1; i++) {
        globalNum += surahAyahCounts[i];
    }
    return globalNum + ayahNumber;
}

// Current ayah being displayed in modal
let currentModalAyah = {
    surah: null,
    ayah: null
};

// Store ayah audio listeners at module scope so they can be removed
let ayahAudioListeners = {
    onCanPlay: null,
    onError: null,
    onEnded: null
};

/**
 * Clean up ayah-specific audio listeners
 */
function cleanupAyahAudioListeners() {
    if (globalAudio) {
        if (ayahAudioListeners.onCanPlay) {
            globalAudio.removeEventListener('canplay', ayahAudioListeners.onCanPlay);
            ayahAudioListeners.onCanPlay = null;
        }
        if (ayahAudioListeners.onError) {
            globalAudio.removeEventListener('error', ayahAudioListeners.onError);
            ayahAudioListeners.onError = null;
        }
        if (ayahAudioListeners.onEnded) {
            globalAudio.removeEventListener('ended', ayahAudioListeners.onEnded);
            ayahAudioListeners.onEnded = null;
        }
    }
}

/**
 * Play a single ayah audio with retry logic
 * Primary: Islamic Network CDN
 * Backup: EveryAyah
 * @param {number} surahNumber - Surah number (1-114)
 * @param {number} ayahNumber - Ayah number within the surah
 * @param {number} retryCount - Current retry attempt (internal)
 */
function playAyahAudio(surahNumber, ayahNumber, retryCount = 0) {
    // IMMEDIATELY clean up old listeners and stop audio
    cleanupAyahAudioListeners();
    stopAudio();
    
    const reciterKey = audioState.currentReciter;
    const globalAyahNum = getGlobalAyahNumber(surahNumber, ayahNumber);
    
    // Update state
    currentModalAyah.surah = surahNumber;
    currentModalAyah.ayah = ayahNumber;
    
    // Mark this as ayah-level playback (use surah:ayah as unique identifier)
    // This allows stop button to detect modal audio vs surah audio
    audioState.currentSurah = `ayah:${surahNumber}:${ayahNumber}`;
    audioState.currentAyahNumber = ayahNumber;
    
    // Get edition identifier
    let edition = islamicNetworkEditions[reciterKey];
    if (!edition) {
        // Fallback to default if reciter not in Islamic Network editions
        edition = 'ar.minshawi'; // Default to Al-Minshawi
    }
    
    // Get bitrate for this edition (some only available at 64kbps)
    const bitrate = editionBitrates[edition] || DEFAULT_BITRATE;
    
    // Determine which URL to try and max retries
    const useEveryAyah = retryCount >= 3; // After 3 Islamic Network retries, try EveryAyah
    const maxRetries = useEveryAyah ? 2 : 3; // 3 retries for Islamic Network, 2 for EveryAyah
    
    // Build URLs
    let audioUrl;
    if (useEveryAyah) {
        const everyAyahReciter = everyAyahReciters[reciterKey] || 'AbdulBasit';
        const surahStr = String(surahNumber).padStart(3, '0');
        const ayahStr = String(ayahNumber).padStart(3, '0');
        audioUrl = `https://everyayah.com/data/${everyAyahReciter}_128kbps/${surahStr}${ayahStr}.mp3`;
        console.log(`[AyahAudio] Trying EveryAyah (backup): ${audioUrl}`);
    } else {
        audioUrl = `https://cdn.islamic.network/quran/audio/${bitrate}/${edition}/${globalAyahNum}.mp3`;
        console.log(`[AyahAudio] Trying Islamic Network (${bitrate}kbps): ${audioUrl}`);
    }
    
    // Show loading/retrying state
    const audioBtn = document.getElementById('ayahAudioBtn');
    if (audioBtn) {
        audioBtn.classList.add('loading');
        if (retryCount > 0) {
            audioBtn.innerHTML = `<i class="fas fa-sync fa-spin"></i><span>إعادة ${retryCount}...</span>`;
            showToast(`جاري إعادة المحاولة... (${retryCount}/${maxRetries})`);
        } else {
            audioBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>جاري...</span>';
        }
    }
    
    // Use global audio element
    const audio = initGlobalAudio();
    
    // Force stop and reset
    audio.pause();
    audio.currentTime = 0;
    
    // Set new source
    audio.src = audioUrl;
    
    // Handle successful load and play (store in module scope for cleanup)
    ayahAudioListeners.onCanPlay = function() {
        audio.removeEventListener('canplay', ayahAudioListeners.onCanPlay);
        audio.play()
            .then(() => {
                audioState.isPlaying = true;
                console.log('[AyahAudio] Playing ayah', ayahNumber, 'of surah', surahNumber);
                
                // Update button to show playing state
                if (audioBtn) {
                    audioBtn.classList.remove('loading');
                    audioBtn.classList.add('playing');
                    audioBtn.innerHTML = '<i class="fas fa-stop"></i><span>إيقاف</span>';
                }
            })
            .catch(err => {
                console.error('[AyahAudio] Play error:', err);
                showToast('فشل في تشغيل صوت الآية');
                resetAyahAudioButton();
            });
    };
    audio.addEventListener('canplay', ayahAudioListeners.onCanPlay);
    
    // Handle errors with retry
    ayahAudioListeners.onError = function(e) {
        audio.removeEventListener('error', ayahAudioListeners.onError);
        console.error(`[AyahAudio] Error (attempt ${retryCount + 1}):`, e);
        
        if (retryCount < maxRetries) {
            // Exponential backoff: 500ms, 1000ms, 2000ms...
            const delay = 500 * Math.pow(2, retryCount);
            console.log(`[AyahAudio] Retrying in ${delay}ms...`);
            setTimeout(() => {
                playAyahAudio(surahNumber, ayahNumber, retryCount + 1);
            }, delay);
        } else {
            // All retries exhausted
            if (!useEveryAyah) {
                // Try EveryAyah as final fallback
                console.log('[AyahAudio] Islamic Network failed, trying EveryAyah...');
                setTimeout(() => {
                    playAyahAudio(surahNumber, ayahNumber, 3);
                }, 100);
            } else {
                // Both sources failed
                console.error('[AyahAudio] All sources failed');
                showToast('تعذر تحميل الصوت - جرب قارئ آخر');
                resetAyahAudioButton();
            }
        }
    };
    audio.addEventListener('error', ayahAudioListeners.onError);
    
    // Handle audio ended
    ayahAudioListeners.onEnded = function() {
        audio.removeEventListener('ended', ayahAudioListeners.onEnded);
        audioState.isPlaying = false;
        resetAyahAudioButton();
        console.log('[AyahAudio] Finished playing ayah');
    };
    audio.addEventListener('ended', ayahAudioListeners.onEnded);
    
    // Start loading
    audio.load();
}

/**
 * Reset the ayah audio button to default state
 */
function resetAyahAudioButton() {
    const audioBtn = document.getElementById('ayahAudioBtn');
    if (audioBtn) {
        audioBtn.classList.remove('loading', 'playing');
        audioBtn.innerHTML = '<i class="fas fa-play"></i><span>تشغيل</span>';
    }
}

/**
 * Stop any playing ayah audio
 */
function stopAyahAudio() {
    // Clean up listeners FIRST
    cleanupAyahAudioListeners();
    
    if (globalAudio) {
        globalAudio.pause();
        globalAudio.currentTime = 0;
        globalAudio.src = ''; // Clear source to stop immediately
    }
    audioState.isPlaying = false;
    audioState.currentSurah = null;
    audioState.currentAyahNumber = null;
    resetAyahAudioButton();
}

/**
 * Initialize ayah audio button event listener
 * Uses onclick assignment (not addEventListener) to prevent stacking
 */
function initAyahAudioButton() {
    const audioBtn = document.getElementById('ayahAudioBtn');
    if (audioBtn) {
        // Remove existing listener first (prevent stacking)
        audioBtn.onclick = null;
        
        // Use onclick assignment for immediate response
        audioBtn.onclick = function() {
            if (!currentModalAyah.surah || !currentModalAyah.ayah) {
                showToast('يرجى اختيار آية أولاً');
                return;
            }
            
            // Toggle play/stop - immediate execution
            // Check if we're currently playing this specific ayah
            const currentAyahKey = `ayah:${currentModalAyah.surah}:${currentModalAyah.ayah}`;
            if (audioState.isPlaying && audioState.currentSurah === currentAyahKey) {
                // IMMEDIATELY stop audio on first click
                stopAyahAudio();
            } else {
                playAyahAudio(currentModalAyah.surah, currentModalAyah.ayah);
            }
        };
    }
}

// ==========================================
// TAFSIR MODULE - AL-MUYASSAR TAFSIR
// ==========================================

/**
 * Extract ayah index from element's ID attribute
 * Matches pattern: id="ayah-${index}" → returns index as integer
 * @param {HTMLElement} element - The element with id="ayah-${index}"
 * @returns {number|null} - The ayah number or null if not found
 */
function getAyahIndexFromId(element) {
    if (!element) return null;
    const id = element.id || '';
    const match = id.match(/^ayah-(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract ayah index from clicked element or its parent
 * Handles: <span class="tafsir-ayah"> or <div class="ayah-card">
 * Falls back to parent's id="ayah-${index}" if needed
 * @param {Event} event - Click event
 * @returns {number|null} - The ayah number or null
 */
function extractAyahFromClick(event) {
    const target = event.target;
    
    // Check data-ayah attribute first (primary source)
    if (target.dataset && target.dataset.ayah) {
        return parseInt(target.dataset.ayah, 10);
    }
    
    // Check id="ayah-${index}" on target or parent
    const ayahIndex = getAyahIndexFromId(target) || getAyahIndexFromId(target.parentElement);
    if (ayahIndex) return ayahIndex;
    
    // Check for parent ayah-card or ayah-inline
    let parent = target.parentElement;
    while (parent) {
        const found = getAyahIndexFromId(parent);
        if (found) return found;
        
        // Also check data-ayah on parent
        if (parent.dataset && parent.dataset.ayah) {
            return parseInt(parent.dataset.ayah, 10);
        }
        parent = parent.parentElement;
    }
    
    return null;
}

/**
 * Validate inputs for tafsir fetch
 * @param {string} editionId - Edition ID to validate
 * @param {number} surahNumber - Surah number to validate (1-114)
 * @param {number} ayahNumberInSurah - Ayah number within surah to validate
 * @returns {object} - { valid: boolean, error?: string }
 */
function validateTafsirInputs(editionId, surahNumber, ayahNumberInSurah) {
    // Validate edition ID - valid IDs (Ibn Kathir from quranapi, others from alquran.cloud)
    const validEditionIds = ['ar.ibn-kathir', 'ar.baghawi', 'ar.muyassar'];
    if (!editionId || !validEditionIds.includes(editionId)) {
        return { valid: false, error: `Invalid edition ID: ${editionId}. Must be one of: ${validEditionIds.join(', ')}` };
    }
    
    // Validate surah number
    const surahNum = parseInt(surahNumber, 10);
    if (isNaN(surahNum) || surahNum < 1 || surahNum > 114) {
        return { valid: false, error: `Invalid surah number: ${surahNumber}. Must be between 1 and 114.` };
    }
    
    // Validate ayah number (1 to max ayahs for that surah)
    const ayahNum = parseInt(ayahNumberInSurah, 10);
    if (isNaN(ayahNum) || ayahNum < 1) {
        return { valid: false, error: `Invalid ayah number: ${ayahNumberInSurah}. Must be 1 or greater.` };
    }
    
    // Check against surah ayah count
    const maxAyahs = SURAH_AYAH_COUNTS[surahNum - 1] || 0;
    if (ayahNum > maxAyahs) {
        return { valid: false, error: `Invalid ayah number: ${ayahNum}. Surah ${surahNum} only has ${maxAyahs} ayahs.` };
    }
    
    return { valid: true };
}

/**
 * Fetch FULL Tafsir text for a specific ayah
 * 
 * API Endpoint: https://api.alquran.cloud/v1/ayah/{globalAyahIndex}/{editionId}
 * 
 * Edition IDs for Full Text:
 * - ar.muyassar: التفسير الميسر (Al-Muyassar)
 * - ar.ibn-kathir: تفسير ابن كثير (Ibn Kathir - Full detailed version)
 * - ar.saadi: تفسير السعدي (Al-Saadi - Taysir al-Karim al-Rahman)
 * - ar.jalalayn: تفسير الجلالين (Al-Jalalyn - naturally concise)
 * 
 * @param {string} editionId - Edition ID
 * @param {number} surahNumber - Surah number (1-114)
 * @param {number} ayahNumberInSurah - Ayah number within the surah (1-indexed)
 * @returns {Promise<string>} Full tafsir text (entire response from API)
 */
/**
 * Fetch tafsir from appropriate API based on edition
 * 
 * Routing:
 * - ar.ibn-kathir: quranapi.pages.dev (only API with Ibn Kathir)
 * - ar.baghawi, ar.muyassar: alquran.cloud
 * 
 * @param {string} editionId - Edition ID
 * @param {number} surahNumber - Surah number (1-114)
 * @param {number} ayahNumberInSurah - Ayah number within the surah (1-indexed)
 * @returns {Promise<string>} Full tafsir text
 */
async function fetchTafsir(editionId, surahNumber, ayahNumberInSurah) {
    // Validate inputs first
    const validation = validateTafsirInputs(editionId, surahNumber, ayahNumberInSurah);
    if (!validation.valid) {
        console.error(`[Tafsir] Validation failed:`, validation.error);
        throw new Error(validation.error);
    }
    
    const surahNum = parseInt(surahNumber, 10);
    const ayahNum = parseInt(ayahNumberInSurah, 10);
    
    // Determine which API to use based on edition
    const apiRoute = TAFSIR_API_ROUTE[editionId] || 'alquran';
    
    console.log(`[Tafsir] Fetching tafsir:`);
    console.log(`  - Edition: ${editionId}`);
    console.log(`  - Surah: ${surahNum}, Ayah in surah: ${ayahNum}`);
    console.log(`  - API Route: ${apiRoute}`);
    
    // Route to appropriate API
    if (apiRoute === 'quranapi') {
        return await fetchTafsirFromQuranAPI(surahNum, ayahNum, editionId);
    } else {
        return await fetchTafsirFromAlQuranCloud(surahNum, ayahNum, editionId);
    }
}

/**
 * Fetch tafsir from quranapi.pages.dev (for Ibn Kathir)
 */
/**
 * Fetch Arabic tafsir from spa5k/tafsir_api CDN (for Ibn Kathir in Arabic)
 * Endpoint: https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/{slug}/{surah}/{ayah}.json
 */
async function fetchTafsirFromQuranAPI(surahNum, ayahNum, editionId) {
    // Map editionId to CDN slug
    const slugMap = {
        'ar.ibn-kathir': 'ar-tafsir-ibn-kathir'
    };
    
    const slug = slugMap[editionId];
    if (!slug) {
        throw new Error(`No Arabic CDN endpoint for edition: ${editionId}`);
    }
    
    // Format: https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/ar-tafsir-ibn-kathir/1/1.json
    const apiUrl = `https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/${slug}/${surahNum}/${ayahNum}.json`;
    
    console.log(`[Tafsir] Using Arabic tafsir CDN (spa5k/tafsir_api)`);
    console.log(`  - API URL: ${apiUrl}`);
    
    try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Response format: { "ayah": 1, "surah": 1, "text": "..." }
        if (data.text) {
            console.log(`[Tafsir] Success: Arabic Ibn Kathir tafsir retrieved`);
            console.log(`[Tafsir] Length: ${data.text.length} characters`);
            return data.text;
        }
        
        throw new Error('Invalid response from Arabic tafsir CDN');
    } catch (error) {
        console.error(`[Tafsir] Error from Arabic tafsir CDN:`, error.message);
        throw error;
    }
}

/**
 * Fetch tafsir from alquran.cloud (for Baghawi, Muyassar)
 */
async function fetchTafsirFromAlQuranCloud(surahNum, ayahNum, editionId) {
    // Calculate global ayah number (1-6236) - This is critical for API!
    const globalAyahIndex = getGlobalAyahNumber(surahNum, ayahNum);
    
    // Validate global ayah index is within valid range (1-6236)
    if (globalAyahIndex < 1 || globalAyahIndex > 6236) {
        throw new Error(`Invalid global ayah index: ${globalAyahIndex}. Must be between 1 and 6236.`);
    }
    
    // API URL format: api.alquran.cloud/v1/ayah/{ayahIndex}/{editionId}
    const apiUrl = `${TAFSIR_API_BASE}/ayah/${globalAyahIndex}/${editionId}`;
    
    console.log(`[Tafsir] Using alquran.cloud`);
    console.log(`  - API URL: ${apiUrl}`);
    console.log(`  - Global ayah index: ${globalAyahIndex} (1-6236)`);
    
    try {
        const response = await fetch(apiUrl);
        
        // Log response details
        console.log(`[Tafsir] Response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.includes('application/json')) {
            throw new Error(`Unexpected content type: ${contentType}`);
        }
        
        const data = await response.json();
        
        // Log API response status
        console.log(`[Tafsir] API status: ${data.status}, code: ${data.code}`);
        
        if (data.data && data.data.text) {
            // CRITICAL: Verify the API returned the requested edition, not a fallback!
            const returnedEdition = data.data.edition?.identifier;
            if (returnedEdition && returnedEdition !== editionId) {
                console.error(`[Tafsir] EDITION MISMATCH! Requested: ${editionId}, Got: ${returnedEdition}`);
                console.error('[Tafsir] API returned fallback - likely invalid edition ID');
                throw new Error(`Invalid edition: ${editionId} not available. API returned ${returnedEdition} instead.`);
            }
            
            const textLength = data.data.text.length;
            console.log(`[Tafsir] Success: Surah ${surahNum}, Ayah ${ayahNum} (global: ${globalAyahIndex})`);
            console.log(`[Tafsir] Full text retrieved - Length: ${textLength} characters`);
            console.log(`[Tafsir] Edition verified: ${editionId}`);
            return data.data.text;
        } else if (data.error) {
            throw new Error(`API Error: ${data.error}`);
        } else if (data.data && data.data.error) {
            throw new Error(`API Error: ${data.data.error}`);
        } else {
            console.error('[Tafsir] Response data:', data);
            throw new Error('Invalid tafsir response - no text field');
        }
    } catch (error) {
        console.error(`[Tafsir] Error fetching for Surah ${surahNum}, Ayah ${ayahNum} (global: ${globalAyahIndex}):`, {
            error: error.message,
            url: apiUrl,
            editionId: editionId,
            timestamp: new Date().toISOString()
        });
        throw error;
    }
}

/**
 * Show Tafsir modal with loading state
 * @param {number} surahNumber - Surah number (1-114)
 * @param {number} ayahNumber - Ayah number within surah (numberInSurah)
 */
async function showTafsirModal(surahNumber, ayahNumber) {
    // Validate inputs
    if (!surahNumber || !ayahNumber || surahNumber < 1 || surahNumber > 114 || ayahNumber < 1) {
        console.error('[Tafsir] Invalid parameters:', { surahNumber, ayahNumber });
        return;
    }
    
    const modal = document.getElementById('tafsirModal');
    const modalContent = document.getElementById('tafsirContent');
    const modalTitle = document.getElementById('tafsirModalTitle');
    const modalReciterSelect = document.getElementById('modalReciterSelect');
    const modalTafsirSelect = document.getElementById('modalTafsirSelect');
    
    if (!modal) {
        console.error('Tafsir modal not found in DOM');
        return;
    }
    
    console.log(`[Tafsir] Opening modal for Surah ${surahNumber}, Ayah ${ayahNumber}`);
    
    // Set current ayah for audio playback
    currentModalAyah.surah = surahNumber;
    currentModalAyah.ayah = ayahNumber;
    
    // Update bookmark button state
    updateBookmarkModalButton();
    
    // Sync modal dropdown with global reciter selection
    if (modalReciterSelect) {
        // Only allow minshawi, hussary, abdulbasit in modal
        let currentReciter = audioState.currentReciter;
        if (!['minshawi', 'hussary', 'abdulbasit'].includes(currentReciter)) {
            currentReciter = 'minshawi'; // Default to first option
        }
        modalReciterSelect.value = currentReciter;
    }
    
    // Sync tafsir dropdown with current tafsir
    if (modalTafsirSelect) {
        modalTafsirSelect.value = String(currentTafsir.id);
    }
    
    // Reset audio button state
    resetAyahAudioButton();
    
    // Stop any playing audio
    stopAudio();
    
    // Get current surah name
    const surahName = appState.currentSurahData?.name || `سورة ${surahNumber}`;
    
    // Update title: "تفسير الآية [num] - [surah name]"
    modalTitle.innerHTML = `تفسير الآية ${ayahNumber} - ${surahName}`;
    
    // Show loading state
    modalContent.innerHTML = `
        <div class="tafsir-loading">
            <div class="tafsir-spinner"></div>
            <p>جاري تحميل التفسير...</p>
        </div>
    `;
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Fetch tafsir with current selected tafsir
    try {
        const tafsirText = await fetchTafsir(currentTafsir.id, surahNumber, ayahNumber);
        modalContent.innerHTML = `
            <div class="tafsir-text">
                ${tafsirText}
            </div>
        `;
    } catch (error) {
        modalContent.innerHTML = `
            <div class="tafsir-error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>تعذر تحميل التفسير. يرجى المحاولة مرة أخرى.</p>
                <button class="tafsir-retry-btn" onclick="showTafsirModal(${surahNumber}, ${ayahNumber})">
                    <i class="fas fa-redo"></i> إعادة المحاولة
                </button>
            </div>
        `;
    }
}

/**
 * Close Tafsir modal
 */
function closeTafsirModal() {
    const modal = document.getElementById('tafsirModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Initialize Tafsir modal event listeners
 */
function initTafsirModal() {
    const modal = document.getElementById('tafsirModal');
    const closeBtn = document.getElementById('tafsirModalClose');
    const overlay = document.getElementById('tafsirModalOverlay');
    const modalReciterSelect = document.getElementById('modalReciterSelect');
    const modalTafsirSelect = document.getElementById('modalTafsirSelect');
    
    // Close button click
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTafsirModal);
    }
    
    // Overlay click (close when clicking outside)
    if (overlay) {
        overlay.addEventListener('click', closeTafsirModal);
    }
    
    // Modal reciter select - sync with global reciter
    if (modalReciterSelect) {
        modalReciterSelect.addEventListener('change', function(e) {
            const selectedReciter = e.target.value;
            
            // Update audioState
            audioState.currentReciter = selectedReciter;
            
            // Sync with global reciter dropdown
            const globalReciterSelect = document.getElementById('reciterSelect');
            if (globalReciterSelect) {
                globalReciterSelect.value = selectedReciter;
            }
            
            // Stop current audio if playing
            if (audioState.isPlaying) {
                stopAudio();
                resetAyahAudioButton();
            }
            
            console.log('[Modal] Reciter changed to:', selectedReciter);
        });
    }
    
    // Modal tafsir select - change tafsir immediately
    if (modalTafsirSelect) {
        modalTafsirSelect.addEventListener('change', async function(e) {
            const selectedTafsirId = e.target.value; // String ID (ar.muyassar, ar.ibn-kathir, ar.saadi, ar.jalalayn)
            
            // Update current tafsir - use lookup object for fast access
            currentTafsir = TAFSIR_BY_ID[selectedTafsirId] || TAFSIRS.AL_MUYASSAR;
            
            console.log(`[Tafsir] Tafsir changed to: ${currentTafsir.name} (${currentTafsir.id})`);
            
            // Get current ayah
            const surah = currentModalAyah.surah;
            const ayah = currentModalAyah.ayah;
            
            if (!surah || !ayah) {
                showToast('يرجى اختيار آية أولاً');
                return;
            }
            
            // Show loading state
            const modalContent = document.getElementById('tafsirContent');
            if (modalContent) {
                modalContent.innerHTML = `
                    <div class="tafsir-loading">
                        <div class="tafsir-spinner"></div>
                        <p>جاري تحميل ${currentTafsir.name}...</p>
                    </div>
                `;
            }
            
            // Fetch and display new tafsir
            try {
                const tafsirText = await fetchTafsir(currentTafsir.id, surah, ayah);
                if (modalContent) {
                    modalContent.innerHTML = `
                        <div class="tafsir-text">
                            ${tafsirText}
                        </div>
                    `;
                }
                showToast(`تم تحميل ${currentTafsir.name}`);
            } catch (error) {
                if (modalContent) {
                    modalContent.innerHTML = `
                        <div class="tafsir-error">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>تعذر تحميل التفسير. يرجى المحاولة مرة أخرى.</p>
                            <button class="tafsir-retry-btn" onclick="reloadCurrentTafsir()">
                                <i class="fas fa-redo"></i> إعادة المحاولة
                            </button>
                        </div>
                    `;
                }
                showToast('فشل في تحميل التفسير');
            }
            
            console.log('[Modal] Tafsir changed to:', currentTafsir.name);
        });
    }
    
    // Escape key to close
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
            closeTafsirModal();
        }
    });
}

/**
 * Reload current tafsir (called from retry button)
 */
async function reloadCurrentTafsir() {
    const surah = currentModalAyah.surah;
    const ayah = currentModalAyah.ayah;
    
    if (!surah || !ayah) return;
    
    const modalContent = document.getElementById('tafsirContent');
    if (modalContent) {
        modalContent.innerHTML = `
            <div class="tafsir-loading">
                <div class="tafsir-spinner"></div>
                <p>جاري تحميل ${currentTafsir.name}...</p>
            </div>
        `;
    }
    
    try {
        const tafsirText = await fetchTafsir(currentTafsir.id, surah, ayah);
        if (modalContent) {
            modalContent.innerHTML = `
                <div class="tafsir-text">
                    ${tafsirText}
                </div>
            `;
        }
    } catch (error) {
        if (modalContent) {
            modalContent.innerHTML = `
                <div class="tafsir-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>تعذر تحميل التفسير. يرجى المحاولة مرة أخرى.</p>
                    <button class="tafsir-retry-btn" onclick="reloadCurrentTafsir()">
                        <i class="fas fa-redo"></i> إعادة المحاولة
                    </button>
                </div>
            `;
        }
    }
}

// ==========================================
// DATA: Azkar
// ==========================================

const azkarData = {
    morning: [
        { text: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لاَ إِلَـهَ إِلاَّ اللهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ", count: 1 },
        { text: "اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ", count: 1 },
        { text: "اللَّهُمَّ أَنْتَ رَبِّي لاَ إِلَهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لاَ يَغْفِرُ الذُّنُوبَ إِلاَّ أَنْتَ", count: 1 },
        { text: "اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلائِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللهُ لاَ إِلَهَ إِلاَّ أَنْتَ وَحْدَكَ لاَ شَرِيكَ لَكَ، وَأَنَّ مُحَمَّداً عَبْدُكَ وَرَسُولُكَ", count: 4 },
        { text: "اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لاَ إِلَهَ إِلاَّ أَنْتَ", count: 3 },
        { text: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ", count: 3 },
        { text: "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا", count: 3 },
        { text: "سُبْحَانَ اللهِ وَبِحَمْدِهِ", count: 100 },
        { text: "لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ", count: 10 },
        { text: "سُبْحَانَ اللهِ وَبِحَمْدِهِ، عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ", count: 3 }
    ],
    evening: [
        { text: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ للهِ، وَالْحَمْدُ للهِ، لاَ إِلَهَ إِلاَّ اللهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ", count: 1 },
        { text: "اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ الْمَصِيرُ", count: 1 },
        { text: "اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلائِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللهُ لاَ إِلَهَ إِلاَّ أَنْتَ وَحْدَكَ لاَ شَرِيكَ لَكَ، وَأَنَّ مُحَمَّداً عَبْدُكَ وَرَسُولُكَ", count: 4 },
        { text: "اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لاَ شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ", count: 1 },
        { text: "أَعُوذُ بِكَلِمَاتِ اللهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ", count: 3 },
        { text: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ", count: 3 },
        { text: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ", count: 1 },
        { text: "يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ أَصْلِحْ لِي شَأْنِي كُلَّهُ وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ", count: 1 },
        { text: "أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ", count: 100 },
        { text: "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ", count: 10 }
    ],
    sleep: [
        { text: "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا", count: 1 },
        { text: "اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ", count: 3 },
        { text: "بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ", count: 1 },
        { text: "اللَّهُمَّ أَسْلَمْتُ نَفْسِي إِلَيْكَ، وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَأَلْجَأْتُ ظَهْرِي إِلَيْكَ، رَغْبًا وَرَهْبًا مِنْكَ، لَا مَلْجَأَ وَلَا مَنْجَا مِنْكَ إِلَّا إِلَيْكَ، آمَنْتُ بِكِتَابِكَ الَّذِي أَنْزَلْتَ، وَبِنَبِيِّكَ الَّذِي أَرْسَلْتَ", count: 1 },
        { text: "سُبْحَانَ اللهِ", count: 33 },
        { text: "الْحَمْدُ لِلَّهِ", count: 33 },
        { text: "اللهُ أَكْبَرُ", count: 34 },
        { text: "اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا", count: 1 }
    ],
    wakeup: [
        { text: "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ", count: 1 },
        { text: "لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، سُبْحَانَ اللهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللهُ، وَاللهُ أَكْبَرُ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللهِ الْعَلِيِّ الْعَظِيمِ", count: 1 },
        { text: "اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ الْمَوْلِيدِ", count: 1 },
        { text: "صَلَّى اللهُ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ", count: 10 }
    ]
};

// ==========================================
// NAVIGATION
// ==========================================

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.dataset.tab;
            
            // Update nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Update content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });
            
            appState.currentTab = tabId;
        });
    });
}

// ==========================================
// CLOCK & DATE
// ==========================================

function initClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    
    // Time in 12h format with AM/PM
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص'; // Arabic: م = PM (مساء), ص = AM (صباح)
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const timeStr = `${hours}:${minutes}:${seconds} ${ampm}`;
    safeSetText('currentTime', timeStr);
    
    // Date (Arabic - Gregorian)
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('ar-EG', dateOptions);
    safeSetText('currentDate', dateStr);
}

// Fetch and display Hijri date
async function fetchHijriDate() {
    try {
        
        const response = await fetch(
            `${ADHAN_API_BASE}/calendarByCity?city=Cairo&country=Egypt&method=5&school=0`
        );
        const data = await response.json();
        
        if (data.code === 200 && data.data) {
            // Find today's entry
            const todayEntry = data.data.find(entry => 
                parseInt(entry.date.gregorian.date.split('-')[0]) === day
            );
            
            if (todayEntry && todayEntry.date.hijri) {
                const hijri = todayEntry.date.hijri;
                const hijriDateStr = `${hijri.day} ${hijri.month.arabic} ${hijri.year} هـ`;
                safeSetText('hijriDate', hijriDateStr);
            }
        }
    } catch (error) {
        console.warn('Could not fetch Hijri date:', error);
        safeSetText('hijriDate', '');
    }
}

// ==========================================
// PRAYER TIMES - Geolocation + Al Adhan API
// ==========================================

// Cairo fallback coordinates (Egypt)
const CAIRO_COORDINATES = {
    latitude: 30.0444,
    longitude: 31.2357,
    name: 'القاهرة، مصر'
};

function initPrayerTimes() {
    // Initialize location search
    initLocationSearch();
    
    // Setup refresh button
    document.getElementById('refreshLocation')?.addEventListener('click', detectLocation);
    document.getElementById('retryLocation')?.addEventListener('click', detectLocation);
    
    // Start with location detection
    detectLocation();
    
    // Update next prayer and countdown every second using unified function
    setInterval(updateNextPrayerWithCountdown, 1000);
    
    // Refresh times at midnight
    setInterval(() => {
        if (appState.location) {
            fetchPrayerTimes(appState.location.latitude, appState.location.longitude);
        }
    }, 24 * 60 * 60 * 1000);
}

function detectLocation() {
    // Show loading state
    safeSetDisplay('locationLoading', 'flex');
    safeSetDisplay('locationInfo', 'none');
    safeSetDisplay('locationError', 'none');
    
    // If offline, try to load from localStorage first
    if (!navigator.onLine) {
        console.log('[Location] Offline mode - checking localStorage...');
        const cached = loadLocationData();
        const cachedTimes = loadPrayerTimes();
        
        if (cached && cachedTimes) {
            // We have both location and prayer times cached
            console.log('[Location] Using cached location and prayer times');
            appState.location = {
                latitude: cached.latitude,
                longitude: cached.longitude
            };
            appState.locationName = cached.locationName || 'موقعك الحالي';
            
            safeSetDisplay('locationLoading', 'none');
            safeSetDisplay('locationInfo', 'flex');
            safeSetText('locationName', appState.locationName);
            
            // Load cached prayer times
            appState.prayerTimes = {
                fajr: cachedTimes.timings.Fajr,
                sunrise: cachedTimes.timings.Sunrise,
                dhuhr: cachedTimes.timings.Dhuhr,
                asr: cachedTimes.timings.Asr,
                maghrib: cachedTimes.timings.Maghrib,
                isha: cachedTimes.timings.Isha
            };
            renderPrayerTimes();
            findAndDisplayNextPrayer();
            showToast('تم تحميل مواقيت الصلاة من الذاكرة المؤقتة');
            return;
        } else if (cached) {
            // Have location but no prayer times
            console.log('[Location] Using cached location, fetching prayer times...');
            appState.location = {
                latitude: cached.latitude,
                longitude: cached.longitude
            };
            appState.locationName = cached.locationName || 'موقعك الحالي';
            
            safeSetDisplay('locationLoading', 'none');
            safeSetDisplay('locationInfo', 'flex');
            safeSetText('locationName', appState.locationName);
            
            // Try to fetch prayer times (will fail and use Cairo fallback)
            fetchPrayerTimes(cached.latitude, cached.longitude, true);
            return;
        } else {
            // No cached data at all - use Cairo fallback
            console.log('[Location] No cached data - using Cairo fallback');
            useFallbackLocation(true);
            return;
        }
    }
    
    // Online: try geolocation first
    if (!navigator.geolocation) {
        showLocationError('المتصفح لا يدعم تحديد الموقع');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            appState.location = { latitude, longitude };
            
            // Get location name using reverse geocoding
            getLocationName(latitude, longitude);
            
            // Fetch prayer times
            fetchPrayerTimes(latitude, longitude);
        },
        (error) => {
            // Geolocation failed - try cached data or Cairo fallback
            console.warn('Geolocation failed:', error.message);
            
            const cached = loadLocationData();
            const cachedTimes = loadPrayerTimes();
            
            if (cached && cachedTimes) {
                // Use cached data
                console.log('[Location] Using cached data after geolocation failure');
                appState.location = {
                    latitude: cached.latitude,
                    longitude: cached.longitude
                };
                appState.locationName = cached.locationName || 'موقعك الحالي';
                
                safeSetDisplay('locationLoading', 'none');
                safeSetDisplay('locationInfo', 'flex');
                safeSetText('locationName', appState.locationName);
                
                appState.prayerTimes = {
                    fajr: cachedTimes.timings.Fajr,
                    sunrise: cachedTimes.timings.Sunrise,
                    dhuhr: cachedTimes.timings.Dhuhr,
                    asr: cachedTimes.timings.Asr,
                    maghrib: cachedTimes.timings.Maghrib,
                    isha: cachedTimes.timings.Isha
                };
                renderPrayerTimes();
                findAndDisplayNextPrayer();
                showToast('تم تحميل مواقيت الصلاة من الذاكرة المؤقتة');
            } else {
                // No cache - use Cairo
                useFallbackLocation();
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes cache
        }
    );
}

function useFallbackLocation(isOfflineFallback = false) {
    // Use Cairo coordinates as default
    appState.location = {
        latitude: CAIRO_COORDINATES.latitude,
        longitude: CAIRO_COORDINATES.longitude
    };
    appState.locationName = CAIRO_COORDINATES.name;
    
    // Save Cairo as the location
    saveLocationData(CAIRO_COORDINATES.latitude, CAIRO_COORDINATES.longitude, CAIRO_COORDINATES.name);
    
    // Update UI
    safeSetDisplay('locationLoading', 'none');
    safeSetDisplay('locationInfo', 'flex');
    safeSetText('locationName', appState.locationName);
    
    // Fetch prayer times for Cairo
    fetchPrayerTimes(CAIRO_COORDINATES.latitude, CAIRO_COORDINATES.longitude, isOfflineFallback);
}

async function getLocationName(lat, lon) {
    try {
        // Use Nominatim for reverse geocoding (free, no API key needed)
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ar`
        );
        const data = await response.json();
        
        if (data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.state || '';
            const country = data.address.country || '';
            appState.locationName = city ? `${city}, ${country}` : country || 'موقعك الحالي';
        } else {
            appState.locationName = 'موقعك الحالي';
        }
        
        // Save location data to localStorage
        saveLocationData(lat, lon, appState.locationName);
        
        // Update UI
        safeSetDisplay('locationLoading', 'none');
        safeSetDisplay('locationInfo', 'flex');
        safeSetText('locationName', appState.locationName);
        
    } catch (error) {
        console.error('Error getting location name:', error);
        
        // Try to load from cache on error
        const cached = loadLocationData();
        if (cached) {
            appState.locationName = cached.locationName || 'موقعك الحالي';
        } else {
            appState.locationName = 'موقعك الحالي';
        }
        
        safeSetDisplay('locationLoading', 'none');
        safeSetDisplay('locationInfo', 'flex');
        safeSetText('locationName', appState.locationName);
    }
}

function showLocationError(message) {
    safeSetDisplay('locationLoading', 'none');
    safeSetDisplay('locationInfo', 'none');
    safeSetDisplay('locationError', 'flex');
}

// ==========================================
// LOCATION SEARCH (Geocoding with Nominatim)
// ==========================================

let locationSearchTimeout = null;

function initLocationSearch() {
    const searchBtn = document.getElementById('locationSearchBtn');
    const closeBtn = document.getElementById('locationSearchClose');
    const searchInput = document.getElementById('locationSearchInput');
    
    // Toggle search panel
    searchBtn?.addEventListener('click', () => {
        toggleLocationSearchPanel(true);
        setTimeout(() => searchInput?.focus(), 100);
    });
    
    // Close search panel
    closeBtn?.addEventListener('click', () => {
        toggleLocationSearchPanel(false);
    });
    
    // Debounced search input
    searchInput?.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Clear previous timeout
        if (locationSearchTimeout) {
            clearTimeout(locationSearchTimeout);
        }
        
        // Clear results if input is empty
        if (query.length < 2) {
            document.getElementById('locationSearchResults').innerHTML = '';
            return;
        }
        
        // Debounce search (300ms delay)
        locationSearchTimeout = setTimeout(() => {
            searchLocations(query);
        }, 300);
    });
    
    // Close on Escape key
    searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleLocationSearchPanel(false);
        }
    });
}

function toggleLocationSearchPanel(show) {
    const panel = document.getElementById('locationSearchPanel');
    const searchInput = document.getElementById('locationSearchInput');
    
    if (show) {
        safeSetDisplay('locationSearchPanel', 'block');
        if (searchInput) searchInput.value = '';
        document.getElementById('locationSearchResults').innerHTML = '';
    } else {
        safeSetDisplay('locationSearchPanel', 'none');
    }
}

async function searchLocations(query) {
    const resultsContainer = document.getElementById('locationSearchResults');
    
    // Show loading state
    resultsContainer.innerHTML = `
        <div class="location-search-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>جاري البحث...</span>
        </div>
    `;
    
    try {
        // Use Nominatim API for geocoding (free, no API key)
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=ar`,
            {
                headers: {
                    'Accept-Language': 'ar'
                }
            }
        );
        
        const results = await response.json();
        
        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div class="location-search-no-results">
                    <i class="fas fa-search"></i>
                    <p>لم يتم العثور على نتائج</p>
                </div>
            `;
            return;
        }
        
        // Render results
        resultsContainer.innerHTML = results.map(location => `
            <div class="location-search-item" data-lat="${location.lat}" data-lon="${location.lon}" data-name="${getLocationDisplayName(location)}">
                <i class="fas fa-map-marker-alt"></i>
                <div class="location-search-item-info">
                    <div class="location-search-item-name">${getLocationDisplayName(location)}</div>
                    <div class="location-search-item-country">${getCountryName(location)}</div>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        resultsContainer.querySelectorAll('.location-search-item').forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.dataset.lat);
                const lon = parseFloat(item.dataset.lon);
                const name = item.dataset.name;
                selectSearchedLocation(lat, lon, name);
            });
        });
        
    } catch (error) {
        console.error('Location search error:', error);
        resultsContainer.innerHTML = `
            <div class="location-search-no-results">
                <i class="fas fa-exclamation-triangle"></i>
                <p>حدث خطأ في البحث</p>
            </div>
        `;
    }
}

function getLocationDisplayName(location) {
    // Try to get Arabic name first, fallback to English
    if (location.display_name_ar) {
        return location.display_name_ar;
    }
    
    const parts = location.display_name.split(',');
    // Return city/region + country
    const city = location.address?.city || location.address?.town || location.address?.village || location.address?.state || parts[0] || '';
    const country = location.address?.country || '';
    
    return city ? `${city}, ${country}` : parts.slice(0, 2).join(', ');
}

function getCountryName(location) {
    if (location.address?.country_code === 'eg') return 'مصر';
    if (location.address?.country_code === 'sa') return 'السعودية';
    if (location.address?.country_code === 'ae') return 'الإمارات';
    if (location.address?.country_code === 'qa') return 'قطر';
    if (location.address?.country_code === 'kw') return 'الكويت';
    if (location.address?.country_code === 'bh') return 'البحرين';
    if (location.address?.country_code === 'om') return 'عُمان';
    if (location.address?.country_code === 'jo') return 'الأردن';
    if (location.address?.country_code === 'lb') return 'لبنان';
    if (location.address?.country_code === 'sy') return 'سوريا';
    if (location.address?.country_code === 'iq') return 'العراق';
    if (location.address?.country_code === 'ma') return 'المغرب';
    if (location.address?.country_code === 'dz') return 'الجزائر';
    if (location.address?.country_code === 'tn') return 'تونس';
    if (location.address?.country_code === 'ly') return 'ليبيا';
    if (location.address?.country_code === 'sd') return 'السودان';
    if (location.address?.country_code === 'ye') return 'اليمن';
    if (location.address?.country_code === 'ps') return 'فلسطين';
    if (location.address?.country_code === 'tr') return 'تركيا';
    if (location.address?.country_code === 'gb') return 'المملكة المتحدة';
    if (location.address?.country_code === 'us') return 'الولايات المتحدة';
    if (location.address?.country_code === 'de') return 'ألمانيا';
    if (location.address?.country_code === 'fr') return 'فرنسا';
    
    return location.address?.country || '';
}

function selectSearchedLocation(lat, lon, name) {
    // Close search panel
    toggleLocationSearchPanel(false);
    
    // Update app state
    appState.location = { latitude: lat, longitude: lon };
    appState.locationName = name;
    
    // Save to localStorage
    saveLocationData(lat, lon, name);
    
    // Update UI
    safeSetDisplay('locationLoading', 'none');
    safeSetDisplay('locationInfo', 'flex');
    safeSetText('locationName', name);
    
    // Fetch new prayer times
    fetchPrayerTimes(lat, lon);
    
    showToast(`تم تحديد: ${name}`);
}

async function fetchPrayerTimes(lat, lon, isOffline = false) {
    // If offline, try to load from cache first
    if (!navigator.onLine) {
        const cached = loadPrayerTimes();
        if (cached && cached.latitude === lat && cached.longitude === lon) {
            console.log('[PrayerTimes] Loading from offline cache');
            appState.prayerTimes = {
                fajr: cached.timings.Fajr,
                sunrise: cached.timings.Sunrise,
                dhuhr: cached.timings.Dhuhr,
                asr: cached.timings.Asr,
                maghrib: cached.timings.Maghrib,
                isha: cached.timings.Isha
            };
            appState.location = { latitude: lat, longitude: lon };
            renderPrayerTimes();
            findAndDisplayNextPrayer();
            showToast('تم تحميل مواقيت الصلاة من الذاكرة المؤقتة');
            return;
        }
    }
    
    try {
        const now = new Date();
        const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
        
        // Using Al Adhan API with University of Islamic Sciences, Karachi calculation
        const response = await fetch(
            `${ADHAN_API_BASE}/timings?latitude=${lat}&longitude=${lon}&method=3&school=0`
        );
        const data = await response.json();
        
        if (data.code === 200 && data.data) {
            const timings = data.data.timings;
            
            appState.prayerTimes = {
                fajr: timings.Fajr,
                sunrise: timings.Sunrise,
                dhuhr: timings.Dhuhr,
                asr: timings.Asr,
                maghrib: timings.Maghrib,
                isha: timings.Isha
            };
            
            // Save to localStorage for offline use
            savePrayerTimes(timings, lat, lon);
            
            // Update location if not set
            if (!appState.location) {
                appState.location = { latitude: lat, longitude: lon };
            }
            
            renderPrayerTimes();
            findAndDisplayNextPrayer();
            
            if (!isOffline) {
                showToast('تم تحديث مواقيت الصلاة');
            }
        } else {
            throw new Error('Invalid API response');
        }
    } catch (error) {
        console.error('Error fetching prayer times:', error);
        
        // Try to load from cache on error
        const cached = loadPrayerTimes();
        if (cached) {
            console.log('[PrayerTimes] Falling back to cached data after error');
            appState.prayerTimes = {
                fajr: cached.timings.Fajr,
                sunrise: cached.timings.Sunrise,
                dhuhr: cached.timings.Dhuhr,
                asr: cached.timings.Asr,
                maghrib: cached.timings.Maghrib,
                isha: cached.timings.Isha
            };
            appState.location = { latitude: cached.latitude, longitude: cached.longitude };
            renderPrayerTimes();
            findAndDisplayNextPrayer();
            showToast('تم تحميل مواقيت الصلاة من الذاكرة المؤقتة');
        } else if (!isOffline) {
            showToast('تعذر تحميل مواقيت الصلاة');
        }
    }
}

function formatTime(time24) {
    // Convert "05:30" 24h format to "5:30 AM" 12h format
    if (!time24 || time24 === '--:--') return '--:--';
    
    const [hours, minutes] = time24.split(':').map(Number);
    const ampm = hours >= 12 ? 'م' : 'ص'; // م = PM (مساء), ص = AM (صباح)
    const displayHours = hours % 12 || 12;
    
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function renderPrayerTimes() {
    const grid = safeGetElement('prayerTimesGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const prayerOrder = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    
    prayerOrder.forEach(prayer => {
        const div = document.createElement('div');
        div.className = 'prayer-time-item';
        if (appState.currentPrayer === prayer) {
            div.classList.add('active');
        }
        
        // Format time to 12h Arabic format
        const formattedTime = formatTime(appState.prayerTimes[prayer]) || '--:--';
        
        div.innerHTML = `
            <div class="prayer-icon"><i class="fas ${prayerIcons[prayer]}"></i></div>
            <div class="prayer-name">${prayerNames[prayer]}</div>
            <div class="prayer-time">${formattedTime}</div>
        `;
        
        grid.appendChild(div);
    });
}

// Unified function to find next prayer and update display
function findAndDisplayNextPrayer() {
    const now = new Date();
    const prayerOrder = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    
    let nextPrayer = null;
    let nextPrayerTime = null;
    let minDiff = Infinity;
    
    // Calculate current time in seconds from midnight
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    
    for (const prayer of prayerOrder) {
        const timeStr = appState.prayerTimes[prayer];
        if (!timeStr) continue;
        
        const [hours, minutes] = timeStr.split(':').map(Number);
        
        // Calculate prayer time as seconds from midnight for TODAY
        let prayerSeconds = hours * 3600 + minutes * 60;
        
        // Calculate difference from current time
        let diff = prayerSeconds - currentSeconds;
        
        // If prayer time is in the future today
        if (diff > 0 && diff < minDiff) {
            minDiff = diff;
            nextPrayer = prayer;
            nextPrayerTime = timeStr;
        }
    }
    
    // If no prayer found for today, find the earliest prayer (Fajr)
    if (!nextPrayer) {
        // Find the first prayer that exists (usually fajr)
        for (const prayer of prayerOrder) {
            const timeStr = appState.prayerTimes[prayer];
            if (timeStr) {
                nextPrayer = prayer;
                nextPrayerTime = timeStr;
                break;
            }
        }
        
        // If still nothing, skip update
        if (!nextPrayer) return;
        
        // Set flag for tomorrow
        appState.nextPrayerTomorrow = true;
    } else {
        appState.nextPrayerTomorrow = false;
    }
    
    // Update state
    appState.nextPrayer = nextPrayer;
    
    // Update UI
    safeSetText('nextPrayerName', prayerNames[nextPrayer]);
    safeSetText('nextPrayerTime', formatTime(nextPrayerTime));
    
    // Update active state in grid
    document.querySelectorAll('.prayer-time-item').forEach((item, index) => {
        const prayerKey = prayerOrder[index];
        item.classList.toggle('active', prayerKey === nextPrayer);
    });
}

// Combined function for real-time countdown updates
function updateNextPrayerWithCountdown() {
    const now = new Date();
    const prayerOrder = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    
    let nextPrayer = null;
    let nextPrayerTime = null;
    let minDiff = Infinity;
    
    // Calculate current time in seconds from midnight
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    
    for (const prayer of prayerOrder) {
        const timeStr = appState.prayerTimes[prayer];
        if (!timeStr) continue;
        
        const [hours, minutes] = timeStr.split(':').map(Number);
        let prayerSeconds = hours * 3600 + minutes * 60;
        let diff = prayerSeconds - currentSeconds;
        
        if (diff > 0 && diff < minDiff) {
            minDiff = diff;
            nextPrayer = prayer;
            nextPrayerTime = timeStr;
        }
    }
    
    // If no prayer today, get first prayer for tomorrow
    if (!nextPrayer) {
        for (const prayer of prayerOrder) {
            const timeStr = appState.prayerTimes[prayer];
            if (timeStr) {
                nextPrayer = prayer;
                nextPrayerTime = timeStr;
                break;
            }
        }
        
        if (!nextPrayer) {
            safeSetText('countdown', '--:--:--');
            return;
        }
        
        // Calculate time to midnight + tomorrow's prayer
        const secondsToMidnight = 24 * 3600 - currentSeconds;
        const [hours, minutes] = nextPrayerTime.split(':').map(Number);
        const tomorrowPrayerSeconds = hours * 3600 + minutes * 60;
        minDiff = secondsToMidnight + tomorrowPrayerSeconds;
        
        appState.nextPrayerTomorrow = true;
    } else {
        appState.nextPrayerTomorrow = false;
    }
    
    // Update next prayer display (only if changed)
    if (appState.nextPrayer !== nextPrayer) {
        appState.nextPrayer = nextPrayer;
        safeSetText('nextPrayerName', prayerNames[nextPrayer]);
        safeSetText('nextPrayerTime', formatTime(nextPrayerTime));
        
        // Update active state
        document.querySelectorAll('.prayer-time-item').forEach((item, index) => {
            const prayerKey = prayerOrder[index];
            item.classList.toggle('active', prayerKey === nextPrayer);
        });
    }
    
    // Update countdown
    const h = Math.floor(minDiff / 3600);
    const m = Math.floor((minDiff % 3600) / 60);
    const s = minDiff % 60;
    
    safeSetText('countdown', 
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
}

// ==========================================
// TASBIH
// ==========================================

// ==========================================
// TASBIH LOCAL STORAGE (Per-user, per-device)
// ==========================================

/**
 * Save ALL tasbih data to localStorage atomically
 * @param {number} count - Current tasbih count (0 to target)
 * @param {number} total - Total all-time tasbih count
 * @param {number} round - Completed rounds count
 * @param {number} target - Current target (default 33)
 * @param {number} currentDhikr - Current dhikr index (0-2)
 */
function saveTasbihData(count, total, round, target, currentDhikr) {
    try {
        const data = {
            count: count,
            total: total,
            round: round,
            target: target,
            currentDhikr: currentDhikr,
            savedAt: Date.now()
        };
        localStorage.setItem(TASBIH_STORAGE_KEY, JSON.stringify(data));
        console.log('[Tasbih] Saved data:', data);
    } catch (e) {
        console.warn('[Tasbih] Could not save data:', e);
    }
}

/**
 * Load tasbih data from localStorage
 * @returns {object|null} The saved data object, or null if not found/invalid
 */
function loadTasbihData() {
    try {
        const saved = localStorage.getItem(TASBIH_STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            // Validate data structure
            if (typeof data.count === 'number' && typeof data.total === 'number') {
                console.log('[Tasbih] Loaded data:', data);
                return data;
            }
        }
    } catch (e) {
        console.warn('[Tasbih] Could not load data:', e);
    }
    return null; // Return null for new users or invalid data
}

/**
 * ATOMIC RESET: Clear ALL tasbih data from localStorage
 * After this, count/total/round will all be 0
 */
function atomicTasbihReset() {
    try {
        // Remove the dedicated tasbih storage key
        localStorage.removeItem(TASBIH_STORAGE_KEY);
        console.log('[Tasbih] ATOMIC RESET - All tasbih data cleared');
    } catch (e) {
        console.warn('[Tasbih] Could not clear data:', e);
    }
}

// ==========================================
// BOOKMARK MODULE - Single Ayah Bookmark
// ==========================================

/**
 * Load bookmark from localStorage
 */
function loadBookmark() {
    try {
        const saved = localStorage.getItem(BOOKMARK_STORAGE_KEY);
        if (saved) {
            const bookmark = JSON.parse(saved);
            if (bookmark && typeof bookmark.surah === 'number' && typeof bookmark.ayah === 'number') {
                appState.bookmark = bookmark;
                console.log('[Bookmark] Loaded bookmark:', bookmark);
                return bookmark;
            }
        }
    } catch (e) {
        console.warn('[Bookmark] Could not load bookmark:', e);
    }
    appState.bookmark = null;
    return null;
}

/**
 * Save bookmark to localStorage
 */
function saveBookmark(bookmark) {
    try {
        if (bookmark) {
            localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmark));
            appState.bookmark = bookmark;
            console.log('[Bookmark] Saved bookmark:', bookmark);
        } else {
            localStorage.removeItem(BOOKMARK_STORAGE_KEY);
            appState.bookmark = null;
            console.log('[Bookmark] Bookmark cleared');
        }
    } catch (e) {
        console.warn('[Bookmark] Could not save bookmark:', e);
    }
}

/**
 * Set bookmark to a specific ayah (only ONE bookmark allowed)
 */
function setBookmark(surahNumber, ayahNumber) {
    const bookmark = { surah: surahNumber, ayah: ayahNumber };
    saveBookmark(bookmark);
    updateBookmarkHighlight();
    updateFullPageBookmarkHighlight();
    updateBookmarkButton();
    updateBookmarkModalButton();
    showToast(`تم حفظ الآية ${ayahNumber} كمرجعية`);
}

/**
 * Remove current bookmark
 */
function removeBookmark() {
    saveBookmark(null);
    updateBookmarkHighlight();
    updateFullPageBookmarkHighlight();
    updateBookmarkButton();
    updateBookmarkModalButton();
    showToast('تم حذف المرجعية');
}

/**
 * Toggle bookmark from modal button
 */
function toggleModalBookmark() {
    const surah = currentModalAyah.surah;
    const ayah = currentModalAyah.ayah;
    
    if (!surah || !ayah) {
        showToast('يرجى اختيار آية أولاً');
        return;
    }
    
    if (isBookmarked(surah, ayah)) {
        removeBookmark();
    } else {
        setBookmark(surah, ayah);
    }
    updateBookmarkModalButton();
}

/**
 * Update bookmark button in modal to reflect current state
 */
function updateBookmarkModalButton() {
    const btn = document.getElementById('modalBookmarkBtn');
    if (!btn) return;
    
    const surah = currentModalAyah.surah;
    const ayah = currentModalAyah.ayah;
    const isCurrentlyBookmarked = isBookmarked(surah, ayah);
    
    if (isCurrentlyBookmarked) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-bookmark"></i>';
        btn.title = 'حذف المرجعية';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="far fa-bookmark"></i>';
        btn.title = 'حفظ كمرجعية';
    }
}

/**
 * Check if a specific ayah is bookmarked
 */
function isBookmarked(surahNumber, ayahNumber) {
    return appState.bookmark && 
           appState.bookmark.surah === surahNumber && 
           appState.bookmark.ayah === ayahNumber;
}

/**
 * Update bookmark highlight on all ayah cards
 */
function updateBookmarkHighlight() {
    // Remove all existing highlights
    document.querySelectorAll('.ayah-card.bookmarked').forEach(card => {
        card.classList.remove('bookmarked');
        const textEl = card.querySelector('.ayah-text');
        if (textEl) textEl.classList.remove('bookmarked-ayah');
    });
    
    // Add highlight to bookmarked ayah if viewing the correct surah
    if (appState.bookmark && appState.selectedSurah === appState.bookmark.surah) {
        const ayahNumber = appState.bookmark.ayah;
        const card = document.getElementById(`ayah-${ayahNumber}`);
        if (card) {
            card.classList.add('bookmarked');
            const textEl = card.querySelector('.ayah-text');
            if (textEl) textEl.classList.add('bookmarked-ayah');
        }
    }
}

/**
 * Update bookmark highlight on full page view (safha-content)
 * This function dynamically adds/removes bookmark styling without re-rendering
 */
function updateFullPageBookmarkHighlight() {
    const fullPageContainer = document.getElementById('ayahsFullPage');
    if (!fullPageContainer) return;
    
    // Remove all existing bookmark highlights in full page view
    fullPageContainer.querySelectorAll('.ayah-inline.bookmarked-ayah').forEach(el => {
        el.classList.remove('bookmarked-ayah');
    });
    
    // Add highlight to bookmarked ayah if viewing the correct surah in full page mode
    if (appState.bookmark && 
        appState.selectedSurah === appState.bookmark.surah && 
        appState.quranViewMode === 'full') {
        
        const ayahNumber = appState.bookmark.ayah;
        // Find the tafsir-ayah element with matching data-index attribute
        const ayahEl = fullPageContainer.querySelector(`.tafsir-ayah[data-index="${ayahNumber}"]`);
        if (ayahEl) {
            const parentSpan = ayahEl.parentElement;
            if (parentSpan && parentSpan.classList.contains('ayah-inline')) {
                parentSpan.classList.add('bookmarked-ayah');
            }
        }
    }
}

/**
 * Update bookmark button visibility/text
 */
function updateBookmarkButton() {
    const btn = document.getElementById('goToBookmarkBtn');
    if (btn) {
        if (appState.bookmark) {
            btn.style.display = '';
            btn.innerHTML = '<i class="fas fa-bookmark"></i>';
        } else {
            btn.style.display = 'none';
        }
    }
}

/**
 * Jump to bookmarked ayah
 */
function goToBookmark() {
    // Load bookmark directly from localStorage to ensure we have latest
    const savedBookmark = loadBookmarkFromStorage();
    
    if (!savedBookmark) {
        showToast('لا توجد مرجعية محفوظة');
        return;
    }
    
    const { surah, ayah } = savedBookmark;
    
    // If different surah, show alert
    if (appState.selectedSurah !== surah) {
        const surahName = appState.surahs?.find(s => s.number === surah)?.name || `السورة ${surah}`;
        if (confirm(`المرجعية في ${surahName} - آية ${ayah}\n\nاضغط موافق للانتقال إليها`)) {
            loadSurah(surah).then(() => {
                scrollToAyah(ayah);
            });
        }
    } else {
        scrollToAyah(ayah);
    }
}

/**
 * Load bookmark directly from localStorage (for immediate use)
 */
function loadBookmarkFromStorage() {
    try {
        const saved = localStorage.getItem(BOOKMARK_STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn('[Bookmark] Could not load:', e);
    }
    return null;
}

/**
 * Scroll to a specific ayah in the current view
 */
function scrollToAyah(ayahNumber) {
    // Try to find the ayah element by ID directly
    const ayahElement = document.getElementById(`ayah-${ayahNumber}`);
    
    if (ayahElement) {
        // Use getElementById + scrollIntoView as specified
        ayahElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add highlight effect briefly
        ayahElement.classList.add('bookmarked-ayah');
        setTimeout(() => ayahElement.classList.remove('bookmarked-ayah'), 2000);
    }
}

/**
 * Initialize bookmark functionality
 */
function initBookmark() {
    loadBookmark();
    updateBookmarkButton();
    updateBookmarkHighlight();
}

function initTasbih() {
    const tapBtn = document.getElementById('tapBtn');
    const tasbihCircle = document.getElementById('tasbihCircle');
    const resetBtn = document.getElementById('resetBtn');
    const targetBtn = document.getElementById('targetBtn');
    const targetOptions = document.querySelectorAll('.target-option');
    
    // Load tasbih data from localStorage on startup
    // - New users: all values start at 0
    // - After reset: all values are 0 (data was cleared)
    // - Returning users: resume from saved state
    const savedData = loadTasbihData();
    
    if (savedData) {
        appState.tasbihCount = savedData.count || 0;
        appState.tasbihTotal = savedData.total || 0;
        appState.tasbihRound = savedData.round || 0;
        appState.tasbihTarget = savedData.target || 33;
        appState.currentDhikr = savedData.currentDhikr || 0;
        console.log('[Tasbih] Resumed session with data:', savedData);
    } else {
        // New user or after reset - all values default to 0
        appState.tasbihCount = 0;
        appState.tasbihTotal = 0;
        appState.tasbihRound = 0;
        appState.tasbihTarget = 33;
        appState.currentDhikr = 0;
        console.log('[Tasbih] Starting fresh session');
    }
    
    // Tap events
    tapBtn.addEventListener('click', incrementTasbih);
    tasbihCircle.addEventListener('click', incrementTasbih);
    
    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (appState.currentTab === 'tasbih' && (e.code === 'Space' || e.key === ' ')) {
            e.preventDefault();
            incrementTasbih();
        }
    });
    
    // Reset - ATOMIC RESET clears all data permanently
    resetBtn.addEventListener('click', resetTasbih);
    
    // Target selector
    targetBtn.addEventListener('click', () => {
        document.getElementById('targetSelector').classList.toggle('show');
    });
    
    targetOptions.forEach(option => {
        option.addEventListener('click', () => {
            const target = parseInt(option.dataset.target);
            appState.tasbihTarget = target;
            
            targetOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            document.getElementById('tasbihTarget').textContent = target;
            document.getElementById('targetSelector').classList.remove('show');
            
            // Save updated tasbih data with new target
            saveTasbihData(
                appState.tasbihCount,
                appState.tasbihTotal,
                appState.tasbihRound,
                appState.tasbihTarget,
                appState.currentDhikr
            );
        });
    });
    
    // Initialize display
    updateTasbihDisplay();
}

function incrementTasbih() {
    appState.tasbihCount++;
    appState.tasbihTotal++;
    
    // Animate counter
    const counter = document.getElementById('tasbihCount');
    counter.classList.add('bump');
    setTimeout(() => counter.classList.remove('bump'), 200);
    
    // Update beads
    updateBeads();
    
    // Check if target reached
    if (appState.tasbihCount >= appState.tasbihTarget) {
        celebrateCompletion();
        appState.tasbihRound++;
        appState.tasbihCount = 0;
        
        // Rotate dhikr
        appState.currentDhikr = (appState.currentDhikr + 1) % 3;
        const dhikrEl = document.getElementById('tasbihDhikr');
        dhikrEl.classList.add('changing');
        setTimeout(() => {
            dhikrEl.textContent = appState.dhikrs[appState.currentDhikr];
            dhikrEl.classList.remove('changing');
        }, 150);
    }
    
    updateTasbihDisplay();
    
    // ATOMIC SAVE: Save ALL tasbih data to dedicated localStorage key
    // This ensures complete state persistence per-user, per-device
    saveTasbihData(
        appState.tasbihCount,
        appState.tasbihTotal,
        appState.tasbihRound,
        appState.tasbihTarget,
        appState.currentDhikr
    );
    
    // Also update general progress for azkar data
    saveProgress();
}

function updateBeads() {
    const beads = document.querySelectorAll('.bead');
    const activeCount = Math.min(appState.tasbihCount, 33);
    
    beads.forEach((bead, index) => {
        bead.classList.toggle('active', index < activeCount);
    });
}

/**
 * ATOMIC RESET: Clears ALL tasbih data from localStorage
 * - tasbihCount → 0
 * - tasbihTotal → 0
 * - tasbihRound → 0
 * - Data is permanently cleared from localStorage
 * - After page refresh, count will be 0 (no persistence)
 */
function resetTasbih() {
    // ATOMIC RESET: Immediately remove ALL tasbih data from localStorage
    atomicTasbihReset();
    
    // Reset ALL tasbih state to 0
    appState.tasbihCount = 0;
    appState.tasbihTotal = 0;
    appState.tasbihRound = 0;
    appState.currentDhikr = 0;
    
    // Update UI - force display to show 0
    updateBeads();
    updateTasbihDisplay();
    
    // Force immediate DOM update for totalCount
    safeSetText('totalCount', '0');
    safeSetText('roundCount', '0');
    
    showToast('تم إعادة التعيين');
}

function updateTasbihDisplay() {
    safeSetText('tasbihCount', appState.tasbihCount);
    safeSetText('tasbihTarget', appState.tasbihTarget);
    safeSetText('totalCount', appState.tasbihTotal);
    safeSetText('roundCount', appState.tasbihRound);
    safeSetText('tasbihDhikr', appState.dhikrs[appState.currentDhikr]);
}

function celebrateCompletion() {
    showToast('🎉 أحسنت! أكملت ' + appState.tasbihTarget + ' تسبيحة');
    
    // Confetti effect
    const celebration = document.getElementById('celebration');
    celebration.classList.add('show');
    
    // Create confetti
    for (let i = 0; i < 50; i++) {
        createConfetti();
    }
    
    setTimeout(() => {
        celebration.classList.remove('show');
    }, 3000);
}

function createConfetti() {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.animationDelay = Math.random() * 0.5 + 's';
    confetti.style.background = ['#d4af37', '#f4d03f', '#27ae60', '#3498db'][Math.floor(Math.random() * 4)];
    
    document.getElementById('celebration').appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 3000);
}

// ==========================================
// AZKAR
// ==========================================

function initAzkar() {
    const tabs = document.querySelectorAll('.azkar-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const type = tab.dataset.type;
            appState.currentAzkarType = type;
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            renderAzkar();
        });
    });
    
    renderAzkar();
}

function renderAzkar() {
    const content = document.getElementById('azkarContent');
    const azkarList = azkarData[appState.currentAzkarType] || [];
    
    // Initialize progress for this type
    if (!appState.azkarProgress[appState.currentAzkarType]) {
        appState.azkarProgress[appState.currentAzkarType] = {};
        azkarList.forEach((_, index) => {
            appState.azkarProgress[appState.currentAzkarType][index] = 0;
        });
    }
    
    content.innerHTML = '';
    
    azkarList.forEach((zekr, index) => {
        const progress = appState.azkarProgress[appState.currentAzkarType][index] || 0;
        const isCompleted = progress >= zekr.count;
        
        const card = document.createElement('div');
        card.className = 'azkar-card' + (isCompleted ? ' completed' : '');
        
        card.innerHTML = `
            <div class="azkar-text">${zekr.text}</div>
            <div class="azkar-count">
                <div class="count-badge"><span>${progress}</span> / ${zekr.count}</div>
                <button class="azkar-btn" data-index="${index}" ${isCompleted ? 'disabled' : ''}>
                    ${isCompleted ? 'تم' : 'تسبيح'}
                </button>
            </div>
        `;
        
        const btn = card.querySelector('.azkar-btn');
        btn.addEventListener('click', () => incrementAzkar(index));
        
        content.appendChild(card);
    });
    
    updateAzkarProgress();
}

function incrementAzkar(index) {
    const type = appState.currentAzkarType;
    const zekr = azkarData[type][index];
    
    appState.azkarProgress[type][index]++;
    
    const progress = appState.azkarProgress[type][index];
    
    // Update card
    const cards = document.querySelectorAll('.azkar-card');
    const card = cards[index];
    
    if (card) {
        const countSpan = card.querySelector('.count-badge span');
        if (countSpan) countSpan.textContent = progress;
        
        if (progress >= zekr.count) {
            card.classList.add('completed');
            const btn = card.querySelector('.azkar-btn');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'تم';
            }
            showToast('بارك الله فيك');
        }
    }
    
    updateAzkarProgress();
    saveProgress();
}

function updateAzkarProgress() {
    const type = appState.currentAzkarType;
    const azkarList = azkarData[type] || [];
    const progress = appState.azkarProgress[type] || {};
    
    let completed = 0;
    let total = 0;
    
    azkarList.forEach((zekr, index) => {
        total += zekr.count;
        completed += Math.min(progress[index] || 0, zekr.count);
    });
    
    safeSetText('completedCount', completed);
    safeSetText('totalAzkar', total);
    
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    safeSetStyle('azkarProgress', 'width', percentage + '%');
}

// ==========================================
// LOCATION & PRAYER TIMES STORAGE
// ==========================================

const LOCATION_STORAGE_KEY = 'islamicAppLocation';
const PRAYER_TIMES_STORAGE_KEY = 'islamicAppPrayerTimes';

function saveLocationData(latitude, longitude, locationName) {
    try {
        const data = {
            latitude,
            longitude,
            locationName: locationName || 'موقعك الحالي',
            savedAt: Date.now()
        };
        localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(data));
        console.log('[Storage] Location saved:', data);
    } catch (e) {
        console.warn('[Storage] Could not save location data:', e);
    }
}

function loadLocationData() {
    try {
        const saved = localStorage.getItem(LOCATION_STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            console.log('[Storage] Location loaded:', data);
            return data;
        }
    } catch (e) {
        console.warn('[Storage] Could not load location data:', e);
    }
    return null;
}

function savePrayerTimes(timings, latitude, longitude) {
    try {
        const data = {
            timings,
            latitude,
            longitude,
            savedAt: Date.now(),
            date: new Date().toDateString() // Track which day this is for
        };
        localStorage.setItem(PRAYER_TIMES_STORAGE_KEY, JSON.stringify(data));
        console.log('[Storage] Prayer times saved for date:', data.date);
    } catch (e) {
        console.warn('[Storage] Could not save prayer times:', e);
    }
}

function loadPrayerTimes() {
    try {
        const saved = localStorage.getItem(PRAYER_TIMES_STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            // Check if data is from today
            const today = new Date().toDateString();
            if (data.date === today) {
                console.log('[Storage] Prayer times loaded (today):', data);
                return data;
            } else {
                console.log('[Storage] Prayer times from different day:', data.date, 'vs', today);
            }
        }
    } catch (e) {
        console.warn('[Storage] Could not load prayer times:', e);
    }
    return null;
}

// ==========================================
// STORAGE
// ==========================================

function saveProgress() {
    const data = {
        tasbih: {
            count: appState.tasbihCount,
            target: appState.tasbihTarget,
            total: appState.tasbihTotal,
            round: appState.tasbihRound,
            currentDhikr: appState.currentDhikr
        },
        azkar: appState.azkarProgress
    };
    
    localStorage.setItem('islamicAppProgress', JSON.stringify(data));
}

function loadProgress() {
    try {
        const saved = localStorage.getItem('islamicAppProgress');
        if (saved) {
            const data = JSON.parse(saved);
            
            if (data.tasbih) {
                appState.tasbihCount = data.tasbih.count || 0;
                appState.tasbihTarget = data.tasbih.target || 33;
                appState.tasbihTotal = data.tasbih.total || 0;
                appState.tasbihRound = data.tasbih.round || 0;
                appState.currentDhikr = data.tasbih.currentDhikr || 0;
                updateTasbihDisplay();
                updateBeads();
            }
            
            if (data.azkar) {
                appState.azkarProgress = data.azkar;
            }
        }
    } catch (e) {
        console.log('Could not load progress');
    }
}

// ==========================================
// TOAST NOTIFICATION
// ==========================================

function showToast(message) {
    const toast = safeGetElement('toast');
    safeSetText('toastMessage', message);
    
    if (toast) {
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }
}

// ==========================================
// ADDITIONAL CSS FOR HIGHLIGHTS
// ==========================================

const style = document.createElement('style');
style.textContent = `
    .ayah.active-highlight {
        background: rgba(212, 175, 55, 0.4);
        border-radius: 8px;
        padding: 4px 8px;
    }
    .target-selector {
        display: none;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
        margin-top: 16px;
    }
    .target-selector.show {
        display: flex;
    }
    /* Countdown timer */
    .countdown-time {
        font-size: 1.2rem;
        font-weight: 600;
        color: var(--gold);
        margin-top: 8px;
        font-family: 'Cairo', sans-serif;
    }
    /* Search input */
    .surah-search {
        width: 100%;
        padding: 10px 15px;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        font-family: 'Cairo', sans-serif;
        font-size: 1rem;
    }
    .surah-search::placeholder {
        color: rgba(255,255,255,0.5);
    }
    .surah-search:focus {
        outline: none;
        border-color: var(--gold);
    }
`;
document.head.appendChild(style);

// ==========================================
// PWA INITIALIZATION
// ==========================================

let deferredPrompt = null;
let isAppInstalled = false;

// Initialize PWA functionality
function initPWA() {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
        isAppInstalled = true;
        hideInstallButton();
        return;
    }

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
        isAppInstalled = true;
        hideInstallButton();
        showToast('تم تثبيت التطبيق بنجاح!');
        deferredPrompt = null;
    });

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Check if user previously dismissed
        const dismissed = localStorage.getItem('mehrab_install_dismissed');
        const dismissedTime = localStorage.getItem('mehrab_install_dismissed_time');
        
        if (dismissed && dismissedTime) {
            const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            if (parseInt(dismissedTime) > weekAgo) {
                return; // Don't show for 1 week
            }
        }
        
        showInstallButton();
    });

    // Initialize offline detection
    initOfflineDetection();
    
    // Setup update notification
    setupUpdateNotification();
}

// Show install button
function showInstallButton() {
    const btn = document.getElementById('installBtn');
    if (btn) {
        btn.style.display = 'flex';
        btn.classList.remove('hidden');
    }
}

// Hide install button
function hideInstallButton() {
    const btn = document.getElementById('installBtn');
    if (btn) {
        btn.style.display = 'none';
        btn.classList.add('hidden');
    }
}

// Handle install button click
document.addEventListener('DOMContentLoaded', () => {
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) {
                // Try alternative: open app store or show instructions
                showToast('لتثبيت التطبيق: اضغط على القائمة ← إضافة إلى الشاشة الرئيسية');
                return;
            }
            
            // Show native install prompt
            deferredPrompt.prompt();
            
            // Wait for user response
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                showToast('شكراً لتثبيت التطبيق!');
            } else if (outcome === 'dismissed') {
                // Remember dismissal for 1 week
                localStorage.setItem('mehrab_install_dismissed', 'true');
                localStorage.setItem('mehrab_install_dismissed_time', Date.now().toString());
            }
            
            deferredPrompt = null;
            hideInstallButton();
        });
    }
});

// Offline detection
function initOfflineDetection() {
    // Create offline indicator element
    const indicator = document.createElement('div');
    indicator.className = 'offline-indicator';
    indicator.id = 'offlineIndicator';
    indicator.textContent = '🕌 أنت الآن في وضع عدم الاتصال';
    document.body.insertBefore(indicator, document.body.firstChild);
    
    // Update status on load
    updateOnlineStatus();
    
    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

function updateOnlineStatus() {
    const indicator = document.getElementById('offlineIndicator');
    if (!indicator) return;
    
    if (!navigator.onLine) {
        indicator.classList.add('show');
        showToast('الاتصال انقطع - بعض الميزات قد لا تعمل');
    } else {
        indicator.classList.remove('show');
    }
}

// Check online status helper
function isOnline() {
    return navigator.onLine;
}

// Setup service worker update notification (backup - primary handling is in index.html)
// This function is kept for additional setup if needed
function setupUpdateNotification() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
            // Additional SW ready setup can go here
            console.log('SW ready for updates');
        });
    }
}

// Clear cache (for debugging/reset)
function clearSWCache() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
            if (registration.active) {
                registration.active.postMessage({ type: 'CLEAR_CACHE' });
            }
        });
    }
}

// Cache specific data (for pre-caching)
function cacheAPIResponse(url) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'CACHE_API',
            url: url
        });
    }
}

// Listen for service worker messages
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, surah, cached, failed } = event.data || {};
        
        switch (type) {
            case 'SURAH_CACHED':
                console.log(`Surah ${surah} cached for offline use`);
                break;
                
            case 'CACHE_CLEARED':
                console.log('Cache cleared by service worker');
                showToast('تم مسح الذاكرة المؤقتة');
                break;
                
            case 'CACHE_PROGRESS':
                console.log(`Caching progress: ${current}/${total}`);
                break;
                
            case 'CACHE_ALL_COMPLETE':
                console.log(`All surahs cached: ${cached} success, ${failed} failed`);
                if (failed === 0) {
                    showToast(`تم تحميل جميع السور للقراءة بدون إنترنت!`);
                } else {
                    showToast(`تم تحميل ${cached} من 114 سورة`);
                }
                break;
        }
    });
}

// Export for debugging (in development)
if (typeof window !== 'undefined') {
    window.clearSWCache = clearSWCache;
    window.cacheAPIResponse = cacheAPIResponse;
}
