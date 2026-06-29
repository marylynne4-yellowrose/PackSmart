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
    interests: [],
    hasLaundromat: false,
    transportMode: '',
    transportDetails: {},
  },
  activeTravelers: ['self'],
  travelers: {
    self: { gender: '', luggageSize: '', items: [], packingAnalysis: null, outfits: null },
  },
  packingGuide: null,
  activeWardrobeTab: 'self',
  activeOutfitsTab: 'self',
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
    state.travelers[key] = { gender: '', luggageSize: '', items: [], packingAnalysis: null, outfits: null };
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
        <label style="font-size:0.85rem;font-weight:600;">Luggage Size</label>
        <div class="luggage-grid" style="margin-top:6px;">
          ${luggageOptions.map(opt => `
            <label class="luggage-card ${traveler.luggageSize === opt.value ? 'selected' : ''}">
              <input type="radio" name="luggage-${key}" value="${opt.value}"
                ${traveler.luggageSize === opt.value ? 'checked' : ''}
                onchange="app.setTravelerLuggage('${key}', '${opt.value}')" />
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

function setTravelerLuggage(key, value) {
  getTraveler(key).luggageSize = value;
  const cards = document.querySelectorAll(`input[name="luggage-${key}"]`);
  cards.forEach(input => {
    const card = input.closest('.luggage-card');
    card.classList.toggle('selected', input.value === value);
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
  }
  if (step === 2) {
    for (const key of state.activeTravelers) {
      const t = getTraveler(key);
      if (key !== 'pet' && !t.gender) {
        showToast(`Please select a gender for ${TRAVELER_DEFS[key].label}.`, true);
        return false;
      }
      if (!t.luggageSize) {
        showToast(`Please select a luggage size for ${TRAVELER_DEFS[key].label}.`, true);
        return false;
      }
    }
  }
  if (step === 4) {
    for (const key of state.activeTravelers) {
      const t = getTraveler(key);
      if (t.items.length === 0) {
        showToast(`Please add at least one item for ${TRAVELER_DEFS[key].label}.`, true);
        return false;
      }
      if (t.items.some(i => !i.analysis)) {
        showToast(`Please wait for all items to finish analyzing for ${TRAVELER_DEFS[key].label}.`, true);
        return false;
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
    interests: [...document.querySelectorAll('#interests-grid input:checked')].map(el => el.value),
    hasLaundromat: document.getElementById('laundromat').checked,
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
            oninput="app.updateTransportDetail('airport', this.value)" />
        </div>
        <div class="form-group">
          <label for="flight-time">Approximate Departure Time <span class="label-hint">(hour:minute AM or PM)</span></label>
          <input type="text" id="flight-time" placeholder="e.g. 7:30 AM"
            oninput="app.updateTransportDetail('departureTime', this.value)" />
        </div>
      </div>
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
        luggageSize: t.luggageSize,
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

function renderPackingGuide(data) {
  const container = document.getElementById('packing-guide-content');

  let html = `
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

    ${data.travelLogistics ? `
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
  `;

  const guides = data.travelerGuides || [];
  for (const guide of guides) {
    html += `
      <div class="traveler-guide-card">
        <h3 class="traveler-guide-heading">${guide.travelerLabel}</h3>
        ${guide.essentials ? `
        <div class="guide-section">
          <h4>Essentials to Pack</h4>
          <ul class="guide-list">
            ${guide.essentials.map(item => `<li><span class="guide-check">✓</span> ${item}</li>`).join('')}
          </ul>
        </div>` : ''}
        ${guide.recommended ? `
        <div class="guide-section">
          <h4>Recommended</h4>
          <ul class="guide-list">
            ${guide.recommended.map(item => `<li><span class="guide-dot">●</span> ${item}</li>`).join('')}
          </ul>
        </div>` : ''}
        ${guide.tips ? `
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

function renderWardrobeContent(travelerKey) {
  const container = document.getElementById('wardrobe-tab-content');
  const traveler = getTraveler(travelerKey);
  const def = TRAVELER_DEFS[travelerKey];
  const isPet = travelerKey === 'pet';
  const itemLabel = isPet ? 'pet items' : 'clothing items';

  let html = `
    <div class="wardrobe-for-traveler" data-traveler="${travelerKey}">
      <div class="add-item-buttons">
        <button class="btn-outline" onclick="document.getElementById('camera-input-${travelerKey}').click()">
          📷 Take Photo
        </button>
        <button class="btn-outline" onclick="document.getElementById('file-input-${travelerKey}').click()">
          📁 Upload Photo
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
  showLoading('Analyzing packing and generating outfit recommendations…');
  try {
    for (const key of state.activeTravelers) {
      const traveler = getTraveler(key);
      const itemAnalyses = traveler.items.map(i => i.analysis);
      const travelerParams = {
        ...state.tripParams,
        luggageSize: traveler.luggageSize,
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
  }

  for (const key of state.activeTravelers) {
    const def = TRAVELER_DEFS[key];
    const traveler = getTraveler(key);
    const analysis = traveler.packingAnalysis;
    const outfitsData = traveler.outfits;

    html += `<div class="report-traveler-section">`;
    html += `<h3>${def.icon} ${def.label}</h3>`;
    html += `<p><strong>Gender:</strong> ${traveler.gender || 'N/A'} &nbsp; <strong>Luggage:</strong> ${traveler.luggageSize}</p>`;

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
      luggageSize: t.luggageSize,
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
  state.tripParams = { destination: '', duration: 0, startDate: '', endDate: '', season: '', interests: [], hasLaundromat: false, transportMode: '', transportDetails: {} };
  state.activeTravelers = ['self'];
  state.travelers = { self: { gender: '', luggageSize: '', items: [], packingAnalysis: null, outfits: null } };
  state.packingGuide = null;
  state.activeWardrobeTab = 'self';
  state.activeOutfitsTab = 'self';
  itemIdCounter = 0;

  document.getElementById('destination').value = '';
  document.getElementById('duration').value = '';
  document.getElementById('start-date').value = '';
  document.getElementById('end-date').value = '';
  document.getElementById('season').value = '';
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
function addCalendarReminders() {
  const p = state.tripParams;
  if (!p.startDate) {
    showToast('Please set travel dates to add calendar reminders.', true);
    return;
  }

  const startDate = new Date(p.startDate + 'T00:00:00');
  const dest = p.destination || 'Trip';

  const threeDaysBefore = new Date(startDate);
  threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);

  const oneDayBefore = new Date(startDate);
  oneDayBefore.setDate(oneDayBefore.getDate() - 1);

  function formatGCalDate(d) {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  function makeGCalUrl(title, description, date) {
    const endDate = new Date(date);
    endDate.setHours(endDate.getHours() + 1);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      details: description,
      dates: `${formatGCalDate(date)}/${formatGCalDate(endDate)}`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  const organizeUrl = makeGCalUrl(
    `🧳 PackSmart: Start Organizing for ${dest}`,
    `Your trip to ${dest} is in 3 days! Time to start organizing and gathering your items. Open PackSmart to review your packing guide.`,
    threeDaysBefore
  );

  const packUrl = makeGCalUrl(
    `🧳 PackSmart: Start Packing for ${dest}`,
    `Your trip to ${dest} is tomorrow! Time to pack your bags. Open PackSmart to review your outfit recommendations and checklist.`,
    oneDayBefore
  );

  window.open(organizeUrl, '_blank');
  setTimeout(() => {
    window.open(packUrl, '_blank');
  }, 1500);

  showToast('Calendar events opening — save them to get reminders!');
}

// ===== Public app interface =====
const app = {
  goToStep,
  handleFileInput,
  deleteItem,
  startOver,
  printReport,
  saveTrip,
  loadTrip,
  deleteTrip,
  toggleTraveler,
  setTravelerGender,
  setTravelerLuggage,
  setTransportMode,
  updateTransportDetail,
  addCalendarReminders,
  switchWardrobeTab,
  switchOutfitsTab,
};

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initUI();
});
