// ===== Traveler Definitions =====
const TRAVELER_DEFS = {
  self:   { label: 'Myself',           icon: '🧑' },
  partner:{ label: 'Partner / Spouse', icon: '💑' },
  child1: { label: 'Child 1',         icon: '👧' },
  child2: { label: 'Child 2',         icon: '👦' },
  child3: { label: 'Child 3',         icon: '👧' },
  child4: { label: 'Child 4',         icon: '👦' },
  child5: { label: 'Child 5',         icon: '👶' },
  pet:    { label: 'Pet',             icon: '🐾' },
};

// ===== State =====
const state = {
  currentStep: 1,
  tripParams: {
    destination: '',
    duration: 0,
    startDate: '',
    endDate: '',
    season: '',
    accommodation: '',
    interests: [],
    hasLaundromat: false,
    multiLocation: false,
    locations: [
      { destination: '', startDate: '', endDate: '' },
      { destination: '', startDate: '', endDate: '' },
      { destination: '', startDate: '', endDate: '' },
    ],
    transportMode: '',
    transportDetails: {},
  },
  activeTravelers: ['self'],
  travelers: {
    self: { gender: '', luggageSizes: [], items: [], wardrobeChoice: '', packingAnalysis: null, outfits: null },
  },
  packingGuide: null,
  activeWardrobeTab: 'self',
  activeOutfitsTab: 'self',
  feedback: { ease: 0, satisfaction: 0, recommend: 0, commentEase: '', commentSatisfaction: '', commentRecommend: '' },
};

let itemIdCounter = 0;

// ===== Image Compression =====
async function compressImage(dataUrl, maxWidth = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
}

// ===== File to DataURL =====
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===== API Calls =====
async function apiPost(endpoint, body) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ===== Loading Overlay =====
function showLoading(text = 'Analyzing…') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}

// ===== Toast =====
let toastTimeout;
function showToast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' error' : '');
  el.style.display = 'block';
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ===== Traveler Management =====
function getTraveler(key) {
  if (!state.travelers[key]) {
    state.travelers[key] = { gender: '', luggageSizes: [], items: [], wardrobeChoice: '', packingAnalysis: null, outfits: null };
  }
  return state.travelers[key];
}

function toggleTraveler(key, enabled) {
  const card = document.querySelector(`.traveler-toggle-card[data-traveler="${key}"]`);
  if (enabled) {
    if (!state.activeTravelers.includes(key)) state.activeTravelers.push(key);
    getTraveler(key);
    if (card) card.classList.add('selected');
  } else {
    state.activeTravelers = state.activeTravelers.filter(k => k !== key);
    if (card) card.classList.remove('selected');
  }
  renderTravelerDetailSections();
}

