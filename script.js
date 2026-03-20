/* ==========================================
   ISLAMIC WEB APP - MASTER JAVASCRIPT
   ========================================== */

// ==========================================
// CONFIGURATION
// ==========================================

const QURAN_API_BASE = 'https://api.alquran.cloud/v1';
const AUDIO_BASE = 'https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy';
const ADHAN_API_BASE = 'https://api.aladhan.com/v1';

// ==========================================
// APP STATE
// ==========================================

let appState = {
    // Quran
    surahs: [],
    selectedSurah: null,
    currentSurahData: null,
    isPlaying: false,
    
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
    
    loadProgress();
});

// ==========================================
// QURAN MODULE - Al-Quran Cloud API
// ==========================================

async function initQuran() {
    await loadSurahsList();
    setupQuranEventListeners();
}

async function loadSurahsList() {
    try {
        const response = await fetch(`${QURAN_API_BASE}/surah`);
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
        if (surahNumber) {
            loadSurah(surahNumber);
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
        if (appState.selectedSurah) {
            loadSurah(appState.selectedSurah);
        }
    });
    
    // Play/Pause button (optional - may not exist in all versions)
    safeAddEventListener('playPauseBtn', 'click', toggleAudio);
    
    // Audio events (optional elements)
    const audio = safeGetElement('quranAudio');
    if (audio) {
        audio.addEventListener('timeupdate', updateAudioProgress);
        audio.addEventListener('loadedmetadata', updateAudioDuration);
        audio.addEventListener('ended', () => {
            appState.isPlaying = false;
            updatePlayPauseButton();
        });
    }
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
    appState.selectedSurah = surahNumber;
    
    // Show loading
    hideAllStates();
    safeSetDisplay('loadingState', 'block');
    
    try {
        const response = await fetch(`${QURAN_API_BASE}/surah/${surahNumber}/quran-uthmani`);
        const data = await response.json();
        
        if (data.code === 200 && data.data) {
            appState.currentSurahData = data.data;
            displaySurah(data.data);
        } else {
            throw new Error('Invalid response');
        }
    } catch (error) {
        console.error('Error loading surah:', error);
        showError('تعذر تحميل السورة. يرجى المحاولة مرة أخرى.');
    }
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
    
    // Display ayahs
    displayAyahs(surahData.ayahs, surahData.number);
    
    // Show ayahs container
    hideAllStates();
    safeSetDisplay('ayahsContainer', 'block');
    
    showToast(`تم تحميل سورة ${surahData.name}`);
}

function displayAyahs(ayahs, surahNumber) {
    const container = document.getElementById('ayahsGrid');
    container.innerHTML = '';
    
    ayahs.forEach((ayah, index) => {
        const card = document.createElement('div');
        card.className = 'ayah-card';
        card.dataset.number = ayah.numberInSurah;
        
        card.innerHTML = `
            <div class="ayah-number">${ayah.numberInSurah}</div>
            <div class="ayah-text">${ayah.text}</div>
            <div class="ayah-actions">
                <button class="ayah-action-btn play-ayah" data-surah="${surahNumber}" data-ayah="${ayah.numberInSurah}" title="استماع">
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // Add click handlers for play buttons
    container.querySelectorAll('.play-ayah').forEach(btn => {
        btn.addEventListener('click', function() {
            const ayahNum = this.dataset.ayah;
            playAyahAudio(surahNumber, ayahNum);
        });
    });
}

async function playAyahAudio(surahNumber, ayahNumber) {
    // For now, play the full surah audio
    // In production, you'd use verse-by-verse audio
    const audio = safeGetElement('quranAudio');
    if (audio) {
        audio.src = `${AUDIO_BASE}/${surahNumber}.mp3`;
        audio.play();
        appState.isPlaying = true;
        updatePlayPauseButton();
    }
}

function toggleAudio() {
    const audio = safeGetElement('quranAudio');
    
    if (audio) {
        if (appState.isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        
        appState.isPlaying = !appState.isPlaying;
        updatePlayPauseButton();
    }
}

function updatePlayPauseButton() {
    const btn = safeGetElement('playPauseBtn');
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = appState.isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
    }
}

function updateAudioProgress() {
    const audio = safeGetElement('quranAudio');
    const progress = safeGetElement('audioProgress');
    
    if (audio && progress && audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progress.style.width = `${percent}%`;
    }
}

function updateAudioDuration() {
    const audio = safeGetElement('quranAudio');
    const duration = safeGetElement('audioDuration');
    
    if (audio && duration && audio.duration) {
        const minutes = Math.floor(audio.duration / 60);
        const seconds = Math.floor(audio.duration % 60);
        duration.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
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
    safeSetDisplay('quranAudioPlayer', 'none');
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
    fetchHijriDate(); // Fetch Hijri date once on load
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
        const now = new Date();
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        
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
            // Fallback to Cairo when geolocation fails
            console.warn('Geolocation failed, using Cairo as fallback:', error.message);
            useFallbackLocation();
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes cache
        }
    );
}

function useFallbackLocation() {
    // Use Cairo coordinates as default
    appState.location = {
        latitude: CAIRO_COORDINATES.latitude,
        longitude: CAIRO_COORDINATES.longitude
    };
    appState.locationName = CAIRO_COORDINATES.name;
    
    // Update UI
    safeSetDisplay('locationLoading', 'none');
    safeSetDisplay('locationInfo', 'flex');
    safeSetText('locationName', appState.locationName);
    
    // Fetch prayer times for Cairo
    fetchPrayerTimes(CAIRO_COORDINATES.latitude, CAIRO_COORDINATES.longitude);
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
        
        // Update UI
        safeSetDisplay('locationLoading', 'none');
        safeSetDisplay('locationInfo', 'flex');
        safeSetText('locationName', appState.locationName);
        
    } catch (error) {
        console.error('Error getting location name:', error);
        appState.locationName = 'موقعك الحالي';
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

async function fetchPrayerTimes(lat, lon) {
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
            
            renderPrayerTimes();
            findAndDisplayNextPrayer();
            
            showToast('تم تحديث مواقيت الصلاة');
        } else {
            throw new Error('Invalid API response');
        }
    } catch (error) {
        console.error('Error fetching prayer times:', error);
        showToast('تعذر تحميل مواقيت الصلاة');
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

function initTasbih() {
    const tapBtn = document.getElementById('tapBtn');
    const tasbihCircle = document.getElementById('tasbihCircle');
    const resetBtn = document.getElementById('resetBtn');
    const targetBtn = document.getElementById('targetBtn');
    const targetOptions = document.querySelectorAll('.target-option');
    
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
    
    // Reset
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
            
            saveProgress();
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
    saveProgress();
}

function updateBeads() {
    const beads = document.querySelectorAll('.bead');
    const activeCount = Math.min(appState.tasbihCount, 33);
    
    beads.forEach((bead, index) => {
        bead.classList.toggle('active', index < activeCount);
    });
}

function resetTasbih() {
    appState.tasbihCount = 0;
    updateBeads();
    updateTasbihDisplay();
    saveProgress();
    
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
    /* Audio player */
    .quran-audio-player {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 15px;
        background: rgba(255,255,255,0.05);
        border-radius: 12px;
        margin-top: 20px;
    }
    .audio-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--gold);
        border: none;
        color: #1a1a2e;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .audio-progress {
        flex: 1;
    }
    .progress-track {
        height: 4px;
        background: rgba(255,255,255,0.2);
        border-radius: 2px;
    }
    .progress-fill {
        height: 100%;
        background: var(--gold);
        width: 0%;
        transition: width 0.2s;
    }
`;
document.head.appendChild(style);