function renderTravelerDetailSections() {
  const container = document.getElementById('traveler-detail-sections');
  container.innerHTML = state.activeTravelers.map(key => {
    const def = TRAVELER_DEFS[key];
    const traveler = getTraveler(key);
    const isPet = key === 'pet';

    const genderHtml = isPet ? '' : `
      <div class="form-group" style="margin-bottom:12px;">
        <label>Gender</label>
        <select onchange="app.setTravelerGender('${key}', this.value)">
          <option value="" ${traveler.gender === '' ? 'selected' : ''}>Select gender…</option>
          <option value="male" ${traveler.gender === 'male' ? 'selected' : ''}>Male</option>
          <option value="female" ${traveler.gender === 'female' ? 'selected' : ''}>Female</option>
          <option value="gender neutral" ${traveler.gender === 'gender neutral' ? 'selected' : ''}>Gender Neutral</option>
        </select>
      </div>
    `;

    const luggageOptions = isPet
      ? [
          { value: 'Small Carrier', icon: '🐾', name: 'Small Carrier', desc: 'Cat / small dog' },
          { value: 'Medium Carrier', icon: '🐕', name: 'Medium Carrier', desc: 'Medium dog' },
          { value: 'Large Carrier', icon: '🦮', name: 'Large Carrier', desc: 'Large dog' },
        ]
      : [
          { value: 'Carry-on', icon: '🎒', name: 'Carry-on', desc: '22 x 14 x 9 in · ≈ 20L' },
          { value: 'Small',    icon: '🧳', name: 'Small',    desc: '20 x 14 x 8 in · ≈ 35L' },
          { value: 'Medium',   icon: '🧳', name: 'Medium',   desc: '25 x 17 x 11 in · ≈ 55L' },
          { value: 'Large',    icon: '🧳', name: 'Large',    desc: '28 x 19 x 12 in · ≈ 75L' },
          { value: 'Extra Large', icon: '🧳', name: 'Extra Large', desc: '32 x 21 x 14 in · ≈ 100L+' },
        ];

    return `
      <div class="traveler-detail-section">
        <h3 class="traveler-detail-heading">${def.icon} ${def.label}</h3>
        ${genderHtml}
        <label style="font-size:0.85rem;font-weight:600;">Luggage <span class="label-hint">(select all bags you're bringing)</span></label>
        <div class="luggage-grid" style="margin-top:6px;">
          ${luggageOptions.map(opt => `
            <label class="luggage-card ${(traveler.luggageSizes || []).includes(opt.value) ? 'selected' : ''}">
              <input type="checkbox" name="luggage-${key}" value="${opt.value}"
                ${(traveler.luggageSizes || []).includes(opt.value) ? 'checked' : ''}
                onchange="app.setTravelerLuggage('${key}', '${opt.value}', this.checked)" />
              <span class="luggage-icon">${opt.icon}</span>
              <span class="luggage-name">${opt.name}</span>
              <span class="luggage-desc">${opt.desc}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function setTravelerGender(key, value) {
  getTraveler(key).gender = value;
}

function setTravelerLuggage(key, value, checked) {
  const traveler = getTraveler(key);
  if (!Array.isArray(traveler.luggageSizes)) traveler.luggageSizes = [];
  if (checked) {
    if (!traveler.luggageSizes.includes(value)) traveler.luggageSizes.push(value);
  } else {
    traveler.luggageSizes = traveler.luggageSizes.filter(v => v !== value);
  }
  const input = document.querySelector(`input[name="luggage-${key}"][value="${value}"]`);
  if (input) input.closest('.luggage-card').classList.toggle('selected', checked);
}

// ===== Airport Database =====
const AIRPORTS = {
  'chicago': [
    { code: 'ORD', name: "O'Hare International Airport" },
    { code: 'MDW', name: 'Midway International Airport' },
  ],
  'new york': [
    { code: 'JFK', name: 'John F. Kennedy International Airport' },
    { code: 'LGA', name: 'LaGuardia Airport' },
    { code: 'EWR', name: 'Newark Liberty International Airport' },
  ],
  'los angeles': [
    { code: 'LAX', name: 'Los Angeles International Airport' },
    { code: 'BUR', name: 'Hollywood Burbank Airport' },
    { code: 'SNA', name: 'John Wayne Airport (Orange County)' },
    { code: 'LGB', name: 'Long Beach Airport' },
    { code: 'ONT', name: 'Ontario International Airport' },
  ],
  'san francisco': [
    { code: 'SFO', name: 'San Francisco International Airport' },
    { code: 'OAK', name: 'Oakland International Airport' },
    { code: 'SJC', name: 'San Jose International Airport' },
  ],
  'washington': [
    { code: 'DCA', name: 'Ronald Reagan Washington National Airport' },
    { code: 'IAD', name: 'Washington Dulles International Airport' },
    { code: 'BWI', name: 'Baltimore/Washington International Airport' },
  ],
  'dallas': [
    { code: 'DFW', name: 'Dallas/Fort Worth International Airport' },
    { code: 'DAL', name: 'Dallas Love Field' },
  ],
  'houston': [
    { code: 'IAH', name: 'George Bush Intercontinental Airport' },
    { code: 'HOU', name: 'William P. Hobby Airport' },
  ],
  'miami': [
    { code: 'MIA', name: 'Miami International Airport' },
    { code: 'FLL', name: 'Fort Lauderdale-Hollywood International Airport' },
    { code: 'PBI', name: 'Palm Beach International Airport' },
  ],
  'detroit': [
    { code: 'DTW', name: 'Detroit Metropolitan Wayne County Airport' },
    { code: 'FNT', name: 'Bishop International Airport (Flint)' },
  ],
  'tampa': [
    { code: 'TPA', name: 'Tampa International Airport' },
    { code: 'PIE', name: 'St. Pete-Clearwater International Airport' },
    { code: 'SRQ', name: 'Sarasota Bradenton International Airport' },
  ],
  'orlando': [
    { code: 'MCO', name: 'Orlando International Airport' },
    { code: 'SFB', name: 'Orlando Sanford International Airport' },
  ],
  'minneapolis': [
    { code: 'MSP', name: 'Minneapolis-Saint Paul International Airport' },
  ],
  'denver': [
    { code: 'DEN', name: 'Denver International Airport' },
  ],
  'seattle': [
    { code: 'SEA', name: 'Seattle-Tacoma International Airport' },
  ],
  'atlanta': [
    { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport' },
  ],
  'boston': [
    { code: 'BOS', name: 'Boston Logan International Airport' },
  ],
  'phoenix': [
    { code: 'PHX', name: 'Phoenix Sky Harbor International Airport' },
    { code: 'AZA', name: 'Phoenix-Mesa Gateway Airport' },
  ],
  'philadelphia': [
    { code: 'PHL', name: 'Philadelphia International Airport' },
  ],
  'san diego': [
    { code: 'SAN', name: 'San Diego International Airport' },
  ],
  'charlotte': [
    { code: 'CLT', name: 'Charlotte Douglas International Airport' },
  ],
  'las vegas': [
    { code: 'LAS', name: 'Harry Reid International Airport' },
  ],
  'nashville': [
    { code: 'BNA', name: 'Nashville International Airport' },
  ],
  'austin': [
    { code: 'AUS', name: 'Austin-Bergstrom International Airport' },
  ],
  'portland': [
    { code: 'PDX', name: 'Portland International Airport' },
  ],
  'salt lake city': [
    { code: 'SLC', name: 'Salt Lake City International Airport' },
  ],
  'st louis': [
    { code: 'STL', name: 'St. Louis Lambert International Airport' },
  ],
  'pittsburgh': [
    { code: 'PIT', name: 'Pittsburgh International Airport' },
  ],
  'cleveland': [
    { code: 'CLE', name: 'Cleveland Hopkins International Airport' },
  ],
  'cincinnati': [
    { code: 'CVG', name: 'Cincinnati/Northern Kentucky International Airport' },
  ],
  'kansas city': [
    { code: 'MCI', name: 'Kansas City International Airport' },
  ],
  'indianapolis': [
    { code: 'IND', name: 'Indianapolis International Airport' },
  ],
  'new orleans': [
    { code: 'MSY', name: 'Louis Armstrong New Orleans International Airport' },
  ],
  'raleigh': [
    { code: 'RDU', name: 'Raleigh-Durham International Airport' },
  ],
  'san antonio': [
    { code: 'SAT', name: 'San Antonio International Airport' },
  ],
  'honolulu': [
    { code: 'HNL', name: 'Daniel K. Inouye International Airport' },
  ],
  'anchorage': [
    { code: 'ANC', name: 'Ted Stevens Anchorage International Airport' },
  ],
};

function lookupAirports(input) {
  const val = input.trim().toLowerCase();
  if (!val) return null;

  // Check if it looks like an airport code (2-4 uppercase letters)
  if (/^[a-z]{2,4}$/i.test(val)) return null;

  // Strip state abbreviations and common separators
  const cityPart = val.replace(/,?\s*[a-z]{2}$/i, '').trim();

  for (const [city, airports] of Object.entries(AIRPORTS)) {
    if (city.includes(cityPart) || cityPart.includes(city)) {
      return airports;
    }
  }
  return null;
}

function handleAirportInput(value) {
  state.tripParams.transportDetails.airport = value;

  const matchedAirports = lookupAirports(value);
  const selectContainer = document.getElementById('airport-select-container');

  if (matchedAirports && matchedAirports.length > 0) {
    selectContainer.style.display = 'block';
    selectContainer.innerHTML = `
      <label>Select Your Airport</label>
      <div class="airport-options">
        ${matchedAirports.map(ap => `
          <label class="airport-option ${state.tripParams.transportDetails.selectedAirport === ap.code ? 'selected' : ''}">
            <input type="radio" name="airport-select" value="${ap.code}"
              ${state.tripParams.transportDetails.selectedAirport === ap.code ? 'checked' : ''}
              onchange="app.selectAirport('${ap.code}', '${ap.name.replace(/'/g, "\\'")}')" />
            <span class="airport-code">${ap.code}</span>
            <span class="airport-name">(${ap.name})</span>
          </label>
        `).join('')}
      </div>
    `;
  } else {
    selectContainer.style.display = 'none';
    selectContainer.innerHTML = '';
    state.tripParams.transportDetails.selectedAirport = '';
    state.tripParams.transportDetails.selectedAirportName = '';
  }
}

function selectAirport(code, name) {
  state.tripParams.transportDetails.selectedAirport = code;
  state.tripParams.transportDetails.selectedAirportName = name;
  state.tripParams.transportDetails.airport = `${code} (${name})`;

  document.querySelectorAll('.airport-option').forEach(opt => {
    opt.classList.toggle('selected', opt.querySelector('input').value === code);
  });
}

// ===== Step Navigation =====
async function goToStep(step) {
  if (step > state.currentStep) {
    if (!validateStep(state.currentStep)) return;
    if (state.currentStep === 1) collectTripParams();
    if (step === 3 && state.currentStep === 2) {
      await runPackingGuide();
    }
    if (step === 5 && state.currentStep === 4) {
      await runAnalysisAndOutfits();
    }
    if (step === 6 && state.currentStep === 5) {
      renderFinalReport();
    }
  }
  state.currentStep = step;

  if (step === 4) renderWardrobeTabs();
  if (step === 5) renderOutfitsTabs();
  if (step === 7) initFeedbackForm();

  renderStep(step);
}

function validateStep(step) {
  if (step === 1) {
    const p = collectTripParams(true);
    if (!p.destination.trim()) { showToast('Please enter a destination.', true); return false; }
    if (!p.duration || p.duration < 1) { showToast('Please enter trip duration.', true); return false; }
    if (!p.season) { showToast('Please select a season.', true); return false; }
    if (p.interests.length === 0) { showToast('Please select at least one interest.', true); return false; }
    if (!p.transportMode) { showToast('Please select a mode of transportation.', true); return false; }
    if (p.multiLocation) {
      const activeLocs = p.locations.filter(l => l.destination.trim());
      if (activeLocs.length < 2) { showToast('Please enter at least 2 locations for a multi-location trip.', true); return false; }
      for (const loc of activeLocs) {
        if (!loc.startDate || !loc.endDate) { showToast(`Please enter arrival and departure dates for all locations.`, true); return false; }
      }
    }
  }
  if (step === 2) {
    for (const key of state.activeTravelers) {
      const t = getTraveler(key);
      if (key !== 'pet' && !t.gender) {
        showToast(`Please select a gender for ${TRAVELER_DEFS[key].label}.`, true);
        return false;
      }
      if (!t.luggageSizes || !t.luggageSizes.length) {
        showToast(`Please select at least one bag for ${TRAVELER_DEFS[key].label}.`, true);
        return false;
      }
    }
  }
  if (step === 4) {
    for (const key of state.activeTravelers) {
      const t = getTraveler(key);
      if (!t.wardrobeChoice) {
        showToast(`Please choose whether to upload photos for ${TRAVELER_DEFS[key].label}.`, true);
        return false;
      }
      if (t.wardrobeChoice === 'upload') {
        if (t.items.length === 0) {
          showToast(`Please add at least one item for ${TRAVELER_DEFS[key].label}, or choose "No photos to upload".`, true);
          return false;
        }
        if (t.items.some(i => !i.analysis)) {
          showToast(`Please wait for all items to finish analyzing for ${TRAVELER_DEFS[key].label}.`, true);
          return false;
        }
      }
    }
  }
  return true;
}

function collectTripParams(peek = false) {
  const p = {
    destination: document.getElementById('destination').value,
    duration: parseInt(document.getElementById('duration').value) || 0,
    startDate: document.getElementById('start-date').value,
    endDate: document.getElementById('end-date').value,
    season: document.getElementById('season').value,
    accommodation: document.getElementById('accommodation').value,
    interests: [...document.querySelectorAll('#interests-grid input:checked')].map(el => el.value),
    hasLaundromat: document.getElementById('laundromat').checked,
    multiLocation: state.tripParams.multiLocation,
    locations: state.tripParams.locations,
    transportMode: state.tripParams.transportMode,
    transportDetails: state.tripParams.transportDetails,
  };
  if (!peek) Object.assign(state.tripParams, p);
  return p;
}

function setTransportMode(mode) {
  state.tripParams.transportMode = mode;
  state.tripParams.transportDetails = {};

  document.querySelectorAll('.transport-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.mode === mode);
  });

  const container = document.getElementById('transport-details');
  container.style.display = 'block';

  if (mode === 'flying') {
    container.innerHTML = `
      <div class="form-grid">
        <div class="form-group">
          <label for="departure-airport">Departure Airport <span class="label-hint">(Provide the airport code e.g. ORD, LAX or provide city and state)</span></label>
          <input type="text" id="departure-airport" placeholder="e.g. LAX, JFK, or Chicago, IL"
            oninput="app.handleAirportInput(this.value)" />
        </div>
        <div class="form-group">
          <label for="flight-time">Approximate Departure Time <span class="label-hint">(hour:minute AM or PM)</span></label>
          <input type="text" id="flight-time" placeholder="e.g. 7:30 AM"
            oninput="app.updateTransportDetail('departureTime', this.value)" />
        </div>
      </div>
      <div id="airport-select-container" style="display:none"></div>
    `;
  } else if (mode === 'train') {
    container.innerHTML = `
      <div class="form-grid">
        <div class="form-group">
          <label for="departure-station">Departure Train Station</label>
          <input type="text" id="departure-station" placeholder="e.g. Penn Station, Union Station"
            oninput="app.updateTransportDetail('station', this.value)" />
        </div>
        <div class="form-group">
          <label for="train-time">Approximate Departure Time <span class="label-hint">(hour:minute AM or PM)</span></label>
          <input type="text" id="train-time" placeholder="e.g. 9:00 AM"
            oninput="app.updateTransportDetail('departureTime', this.value)" />
        </div>
      </div>
    `;
  } else if (mode === 'driving') {
    container.innerHTML = `
      <div class="form-grid">
        <div class="form-group">
          <label for="departure-city">Departing From (City)</label>
          <input type="text" id="departure-city" placeholder="e.g. Los Angeles, CA"
            oninput="app.updateTransportDetail('departureCity', this.value)" />
        </div>
        <div class="form-group">
          <label for="drive-time">Planned Departure Time <span class="label-hint">(hour:minute AM or PM)</span></label>
          <input type="text" id="drive-time" placeholder="e.g. 6:00 AM"
            oninput="app.updateTransportDetail('departureTime', this.value)" />
        </div>
      </div>
    `;
  }
}

function updateTransportDetail(key, value) {
  state.tripParams.transportDetails[key] = value;
}

// ===== Multi-Location =====
function setMultiLocation(enabled) {
  state.tripParams.multiLocation = enabled;

  document.getElementById('ts-single').classList.toggle('selected', !enabled);
  document.getElementById('ts-multi').classList.toggle('selected', enabled);
  document.querySelector('#ts-single input').checked = !enabled;
  document.querySelector('#ts-multi input').checked = enabled;

  // Pre-fill Location 1 from the main destination field when switching to multi
  if (enabled) {
    const mainDest = document.getElementById('destination').value.trim();
    const mainStart = document.getElementById('start-date').value;
    const mainEnd = document.getElementById('end-date').value;
    if (mainDest) state.tripParams.locations[0].destination = mainDest;
    if (mainStart) state.tripParams.locations[0].startDate = mainStart;
    if (mainEnd) state.tripParams.locations[0].endDate = mainEnd;
  }

  renderMultiLocationSection();
}

function syncDestinationToLocation1(value) {
  if (state.tripParams.multiLocation) {
    state.tripParams.locations[0].destination = value;
    const loc1Input = document.querySelector('.loc-destination[data-idx="0"]');
    if (loc1Input) loc1Input.value = value;
  }
}

function renderMultiLocationSection() {
  const section = document.getElementById('multi-location-section');
  if (!state.tripParams.multiLocation) {
    section.style.display = 'none';
    section.innerHTML = '';
    return;
  }
  section.style.display = 'block';

  const locs = state.tripParams.locations;
  section.innerHTML = `
    <div class="multi-location-wrap">
      <p class="section-desc" style="margin-bottom:12px;">Enter each location and the dates you'll be there. Location 1 is your primary destination above.</p>
      ${[0, 1, 2].map(i => `
        <div class="location-row" id="location-row-${i}">
          <div class="location-row-label">Location ${i + 1}${i === 2 ? ' <span class="label-hint">(optional)</span>' : ''}</div>
          <div class="location-row-fields">
            <div class="form-group">
              <label>Destination</label>
              <input type="text" class="loc-destination" data-idx="${i}"
                placeholder="${i === 0 ? 'e.g. Paris, France' : i === 1 ? 'e.g. Rome, Italy' : 'e.g. Barcelona, Spain'}"
                value="${locs[i].destination}"
                oninput="app.updateLocation(${i}, 'destination', this.value)" />
            </div>
            <div class="form-group">
              <label>Arrival Date</label>
              <input type="date" class="loc-start" data-idx="${i}"
                value="${locs[i].startDate}"
                oninput="app.updateLocation(${i}, 'startDate', this.value)" />
            </div>
            <div class="form-group">
              <label>Departure Date</label>
              <input type="date" class="loc-end" data-idx="${i}"
                value="${locs[i].endDate}"
                oninput="app.updateLocation(${i}, 'endDate', this.value)" />
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function updateLocation(idx, field, value) {
  state.tripParams.locations[idx][field] = value;

  // Auto-sync Location 1 with main destination/dates
  if (idx === 0) {
    if (field === 'destination') document.getElementById('destination').value = value;
    if (field === 'startDate') document.getElementById('start-date').value = value;
    if (field === 'endDate') document.getElementById('end-date').value = value;
  }

  // Recalculate total duration from first start to last end
  const locs = state.tripParams.locations.filter(l => l.startDate && l.endDate);
  if (locs.length > 0) {
    const starts = locs.map(l => new Date(l.startDate)).filter(d => !isNaN(d));
    const ends = locs.map(l => new Date(l.endDate)).filter(d => !isNaN(d));
    if (starts.length && ends.length) {
      const minStart = new Date(Math.min(...starts));
      const maxEnd = new Date(Math.max(...ends));
      const days = Math.round((maxEnd - minStart) / (1000 * 60 * 60 * 24)) + 1;
      document.getElementById('duration').value = days;
      document.getElementById('start-date').value = minStart.toISOString().split('T')[0];
      document.getElementById('end-date').value = maxEnd.toISOString().split('T')[0];
    }
  }
}

function renderStep(step) {
  document.querySelectorAll('.step-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`step-${step}`).classList.add('active');

  document.querySelectorAll('.step-indicator').forEach(ind => {
    const n = parseInt(ind.dataset.step);
    ind.classList.remove('active', 'completed');
    if (n === step) ind.classList.add('active');
    else if (n < step) ind.classList.add('completed');
  });

  document.querySelectorAll('.step-line').forEach((line, i) => {
    line.classList.toggle('completed', i + 1 < step);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== Traveler Tabs (shared renderer) =====
function renderTravelerTabBar(containerId, activeKey, onClickFn) {
  const container = document.getElementById(containerId);
  container.innerHTML = state.activeTravelers.map(key => {
    const def = TRAVELER_DEFS[key];
    return `<button class="traveler-tab ${key === activeKey ? 'active' : ''}"
              onclick="${onClickFn}('${key}')">${def.icon} ${def.label}</button>`;
  }).join('');
}

// ===== Step 3: Packing Guide =====
async function runPackingGuide() {
  showLoading('Analyzing climate and building your packing guide…');
  try {
    const travelerInfo = state.activeTravelers.map(key => {
      const t = getTraveler(key);
      return {
        label: TRAVELER_DEFS[key].label,
        gender: t.gender || 'n/a',
        luggageSizes: t.luggageSizes && t.luggageSizes.length ? t.luggageSizes : ['Medium'],
        isPet: key === 'pet',
      };
    });

    const result = await apiPost('/api/packing-guide', {
      tripParams: state.tripParams,
      travelers: travelerInfo,
    });

    state.packingGuide = result;
    renderPackingGuide(result);
  } catch (e) {
    showToast(`Packing guide failed: ${e.message}`, true);
    throw e;
  } finally {
    hideLoading();
  }
}

function renderLocationBlock(loc) {
  return `
    <div class="location-guide-block">
      <div class="location-guide-header">
        <span class="location-guide-icon">📍</span>
        <div>
          <h3 class="location-guide-title">${loc.destination}</h3>
          ${loc.dates ? `<span class="location-guide-dates">${loc.dates}</span>` : ''}
        </div>
      </div>
      <div class="climate-summary-card">
        <div class="climate-icon">${loc.climateIcon || '🌤️'}</div>
        <div class="climate-info">
          <h3>${loc.climate || 'Climate'}</h3>
          <p>${loc.climateSummary || ''}</p>
          <div class="climate-details">
            ${loc.tempRange ? `<span class="climate-detail">🌡️ ${loc.tempRange}</span>` : ''}
            ${loc.precipitation ? `<span class="climate-detail">💧 ${loc.precipitation}</span>` : ''}
            ${loc.humidity ? `<span class="climate-detail">💨 ${loc.humidity}</span>` : ''}
          </div>
        </div>
      </div>
      ${loc.weatherForecast ? `
      <div class="weather-forecast-card">
        <div class="weather-forecast-icon">📅</div>
        <div class="weather-forecast-info">
          <h3>Weather Forecast</h3>
          <p>${loc.weatherForecast}</p>
        </div>
      </div>` : ''}
      ${loc.cultureTitle ? `
      <div class="culture-summary-card">
        <div class="culture-icon">🌍</div>
        <div class="culture-info">
          <h3>${loc.cultureTitle}</h3>
          <p>${loc.cultureSummary || ''}</p>
          ${(loc.cultureNotes || []).length ? `
          <ul class="culture-notes">
            ${loc.cultureNotes.map(note => `<li>${note}</li>`).join('')}
          </ul>` : ''}
        </div>
      </div>` : ''}
      ${loc.localRecommendations ? renderLocalRecsHtml(loc.localRecommendations) : ''}
    </div>
  `;
}

function renderLocalRecsHtml(recs) {
  if (!recs) return '';
  const sections = [
    { key: 'grocery', icon: '🛒', label: 'Grocery & Markets' },
    { key: 'pharmacy', icon: '💊', label: 'Pharmacy & Drugstore' },
    { key: 'clothing', icon: '👕', label: 'Clothing & Shopping' },
    { key: 'restaurants', icon: '🍽️', label: 'Dining & Restaurants' },
  ];
  const cards = sections.map(s => {
    const items = recs[s.key];
    if (!items || !items.length) return '';
    return `<div class="local-rec-card">
      <div class="local-rec-icon">${s.icon}</div>
      <div class="local-rec-body"><h4>${s.label}</h4><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>
    </div>`;
  }).filter(Boolean).join('');
  if (!cards) return '';
  return `<div class="local-recs-section"><h4 class="local-recs-title">📌 Local Recommendations</h4><div class="local-recs-grid">${cards}</div></div>`;
}

function renderPackingGuide(data) {
  const container = document.getElementById('packing-guide-content');

  let html = '';

  // Multi-location: render per-stop climate/culture/recs blocks
  if (data.locationGuides && data.locationGuides.length > 0) {
    html += `<h3 class="section-subheading">Your Destinations</h3>`;
    html += data.locationGuides.map(loc => renderLocationBlock(loc)).join('');
  } else {
    // Single location
    html += `
    <div class="climate-summary-card">
      <div class="climate-icon">${data.climateIcon || '🌤️'}</div>
      <div class="climate-info">
        <h3>${data.climate || 'Climate'}</h3>
        <p>${data.climateSummary || ''}</p>
        <div class="climate-details">
          ${data.tempRange ? `<span class="climate-detail">🌡️ ${data.tempRange}</span>` : ''}
          ${data.precipitation ? `<span class="climate-detail">💧 ${data.precipitation}</span>` : ''}
          ${data.humidity ? `<span class="climate-detail">💨 ${data.humidity}</span>` : ''}
        </div>
      </div>
    </div>

    ${data.weatherForecast ? `
    <div class="weather-forecast-card">
      <div class="weather-forecast-icon">📅</div>
      <div class="weather-forecast-info">
        <h3>Weather Forecast for Your Dates</h3>
        <p>${data.weatherForecast}</p>
      </div>
    </div>` : ''}

    ${data.cultureTitle ? `
    <div class="culture-summary-card">
      <div class="culture-icon">🌍</div>
      <div class="culture-info">
        <h3>${data.cultureTitle}</h3>
        <p>${data.cultureSummary || ''}</p>
        ${(data.cultureNotes || []).length ? `
        <ul class="culture-notes">
          ${data.cultureNotes.map(note => `<li>${note}</li>`).join('')}
        </ul>` : ''}
      </div>
    </div>` : ''}

    ${data.localRecommendations ? renderLocalRecsHtml(data.localRecommendations) : ''}
  `;
  }

  html += `${data.travelLogistics ? `
    <div class="logistics-card">
      <div class="logistics-icon">${data.travelLogistics.icon || '🚏'}</div>
      <div class="logistics-info">
        <h3>${data.travelLogistics.title || 'Travel Logistics'}</h3>
        <p>${data.travelLogistics.summary || ''}</p>
        ${(data.travelLogistics.tips || []).length ? `
        <ul class="logistics-tips">
          ${data.travelLogistics.tips.map(tip => `<li>${tip}</li>`).join('')}
        </ul>` : ''}
      </div>
    </div>` : ''}`;

  const guides = data.travelerGuides || [];
  for (const guide of guides) {
    html += `
      <div class="traveler-guide-card">
        <h3 class="traveler-guide-heading">${guide.travelerLabel}</h3>
        ${guide.bagGuides && guide.bagGuides.length ? `
        <div class="guide-section bag-guides-section">
          <h4>🧳 What to Pack in Each Bag</h4>
          <div class="bag-guides-grid">
            ${guide.bagGuides.map(bg => `
              <div class="bag-guide-card">
                <div class="bag-guide-name">${bg.bagName}</div>
                <ul class="guide-list">
                  ${(bg.items || []).map(item => `<li><span class="guide-check">✓</span> ${item}</li>`).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        </div>` : ''}
        ${guide.clothingEssentials && guide.clothingEssentials.length ? `
        <div class="guide-section">
          <h4>👕 Clothing Essentials</h4>
          <ul class="guide-list">
            ${guide.clothingEssentials.map(item => `<li><span class="guide-check">✓</span> ${item}</li>`).join('')}
          </ul>
        </div>` : (guide.essentials && guide.essentials.length ? `
        <div class="guide-section">
          <h4>✓ Essentials to Pack</h4>
          <ul class="guide-list">
            ${guide.essentials.map(item => `<li><span class="guide-check">✓</span> ${item}</li>`).join('')}
          </ul>
        </div>` : '')}
        ${guide.travelEssentials && guide.travelEssentials.length ? `
        <div class="guide-section">
          <h4>🎒 Travel Essentials</h4>
          <ul class="guide-list">
            ${guide.travelEssentials.map(item => `<li><span class="guide-check">✓</span> ${item}</li>`).join('')}
          </ul>
        </div>` : ''}
        ${guide.toiletryEssentials && guide.toiletryEssentials.length ? `
        <div class="guide-section">
          <h4>🧴 Toiletry Essentials</h4>
          <ul class="guide-list">
            ${guide.toiletryEssentials.map(item => `<li><span class="guide-check">✓</span> ${item}</li>`).join('')}
          </ul>
        </div>` : ''}
        ${guide.recommended && guide.recommended.length ? `
        <div class="guide-section">
          <h4>Recommended</h4>
          <ul class="guide-list">
            ${guide.recommended.map(item => `<li><span class="guide-dot">●</span> ${item}</li>`).join('')}
          </ul>
        </div>` : ''}
        ${guide.tips && guide.tips.length ? `
        <div class="guide-section">
          <h4>Tips</h4>
          <ul class="guide-list tips">
            ${guide.tips.map(tip => `<li><span class="tip-icon">💡</span> ${tip}</li>`).join('')}
          </ul>
        </div>` : ''}
      </div>
    `;
  }

  container.innerHTML = html;
}

// ===== Print Packing Guide =====
function printPackingGuide() {
  const content = document.getElementById('packing-guide-content');
  if (!content || !content.innerHTML.trim() || content.querySelector('.empty-state')) {
    showToast('Please generate a packing guide first.', true);
    return;
  }
  const p = state.tripParams;
  document.getElementById('print-report').innerHTML = `
    <h1>PackSmart — Packing Guide</h1>
    <p><strong>Destination:</strong> ${p.destination} &nbsp; <strong>Duration:</strong> ${p.duration} days &nbsp; <strong>Season:</strong> ${p.season}</p>
    ${content.innerHTML}
  `;
  window.print();
}

// ===== Step 4: Wardrobe (per-traveler) =====
function renderWardrobeTabs() {
  if (!state.activeTravelers.includes(state.activeWardrobeTab)) {
    state.activeWardrobeTab = state.activeTravelers[0];
  }
  renderTravelerTabBar('wardrobe-tabs', state.activeWardrobeTab, 'app.switchWardrobeTab');
  renderWardrobeContent(state.activeWardrobeTab);
}

function switchWardrobeTab(key) {
  state.activeWardrobeTab = key;
  renderTravelerTabBar('wardrobe-tabs', key, 'app.switchWardrobeTab');
  renderWardrobeContent(key);
}

function setWardrobeChoice(travelerKey, choice) {
  getTraveler(travelerKey).wardrobeChoice = choice;
  renderWardrobeContent(travelerKey);
}

function renderWardrobeContent(travelerKey) {
  const container = document.getElementById('wardrobe-tab-content');
  const traveler = getTraveler(travelerKey);
  const def = TRAVELER_DEFS[travelerKey];
  const isPet = travelerKey === 'pet';
  const itemLabel = isPet ? 'pet items' : 'clothing items';

  // Show choice if not yet made
  if (!traveler.wardrobeChoice) {
    container.innerHTML = `
      <div class="wardrobe-choice-row">
        <div class="wardrobe-choice-card" onclick="app.setWardrobeChoice('${travelerKey}', 'upload')">
          <div class="wardrobe-choice-icon">${isPet ? '📷' : '👕'}</div>
          <div class="wardrobe-choice-title">Upload Photos</div>
          <div class="wardrobe-choice-desc">Photograph or upload ${isPet ? 'pet supplies' : 'clothing items'} to get AI-powered outfit recommendations and packing analysis.</div>
        </div>
        <div class="wardrobe-choice-card" onclick="app.setWardrobeChoice('${travelerKey}', 'skip')">
          <div class="wardrobe-choice-icon">⏭️</div>
          <div class="wardrobe-choice-title">No Photos to Upload</div>
          <div class="wardrobe-choice-desc">Skip photo upload for ${def.label}. You'll still receive packing guide recommendations above.</div>
        </div>
      </div>
    `;
    return;
  }

  if (traveler.wardrobeChoice === 'skip') {
    container.innerHTML = `
      <div class="wardrobe-skipped">
        <div class="empty-icon">⏭️</div>
        <p>No photos will be uploaded for <strong>${def.label}</strong>.</p>
        <button class="btn-outline" style="margin-top:12px;" onclick="app.setWardrobeChoice('${travelerKey}', '')">Change Choice</button>
      </div>
    `;
    return;
  }

  // Upload mode
  let html = `
    <div class="wardrobe-for-traveler" data-traveler="${travelerKey}">
      <div class="add-item-buttons">
        <button class="btn-outline" onclick="document.getElementById('camera-input-${travelerKey}').click()">
          📷 Take Photo
        </button>
        <button class="btn-outline" onclick="document.getElementById('file-input-${travelerKey}').click()">
          📁 Upload Photo
        </button>
        <button class="btn-outline" onclick="app.setWardrobeChoice('${travelerKey}', '')">
          ↩ Change Choice
        </button>
        <input type="file" id="camera-input-${travelerKey}" accept="image/*" capture="environment" style="display:none"
          onchange="app.handleFileInput(this, '${travelerKey}')" />
        <input type="file" id="file-input-${travelerKey}" accept="image/*" multiple style="display:none"
          onchange="app.handleFileInput(this, '${travelerKey}')" />
      </div>
  `;

  if (traveler.items.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">${isPet ? '🐾' : '👕'}</div>
        <p>No ${itemLabel} added yet for ${def.label}. Start by taking a photo or uploading an image.</p>
      </div>
    `;
  } else {
    html += `<div class="wardrobe-grid">`;
    html += traveler.items.map(item => {
      const analyzing = !item.analysis;
      const name = item.analysis ? item.analysis.type : '…';
      const category = item.analysis ? item.analysis.category : '';
      const tags = item.analysis ? [...(item.analysis.style || []), ...(item.analysis.weatherSuitability || [])].slice(0, 4) : [];

      return `
        <div class="item-card ${analyzing ? 'item-analyzing' : ''}" id="item-${item.id}">
          <img class="item-card-img" src="${item.imageData}" alt="${itemLabel}" />
          ${!analyzing ? `<button class="item-delete-btn" onclick="app.deleteItem('${travelerKey}', ${item.id})" title="Remove">✕</button>` : ''}
          <div class="item-card-body">
            <div class="item-card-name">${name}</div>
            ${category ? `<div class="item-card-category">${category}</div>` : ''}
            ${tags.length ? `<div class="item-card-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
            ${analyzing ? '<div class="item-analyzing-label">Analyzing…</div>' : ''}
          </div>
        </div>`;
    }).join('');
    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}

async function handleFileInput(input, travelerKey) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  input.value = '';

  for (const file of files) {
    await processImageFile(file, travelerKey);
  }
}

async function processImageFile(file, travelerKey) {
  let dataUrl;
  try {
    dataUrl = await readFile(file);
    dataUrl = await compressImage(dataUrl);
  } catch (e) {
    showToast('Failed to read image.', true);
    return;
  }

  const id = ++itemIdCounter;
  const item = { id, imageData: dataUrl, analysis: null };
  const traveler = getTraveler(travelerKey);
  traveler.items.push(item);
  if (state.activeWardrobeTab === travelerKey) renderWardrobeContent(travelerKey);

  try {
    const result = await apiPost('/api/analyze-item', { imageData: dataUrl });
    item.analysis = result.analysis;
    if (state.activeWardrobeTab === travelerKey) renderWardrobeContent(travelerKey);
  } catch (e) {
    showToast(`Could not analyze item: ${e.message}`, true);
    traveler.items = traveler.items.filter(i => i.id !== id);
    if (state.activeWardrobeTab === travelerKey) renderWardrobeContent(travelerKey);
  }
}

function deleteItem(travelerKey, id) {
  const traveler = getTraveler(travelerKey);
  traveler.items = traveler.items.filter(i => i.id !== id);
  if (state.activeWardrobeTab === travelerKey) renderWardrobeContent(travelerKey);
}

// ===== Step 5: Analysis & Outfits (per-traveler) =====
async function runAnalysisAndOutfits() {
  const travelersWithPhotos = state.activeTravelers.filter(k => getTraveler(k).wardrobeChoice === 'upload' && getTraveler(k).items.length > 0);
  if (travelersWithPhotos.length === 0) return;

  showLoading('Analyzing packing and generating outfit recommendations…');
  try {
    for (const key of travelersWithPhotos) {
      const traveler = getTraveler(key);
      const itemAnalyses = traveler.items.map(i => i.analysis);
      const travelerParams = {
        ...state.tripParams,
        luggageSize: (traveler.luggageSizes || []).join(', '),
        gender: traveler.gender,
      };

      const [analysisResult, outfitsResult] = await Promise.all([
        apiPost('/api/analyze-packing', {
          items: itemAnalyses,
          tripParams: travelerParams,
          travelerLabel: TRAVELER_DEFS[key].label,
        }),
        apiPost('/api/get-outfits', {
          items: itemAnalyses,
          tripParams: travelerParams,
          travelerLabel: TRAVELER_DEFS[key].label,
        }),
      ]);

      traveler.packingAnalysis = analysisResult;
      traveler.outfits = outfitsResult;
    }
  } catch (e) {
    showToast(`Analysis failed: ${e.message}`, true);
    throw e;
  } finally {
    hideLoading();
  }
}

function renderOutfitsTabs() {
  if (!state.activeTravelers.includes(state.activeOutfitsTab)) {
    state.activeOutfitsTab = state.activeTravelers[0];
  }
  renderTravelerTabBar('outfits-tabs', state.activeOutfitsTab, 'app.switchOutfitsTab');
  renderOutfitsContent(state.activeOutfitsTab);
}

function switchOutfitsTab(key) {
  state.activeOutfitsTab = key;
  renderTravelerTabBar('outfits-tabs', key, 'app.switchOutfitsTab');
  renderOutfitsContent(key);
}

function getScoreColor(score) {
  if (score >= 75) return '#27ae60';
  if (score >= 50) return '#f39c12';
  return '#e74c3c';
}

function renderOutfitsContent(travelerKey) {
  const container = document.getElementById('outfits-tab-content');
  const traveler = getTraveler(travelerKey);
  const analysis = traveler.packingAnalysis;
  const outfitsData = traveler.outfits;

  if (traveler.wardrobeChoice === 'skip') {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⏭️</div><p>No photos were uploaded for this traveler. Refer to the Packing Guide (Step 3) for personalized packing recommendations.</p></div>`;
    return;
  }

  if (!analysis && !outfitsData) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">👗</div><p>No results available yet.</p></div>`;
    return;
  }

  let html = '';

  // Analysis section
  if (analysis) {
    const missing = analysis.missing || [];
    const excessive = analysis.excessive || [];
    const tips = analysis.tips || [];

    html += `
      <div class="analysis-score-wrap">
        <div class="score-circle" style="background:${getScoreColor(analysis.coverageScore)}">
          ${analysis.coverageScore}%
        </div>
        <div class="score-summary">
          <h3>Packing Coverage Score</h3>
          <p>${analysis.summary || ''}</p>
        </div>
      </div>

      ${missing.length ? `
      <div class="analysis-section">
        <h3>Missing Items</h3>
        <ul class="missing-list">
          ${missing.map(m => `
            <li class="missing-item ${m.priority || 'optional'}">
              <span class="priority-badge">${m.priority || 'optional'}</span>
              <div class="missing-item-text">
                <div class="missing-item-name">${m.item}</div>
                <div class="missing-item-reason">${m.reason}</div>
              </div>
            </li>`).join('')}
        </ul>
      </div>` : ''}

      ${excessive.length ? `
      <div class="analysis-section">
        <h3>Potentially Excessive</h3>
        <ul class="excessive-list">
          ${excessive.map(e => `
            <li class="excessive-item">
              <span>⚠️</span>
              <div><strong>${e.item}</strong> — ${e.reason}</div>
            </li>`).join('')}
        </ul>
      </div>` : ''}

      ${tips.length ? `
      <div class="analysis-section">
        <h3>Packing Tips</h3>
        <ul class="tips-list">
          ${tips.map(t => `<li><span class="tip-icon">💡</span>${t}</li>`).join('')}
        </ul>
      </div>` : ''}
    `;
  }

  // Outfits section
  if (outfitsData) {
    const outfits = outfitsData.outfits || [];
    const stylingTips = outfitsData.stylingTips || [];

    html += `<h3 style="font-size:1.1rem;font-weight:700;color:var(--navy);margin:24px 0 12px;">Outfit Recommendations</h3>`;

    html += `<div class="outfits-grid">`;
    html += outfits.map(outfit => {
      const usedItems = (outfit.itemIndices || []).map(idx => traveler.items[idx - 1]).filter(Boolean);
      const thumbsHtml = usedItems.map(item =>
        item
          ? `<img class="outfit-item-thumb" src="${item.imageData}" alt="${item.analysis ? item.analysis.type : 'item'}" title="${item.analysis ? item.analysis.type : ''}" />`
          : `<div class="outfit-item-thumb-placeholder">👕</div>`
      ).join('');

      return `
        <div class="outfit-card">
          <div class="outfit-card-header">
            <div>
              <div class="outfit-name">${outfit.name}</div>
              <div class="outfit-occasion">${outfit.occasion}</div>
            </div>
            <div class="weather-badge">${outfit.weatherBadge || ''}</div>
          </div>
          <div class="outfit-card-body">
            ${thumbsHtml ? `<div class="outfit-items-row">${thumbsHtml}</div>` : ''}
            <p class="outfit-description">${outfit.description || ''}</p>
          </div>
        </div>`;
    }).join('');
    html += `</div>`;

    if (stylingTips.length) {
      html += `
      <div class="styling-tips-section">
        <h3>Styling Tips</h3>
        <ul class="tips-list">
          ${stylingTips.map(t => `<li><span class="tip-icon">✨</span>${t}</li>`).join('')}
        </ul>
      </div>`;
    }
  }

  container.innerHTML = html;
}

// ===== Step 6: Final Report =====
function renderFinalReport() {
  const container = document.getElementById('report-content');
  const p = state.tripParams;
  const guide = state.packingGuide;

  let html = `
    <div class="report-section">
      <h3>Trip Details</h3>
      <table class="report-details-table">
        <tr><td>Destination</td><td>${p.destination}</td></tr>
        ${p.startDate && p.endDate ? `<tr><td>Travel Dates</td><td>${new Date(p.startDate + 'T00:00:00').toLocaleDateString('en-US', {month:'long',day:'numeric',year:'numeric'})} – ${new Date(p.endDate + 'T00:00:00').toLocaleDateString('en-US', {month:'long',day:'numeric',year:'numeric'})}</td></tr>` : ''}
        <tr><td>Duration</td><td>${p.duration} days</td></tr>
        <tr><td>Season</td><td>${p.season}</td></tr>
        <tr><td>Activities</td><td>${p.interests.join(', ')}</td></tr>
        ${p.accommodation ? `<tr><td>Accommodation</td><td>${p.accommodation}</td></tr>` : ''}
        <tr><td>Laundromat</td><td>${p.hasLaundromat ? 'Yes' : 'No'}</td></tr>
        ${p.transportMode ? `<tr><td>Transportation</td><td>${p.transportMode === 'flying' ? '✈️ Flying' : p.transportMode === 'train' ? '🚆 Train' : '🚗 Driving'}${p.transportDetails.airport ? ` from ${p.transportDetails.airport}` : ''}${p.transportDetails.station ? ` from ${p.transportDetails.station}` : ''}${p.transportDetails.departureCity ? ` from ${p.transportDetails.departureCity}` : ''}${p.transportDetails.departureTime ? ` at ${p.transportDetails.departureTime}` : ''}</td></tr>` : ''}
        <tr><td>Travelers</td><td>${state.activeTravelers.map(k => TRAVELER_DEFS[k].label).join(', ')}</td></tr>
      </table>
    </div>
  `;

  if (guide) {
    html += `
      <div class="report-section">
        <h3>${guide.climateIcon || '🌤️'} Climate: ${guide.climate || ''}</h3>
        <p>${guide.climateSummary || ''}</p>
      </div>
    `;

    if (guide.localRecommendations) {
      const lr = guide.localRecommendations;
      html += `
        <div class="report-section">
          <h3>📍 Local Recommendations near ${p.destination}</h3>
          <div class="local-recs-grid">
            ${lr.grocery && lr.grocery.length ? `
            <div class="local-rec-card">
              <div class="local-rec-icon">🛒</div>
              <div class="local-rec-body">
                <h4>Grocery Stores</h4>
                <ul>${lr.grocery.map(r => `<li>${r}</li>`).join('')}</ul>
              </div>
            </div>` : ''}
            ${lr.pharmacy && lr.pharmacy.length ? `
            <div class="local-rec-card">
              <div class="local-rec-icon">💊</div>
              <div class="local-rec-body">
                <h4>Pharmacies</h4>
                <ul>${lr.pharmacy.map(r => `<li>${r}</li>`).join('')}</ul>
              </div>
            </div>` : ''}
            ${lr.clothing && lr.clothing.length ? `
            <div class="local-rec-card">
              <div class="local-rec-icon">👗</div>
              <div class="local-rec-body">
                <h4>Clothing Stores</h4>
                <ul>${lr.clothing.map(r => `<li>${r}</li>`).join('')}</ul>
              </div>
            </div>` : ''}
            ${lr.restaurants && lr.restaurants.length ? `
            <div class="local-rec-card">
              <div class="local-rec-icon">🍽️</div>
              <div class="local-rec-body">
                <h4>Restaurants & Dining</h4>
                <ul>${lr.restaurants.map(r => `<li>${r}</li>`).join('')}</ul>
              </div>
            </div>` : ''}
          </div>
        </div>
      `;
    }
  }

  for (const key of state.activeTravelers) {
    const def = TRAVELER_DEFS[key];
    const traveler = getTraveler(key);
    const analysis = traveler.packingAnalysis;
    const outfitsData = traveler.outfits;

    html += `<div class="report-traveler-section">`;
    html += `<h3>${def.icon} ${def.label}</h3>`;
    html += `<p><strong>Gender:</strong> ${traveler.gender || 'N/A'} &nbsp; <strong>Luggage:</strong> ${(traveler.luggageSizes || []).join(', ') || 'N/A'}</p>`;

    // Packing guide sections from AI guide
    if (guide) {
      const guideEntry = (guide.travelerGuides || []).find(g => g.travelerLabel === def.label);
      if (guideEntry) {
        html += `<div class="report-packing-sections">`;
        if (guideEntry.clothingEssentials && guideEntry.clothingEssentials.length) {
          html += `<h4>👕 Clothing Essentials</h4><ul>${guideEntry.clothingEssentials.map(i => `<li>${i}</li>`).join('')}</ul>`;
        } else if (guideEntry.essentials && guideEntry.essentials.length) {
          html += `<h4>✓ Essentials</h4><ul>${guideEntry.essentials.map(i => `<li>${i}</li>`).join('')}</ul>`;
        }
        if (guideEntry.travelEssentials && guideEntry.travelEssentials.length) {
          html += `<h4>🎒 Travel Essentials</h4><ul>${guideEntry.travelEssentials.map(i => `<li>${i}</li>`).join('')}</ul>`;
        }
        if (guideEntry.toiletryEssentials && guideEntry.toiletryEssentials.length) {
          html += `<h4>🧴 Toiletry Essentials</h4><ul>${guideEntry.toiletryEssentials.map(i => `<li>${i}</li>`).join('')}</ul>`;
        }
        html += `</div>`;
      }
    }

    // Item photos
    if (traveler.items.length > 0) {
      html += `<div class="report-items-grid">`;
      html += traveler.items.map(item => `
        <div class="report-item">
          <img src="${item.imageData}" alt="${item.analysis ? item.analysis.type : 'item'}" />
          <span>${item.analysis ? item.analysis.type : 'Item'}</span>
        </div>
      `).join('');
      html += `</div>`;
    }

    if (analysis) {
      html += `
        <div class="report-analysis">
          <span class="report-score" style="background:${getScoreColor(analysis.coverageScore)}">${analysis.coverageScore}%</span>
          <span>${analysis.summary || ''}</span>
        </div>
      `;

      const missing = analysis.missing || [];
      if (missing.length) {
        html += `<h4>Missing Items</h4><ul>`;
        html += missing.map(m => `<li><strong>[${m.priority}]</strong> ${m.item} — ${m.reason}</li>`).join('');
        html += `</ul>`;
      }
    }

    if (outfitsData) {
      const outfits = outfitsData.outfits || [];
      html += `<h4>Outfit Recommendations</h4>`;
      for (const outfit of outfits) {
        const usedItems = (outfit.itemIndices || []).map(idx => traveler.items[idx - 1]).filter(Boolean);
        html += `
          <div class="report-outfit">
            <h5>${outfit.name} ${outfit.weatherBadge ? `(${outfit.weatherBadge})` : ''}</h5>
            <p><em>${outfit.occasion || ''}</em></p>
            ${usedItems.length ? `<div class="report-outfit-thumbs">${usedItems.map(item =>
              `<img src="${item.imageData}" alt="${item.analysis ? item.analysis.type : ''}" title="${item.analysis ? item.analysis.type : ''}" />`
            ).join('')}</div>` : ''}
            <p>${outfit.description || ''}</p>
          </div>
        `;
      }
    }

    html += `</div>`;
  }

  container.innerHTML = html;
  loadSavedTrips();
}

// ===== Print Report =====
function printReport() {
  const reportContent = document.getElementById('report-content');
  if (!reportContent || !reportContent.innerHTML.trim()) {
    showToast('Please complete all steps first.', true);
    return;
  }
  document.getElementById('print-report').innerHTML = `<h1>PackSmart — Trip Report</h1>` + reportContent.innerHTML;
  window.print();
}

// ===== Save / Load Trips =====
function saveTrip() {
  const tripName = `${state.tripParams.destination} - ${state.tripParams.season} (${new Date().toLocaleDateString()})`;

  const saveData = {
    name: tripName,
    savedAt: new Date().toISOString(),
    tripParams: state.tripParams,
    activeTravelers: state.activeTravelers,
    travelers: {},
    packingGuide: state.packingGuide,
  };

  for (const key of state.activeTravelers) {
    const t = getTraveler(key);
    saveData.travelers[key] = {
      gender: t.gender,
      luggageSizes: t.luggageSizes || [],
      items: t.items.map(item => ({
        id: item.id,
        imageData: item.imageData,
        analysis: item.analysis,
      })),
      packingAnalysis: t.packingAnalysis,
      outfits: t.outfits,
    };
  }

  const saved = JSON.parse(localStorage.getItem('packsmart_trips') || '[]');
  saved.unshift(saveData);
  if (saved.length > 10) saved.length = 10;

  try {
    localStorage.setItem('packsmart_trips', JSON.stringify(saved));
    showToast('Trip saved! You can load it later from the Report page.');
    loadSavedTrips();
  } catch (e) {
    showToast('Could not save — storage may be full.', true);
  }
}

function loadSavedTrips() {
  const saved = JSON.parse(localStorage.getItem('packsmart_trips') || '[]');
  const section = document.getElementById('saved-trips-section');
  const list = document.getElementById('saved-trips-list');

  if (saved.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = saved.map((trip, i) => `
    <div class="saved-trip-card">
      <div class="saved-trip-info">
        <div class="saved-trip-name">${trip.name}</div>
        <div class="saved-trip-date">Saved ${new Date(trip.savedAt).toLocaleDateString()}</div>
      </div>
      <div class="saved-trip-actions">
        <button class="btn-outline" onclick="app.loadTrip(${i})">Load</button>
        <button class="btn-secondary" onclick="app.deleteTrip(${i})" style="padding:8px 14px;font-size:0.8rem;">✕</button>
      </div>
    </div>
  `).join('');
}

function loadTrip(index) {
  const saved = JSON.parse(localStorage.getItem('packsmart_trips') || '[]');
  const trip = saved[index];
  if (!trip) return;

  state.tripParams = trip.tripParams;
  state.activeTravelers = trip.activeTravelers;
  state.packingGuide = trip.packingGuide;

  for (const key of trip.activeTravelers) {
    state.travelers[key] = trip.travelers[key];
    // Migrate old saved trips that stored luggageSize as a string
    const t = state.travelers[key];
    if (!Array.isArray(t.luggageSizes)) {
      t.luggageSizes = t.luggageSize ? [t.luggageSize] : [];
      delete t.luggageSize;
    }
  }

  // Restore max item ID
  let maxId = 0;
  for (const key of trip.activeTravelers) {
    for (const item of (state.travelers[key].items || [])) {
      if (item.id > maxId) maxId = item.id;
    }
  }
  itemIdCounter = maxId;

  // Restore form fields
  document.getElementById('destination').value = state.tripParams.destination;
  document.getElementById('duration').value = state.tripParams.duration;
  document.getElementById('start-date').value = state.tripParams.startDate || '';
  document.getElementById('end-date').value = state.tripParams.endDate || '';
  document.getElementById('season').value = state.tripParams.season;
  document.getElementById('accommodation').value = state.tripParams.accommodation || '';
  // Restore multi-location UI
  if (state.tripParams.multiLocation) {
    setMultiLocation(true);
    renderMultiLocationSection();
    // Re-populate location fields
    state.tripParams.locations.forEach((loc, i) => {
      const destEl = document.querySelector(`.loc-destination[data-idx="${i}"]`);
      const startEl = document.querySelector(`.loc-start[data-idx="${i}"]`);
      const endEl = document.querySelector(`.loc-end[data-idx="${i}"]`);
      if (destEl) destEl.value = loc.destination;
      if (startEl) startEl.value = loc.startDate;
      if (endEl) endEl.value = loc.endDate;
    });
  } else {
    setMultiLocation(false);
  }
  document.getElementById('laundromat').checked = state.tripParams.hasLaundromat;
  document.getElementById('laundromat-label').textContent = state.tripParams.hasLaundromat ? 'Yes' : 'No';

  document.querySelectorAll('#interests-grid input').forEach(el => {
    el.checked = state.tripParams.interests.includes(el.value);
    el.closest('.pill').classList.toggle('selected', el.checked);
  });

  if (state.tripParams.transportMode) {
    const radio = document.querySelector(`input[name="transport"][value="${state.tripParams.transportMode}"]`);
    if (radio) radio.checked = true;
    setTransportMode(state.tripParams.transportMode);
    const d = state.tripParams.transportDetails || {};
    if (d.airport) document.getElementById('departure-airport').value = d.airport;
    if (d.station) document.getElementById('departure-station').value = d.station;
    if (d.departureCity) document.getElementById('departure-city').value = d.departureCity;
    if (d.departureTime) {
      const timeInput = document.querySelector('#transport-details input[type="time"]');
      if (timeInput) timeInput.value = d.departureTime;
    }
  }

  // Restore traveler toggles
  document.querySelectorAll('.traveler-toggle-card').forEach(card => {
    const key = card.dataset.traveler;
    if (key === 'self') return;
    const isActive = state.activeTravelers.includes(key);
    card.classList.toggle('selected', isActive);
    const input = card.querySelector('input');
    if (input) input.checked = isActive;
  });

  renderTravelerDetailSections();

  // Jump to the report step if data is complete, otherwise wardrobe
  if (state.activeTravelers.every(k => getTraveler(k).outfits)) {
    state.currentStep = 6;
    renderFinalReport();
    renderStep(6);
  } else {
    state.currentStep = 4;
    renderWardrobeTabs();
    renderStep(4);
  }

  showToast('Trip loaded!');
}

function deleteTrip(index) {
  const saved = JSON.parse(localStorage.getItem('packsmart_trips') || '[]');
  saved.splice(index, 1);
  localStorage.setItem('packsmart_trips', JSON.stringify(saved));
  loadSavedTrips();
  showToast('Saved trip deleted.');
}

// ===== Start Over =====
function startOver() {
  state.currentStep = 1;
  state.tripParams = { destination: '', duration: 0, startDate: '', endDate: '', season: '', accommodation: '', interests: [], hasLaundromat: false, multiLocation: false, locations: [{ destination: '', startDate: '', endDate: '' }, { destination: '', startDate: '', endDate: '' }, { destination: '', startDate: '', endDate: '' }], transportMode: '', transportDetails: {} };
  setMultiLocation(false);
  state.activeTravelers = ['self'];
  state.travelers = { self: { gender: '', luggageSizes: [], items: [], wardrobeChoice: '', packingAnalysis: null, outfits: null } };
  state.feedback = { ease: 0, satisfaction: 0, recommend: 0, commentEase: '', commentSatisfaction: '', commentRecommend: '' };
  state.packingGuide = null;
  state.activeWardrobeTab = 'self';
  state.activeOutfitsTab = 'self';
  itemIdCounter = 0;

  document.getElementById('destination').value = '';
  document.getElementById('duration').value = '';
  document.getElementById('start-date').value = '';
  document.getElementById('end-date').value = '';
  document.getElementById('season').value = '';
  document.getElementById('accommodation').value = '';
  document.getElementById('laundromat').checked = false;
  document.getElementById('laundromat-label').textContent = 'No';
  document.querySelectorAll('#interests-grid input').forEach(el => { el.checked = false; el.closest('.pill').classList.remove('selected'); });
  document.querySelectorAll('.transport-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('input[name="transport"]').forEach(el => el.checked = false);
  document.getElementById('transport-details').style.display = 'none';
  document.getElementById('transport-details').innerHTML = '';

  document.querySelectorAll('.traveler-toggle-card').forEach(card => {
    const key = card.dataset.traveler;
    if (key === 'self') return;
    card.classList.remove('selected');
    const input = card.querySelector('input');
    if (input) input.checked = false;
  });

  document.getElementById('traveler-detail-sections').innerHTML = '';
  document.getElementById('packing-guide-content').innerHTML = `<div class="empty-state"><div class="empty-icon">🌤️</div><p>Your packing guide will appear here.</p></div>`;
  document.getElementById('wardrobe-tabs').innerHTML = '';
  document.getElementById('wardrobe-tab-content').innerHTML = '';
  document.getElementById('outfits-tabs').innerHTML = '';
  document.getElementById('outfits-tab-content').innerHTML = '';
  document.getElementById('report-content').innerHTML = '';

  renderTravelerDetailSections();
  renderStep(1);
}

// ===== UI Interactivity =====
function initUI() {
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pill.classList.toggle('selected', pill.querySelector('input').checked);
    });
  });

  document.getElementById('laundromat').addEventListener('change', function () {
    document.getElementById('laundromat-label').textContent = this.checked ? 'Yes' : 'No';
  });

  function syncDatesAndDuration() {
    const startVal = document.getElementById('start-date').value;
    const endVal = document.getElementById('end-date').value;
    if (startVal && endVal) {
      const start = new Date(startVal);
      const end = new Date(endVal);
      if (end >= start) {
        const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        document.getElementById('duration').value = days;

        const month = start.getMonth();
        const seasons = ['Winter','Winter','Spring','Spring','Spring','Summer','Summer','Summer','Autumn','Autumn','Autumn','Winter'];
        document.getElementById('season').value = seasons[month];
      }
    }
  }

  document.getElementById('start-date').addEventListener('change', syncDatesAndDuration);
  document.getElementById('end-date').addEventListener('change', syncDatesAndDuration);

  renderTravelerDetailSections();
  loadSavedTrips();
}

// ===== Calendar Reminders =====
function toggleCalendarMenu() {
  const menu = document.getElementById('calendar-menu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function addCalendarReminders(provider) {
  document.getElementById('calendar-menu').style.display = 'none';

  const p = state.tripParams;
  if (!p.startDate) {
    showToast('Please set travel dates to add calendar reminders.', true);
    return;
  }

  const startDate = new Date(p.startDate + 'T09:00:00');
  const dest = p.destination || 'Trip';

  const threeDaysBefore = new Date(startDate);
  threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);

  const oneDayBefore = new Date(startDate);
  oneDayBefore.setDate(oneDayBefore.getDate() - 1);

  const organizeTitle = `PackSmart: Start Organizing for ${dest}`;
  const organizeBody = `Your trip to ${dest} is in 3 days! Time to start organizing and gathering your items. Open PackSmart to review your packing guide.`;

  const packTitle = `PackSmart: Start Packing for ${dest}`;
  const packBody = `Your trip to ${dest} is tomorrow! Time to pack your bags. Open PackSmart to review your outfit recommendations and checklist.`;

  if (provider === 'google') {
    function formatGCalDate(d) {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }
    function makeGCalUrl(title, description, date) {
      const end = new Date(date);
      end.setHours(end.getHours() + 1);
      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        details: description,
        dates: `${formatGCalDate(date)}/${formatGCalDate(end)}`,
      });
      return `https://calendar.google.com/calendar/render?${params.toString()}`;
    }
    window.open(makeGCalUrl(organizeTitle, organizeBody, threeDaysBefore), '_blank');
    setTimeout(() => {
      window.open(makeGCalUrl(packTitle, packBody, oneDayBefore), '_blank');
    }, 1500);
  } else if (provider === 'outlook') {
    function formatOutlookDate(d) {
      return d.toISOString().split('.')[0] + '+00:00';
    }
    function makeOutlookUrl(title, description, date) {
      const end = new Date(date);
      end.setHours(end.getHours() + 1);
      const params = new URLSearchParams({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: title,
        body: description,
        startdt: formatOutlookDate(date),
        enddt: formatOutlookDate(end),
      });
      return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
    }
    window.open(makeOutlookUrl(organizeTitle, organizeBody, threeDaysBefore), '_blank');
    setTimeout(() => {
      window.open(makeOutlookUrl(packTitle, packBody, oneDayBefore), '_blank');
    }, 1500);
  }

  showToast(`${provider === 'google' ? 'Google Calendar' : 'Outlook'} events opening — save them to get reminders!`);
}

// ===== Feedback =====
function initFeedbackForm() {
  const categories = ['ease', 'satisfaction', 'recommend'];
  const idMap = { ease: 'rating-ease', satisfaction: 'rating-satisfaction', recommend: 'rating-recommend' };

  // Show form, hide submitted message
  const formContainer = document.getElementById('feedback-form-container');
  const submittedMsg = document.getElementById('feedback-submitted');
  const submitBtn = document.getElementById('submit-feedback-btn');
  const newTripBtn = document.getElementById('new-trip-after-feedback-btn');
  if (formContainer) formContainer.style.display = 'block';
  if (submittedMsg) submittedMsg.style.display = 'none';
  if (submitBtn) submitBtn.style.display = 'inline-flex';
  if (newTripBtn) newTripBtn.style.display = 'none';

  categories.forEach(cat => {
    const container = document.getElementById(idMap[cat]);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 1; i <= 7; i++) {
      const btn = document.createElement('button');
      btn.className = 'rating-btn' + (state.feedback[cat] === i ? ' selected' : '');
      btn.textContent = i;
      btn.onclick = () => {
        state.feedback[cat] = i;
        container.querySelectorAll('.rating-btn').forEach((b, idx) => {
          b.classList.toggle('selected', idx + 1 === i);
        });
      };
      container.appendChild(btn);
    }
  });
}

async function submitFeedback() {
  state.feedback.commentEase = document.getElementById('comment-ease')?.value || '';
  state.feedback.commentSatisfaction = document.getElementById('comment-satisfaction')?.value || '';
  state.feedback.commentRecommend = document.getElementById('comment-recommend')?.value || '';

  if (!state.feedback.ease || !state.feedback.satisfaction || !state.feedback.recommend) {
    showToast('Please select a rating for each question.', true);
    return;
  }

  const submitBtn = document.getElementById('submit-feedback-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

  try {
    await apiPost('/api/submit-feedback', {
      ease: state.feedback.ease,
      satisfaction: state.feedback.satisfaction,
      recommend: state.feedback.recommend,
      commentEase: state.feedback.commentEase,
      commentSatisfaction: state.feedback.commentSatisfaction,
      commentRecommend: state.feedback.commentRecommend,
      destination: state.tripParams.destination,
    });
  } catch (e) {
    showToast('Could not save feedback to server — please try again.', true);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Feedback'; }
    return;
  }

  const formContainer = document.getElementById('feedback-form-container');
  const submittedMsg = document.getElementById('feedback-submitted');
  const newTripBtn = document.getElementById('new-trip-after-feedback-btn');
  if (formContainer) formContainer.style.display = 'none';
  if (submittedMsg) submittedMsg.style.display = 'block';
  if (submitBtn) submitBtn.style.display = 'none';
  if (newTripBtn) newTripBtn.style.display = 'inline-flex';
}

// ===== Public app interface =====
const app = {
  goToStep,
  handleFileInput,
  deleteItem,
  startOver,
  printReport,
  printPackingGuide,
  saveTrip,
  loadTrip,
  deleteTrip,
  toggleTraveler,
  setTravelerGender,
  setTravelerLuggage,
  setTransportMode,
  updateTransportDetail,
  handleAirportInput,
  selectAirport,
  addCalendarReminders,
  toggleCalendarMenu,
  switchWardrobeTab,
  switchOutfitsTab,
  setWardrobeChoice,
  submitFeedback,
  setMultiLocation,
  updateLocation,
  syncDestinationToLocation1,
};

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initUI();
});
