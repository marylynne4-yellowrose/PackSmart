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
    climate: '',
    season: '',
    interests: [],
    hasLaundromat: false,
  },
  activeTravelers: ['self'],
  travelers: {
    self: { luggageSize: '', items: [], packingAnalysis: null, outfits: null },
  },
  activeWardrobeTab: 'self',
  activeAnalysisTab: 'self',
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
    state.travelers[key] = { luggageSize: '', items: [], packingAnalysis: null, outfits: null };
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
  renderTravelerLuggageSections();
}

function renderTravelerLuggageSections() {
  const container = document.getElementById('traveler-luggage-sections');
  container.innerHTML = state.activeTravelers.map(key => {
    const def = TRAVELER_DEFS[key];
    const traveler = getTraveler(key);
    const isPet = key === 'pet';

    const luggageOptions = isPet
      ? [
          { value: 'Small Carrier', icon: '🐾', name: 'Small Carrier', desc: 'Cat / small dog' },
          { value: 'Medium Carrier', icon: '🐕', name: 'Medium Carrier', desc: 'Medium dog' },
          { value: 'Large Carrier', icon: '🦮', name: 'Large Carrier', desc: 'Large dog' },
        ]
      : [
          { value: 'Carry-on', icon: '🎒', name: 'Carry-on', desc: '≈ 20L' },
          { value: 'Small',    icon: '🧳', name: 'Small',    desc: '≈ 35L' },
          { value: 'Medium',   icon: '🧳', name: 'Medium',   desc: '≈ 55L' },
          { value: 'Large',    icon: '🧳', name: 'Large',    desc: '≈ 75L' },
          { value: 'Extra Large', icon: '🧳', name: 'Extra Large', desc: '≈ 100L+' },
        ];

    return `
      <div class="traveler-luggage-section">
        <h3 class="traveler-luggage-heading">${def.icon} ${def.label} — Luggage Size</h3>
        <div class="luggage-grid">
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
    if (step === 4 && state.currentStep === 3) {
      await runPackingAnalysisAll();
    }
    if (step === 5 && state.currentStep === 4) {
      await runOutfitPlanningAll();
    }
  }
  state.currentStep = step;

  if (step === 3) renderWardrobeTabs();
  if (step === 4) renderAnalysisTabs();
  if (step === 5) renderOutfitsTabs();

  renderStep(step);
}

function validateStep(step) {
  if (step === 1) {
    const p = collectTripParams(true);
    if (!p.destination.trim()) { showToast('Please enter a destination.', true); return false; }
    if (!p.duration || p.duration < 1) { showToast('Please enter trip duration.', true); return false; }
    if (!p.climate) { showToast('Please select a climate.', true); return false; }
    if (!p.season) { showToast('Please select a season.', true); return false; }
    if (p.interests.length === 0) { showToast('Please select at least one interest.', true); return false; }
  }
  if (step === 2) {
    for (const key of state.activeTravelers) {
      const t = getTraveler(key);
      if (!t.luggageSize) {
        showToast(`Please select a luggage size for ${TRAVELER_DEFS[key].label}.`, true);
        return false;
      }
    }
  }
  if (step === 3) {
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
    climate: document.getElementById('climate').value,
    season: document.getElementById('season').value,
    interests: [...document.querySelectorAll('#interests-grid input:checked')].map(el => el.value),
    hasLaundromat: document.getElementById('laundromat').checked,
  };
  if (!peek) Object.assign(state.tripParams, p);
  return p;
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

// ===== Step 3: Wardrobe (per-traveler) =====
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

// ===== Step 4: Packing Analysis (per-traveler) =====
async function runPackingAnalysisAll() {
  showLoading('Analyzing packing lists…');
  try {
    for (const key of state.activeTravelers) {
      const traveler = getTraveler(key);
      const itemAnalyses = traveler.items.map(i => i.analysis);
      const result = await apiPost('/api/analyze-packing', {
        items: itemAnalyses,
        tripParams: { ...state.tripParams, luggageSize: traveler.luggageSize },
        travelerLabel: TRAVELER_DEFS[key].label,
      });
      traveler.packingAnalysis = result;
    }
  } catch (e) {
    showToast(`Analysis failed: ${e.message}`, true);
    throw e;
  } finally {
    hideLoading();
  }
}

function renderAnalysisTabs() {
  if (!state.activeTravelers.includes(state.activeAnalysisTab)) {
    state.activeAnalysisTab = state.activeTravelers[0];
  }
  renderTravelerTabBar('analysis-tabs', state.activeAnalysisTab, 'app.switchAnalysisTab');
  renderAnalysisContent(state.activeAnalysisTab);
}

function switchAnalysisTab(key) {
  state.activeAnalysisTab = key;
  renderTravelerTabBar('analysis-tabs', key, 'app.switchAnalysisTab');
  renderAnalysisContent(key);
}

function renderAnalysisContent(travelerKey) {
  const container = document.getElementById('analysis-tab-content');
  const traveler = getTraveler(travelerKey);
  const data = traveler.packingAnalysis;

  if (!data) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>No analysis available yet.</p></div>`;
    return;
  }

  const missing = (data.missing || []);
  const excessive = (data.excessive || []);
  const tips = (data.tips || []);

  container.innerHTML = `
    <div class="analysis-score-wrap">
      <div class="score-circle" style="background:${getScoreColor(data.coverageScore)}">
        ${data.coverageScore}%
      </div>
      <div class="score-summary">
        <h3>Packing Coverage Score</h3>
        <p>${data.summary || ''}</p>
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

    ${data.accessories ? `
    <div class="analysis-section">
      <h3>Accessories</h3>
      <p style="font-size:0.88rem;color:var(--text-muted)">${data.accessories}</p>
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

function getScoreColor(score) {
  if (score >= 75) return '#27ae60';
  if (score >= 50) return '#f39c12';
  return '#e74c3c';
}

// ===== Step 5: Outfit Planner (per-traveler) =====
async function runOutfitPlanningAll() {
  showLoading('Generating outfit recommendations…');
  try {
    for (const key of state.activeTravelers) {
      const traveler = getTraveler(key);
      const itemAnalyses = traveler.items.map(i => i.analysis);
      const result = await apiPost('/api/get-outfits', {
        items: itemAnalyses,
        tripParams: { ...state.tripParams, luggageSize: traveler.luggageSize },
        travelerLabel: TRAVELER_DEFS[key].label,
      });
      traveler.outfits = result;
    }
  } catch (e) {
    showToast(`Outfit planning failed: ${e.message}`, true);
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

function renderOutfitsContent(travelerKey) {
  const container = document.getElementById('outfits-tab-content');
  const traveler = getTraveler(travelerKey);
  const data = traveler.outfits;

  if (!data) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">👗</div><p>No outfit plans available yet.</p></div>`;
    return;
  }

  const outfits = data.outfits || [];
  const tips = data.stylingTips || [];

  container.innerHTML = `
    <div class="outfits-grid">
      ${outfits.map(outfit => {
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
      }).join('')}
    </div>

    ${tips.length ? `
    <div class="styling-tips-section">
      <h3>Styling Tips</h3>
      <ul class="tips-list">
        ${tips.map(t => `<li><span class="tip-icon">✨</span>${t}</li>`).join('')}
      </ul>
    </div>` : ''}
  `;
}

// ===== Printable Report =====
function downloadReport() {
  const hasData = state.activeTravelers.some(k => getTraveler(k).packingAnalysis && getTraveler(k).outfits);
  if (!hasData) {
    showToast('Please complete the analysis and outfit steps first.', true);
    return;
  }

  const p = state.tripParams;

  let html = `
    <h1>PackSmart — Trip Report</h1>
    <h2>Trip Details</h2>
    <table class="report-table">
      <tr><td>Destination</td><td>${p.destination}</td></tr>
      <tr><td>Duration</td><td>${p.duration} days</td></tr>
      <tr><td>Climate</td><td>${p.climate}</td></tr>
      <tr><td>Season</td><td>${p.season}</td></tr>
      <tr><td>Activities</td><td>${p.interests.join(', ')}</td></tr>
      <tr><td>Laundromat Access</td><td>${p.hasLaundromat ? 'Yes' : 'No'}</td></tr>
      <tr><td>Travelers</td><td>${state.activeTravelers.map(k => TRAVELER_DEFS[k].label).join(', ')}</td></tr>
    </table>
  `;

  for (const key of state.activeTravelers) {
    const def = TRAVELER_DEFS[key];
    const traveler = getTraveler(key);
    const data = traveler.packingAnalysis;
    const outfitsData = traveler.outfits;

    html += `<h2>${def.icon} ${def.label}</h2>`;
    html += `<p><strong>Luggage:</strong> ${traveler.luggageSize}</p>`;

    if (data) {
      const missing = data.missing || [];
      const excessive = data.excessive || [];
      const tips = data.tips || [];

      html += `
        <h3>Packing Analysis</h3>
        <p><strong>Coverage Score:</strong> ${data.coverageScore}%</p>
        <p>${data.summary || ''}</p>

        ${missing.length ? `
        <h4>Missing Items</h4>
        <ul>
          ${missing.map(m => `<li><strong>[${m.priority || 'optional'}]</strong> ${m.item} — ${m.reason}</li>`).join('')}
        </ul>` : ''}

        ${excessive.length ? `
        <h4>Potentially Excessive</h4>
        <ul>
          ${excessive.map(e => `<li>${e.item} — ${e.reason}</li>`).join('')}
        </ul>` : ''}

        ${data.accessories ? `<h4>Accessories</h4><p>${data.accessories}</p>` : ''}

        ${tips.length ? `
        <h4>Packing Tips</h4>
        <ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
      `;
    }

    if (outfitsData) {
      const outfits = outfitsData.outfits || [];
      const stylingTips = outfitsData.stylingTips || [];

      html += `<h3>Outfit Plans</h3>`;
      html += outfits.map(outfit => `
        <div class="report-outfit">
          <h4>${outfit.name} ${outfit.weatherBadge ? `(${outfit.weatherBadge})` : ''}</h4>
          <p><em>${outfit.occasion || ''}</em></p>
          <p>${outfit.description || ''}</p>
        </div>`).join('');

      if (stylingTips.length) {
        html += `
        <h4>Styling Tips</h4>
        <ul>${stylingTips.map(t => `<li>${t}</li>`).join('')}</ul>`;
      }
    }
  }

  document.getElementById('print-report').innerHTML = html;
  window.print();
}

// ===== Start Over =====
function startOver() {
  state.currentStep = 1;
  state.tripParams = { destination: '', duration: 0, climate: '', season: '', interests: [], hasLaundromat: false };
  state.activeTravelers = ['self'];
  state.travelers = { self: { luggageSize: '', items: [], packingAnalysis: null, outfits: null } };
  state.activeWardrobeTab = 'self';
  state.activeAnalysisTab = 'self';
  state.activeOutfitsTab = 'self';
  itemIdCounter = 0;

  document.getElementById('destination').value = '';
  document.getElementById('duration').value = '';
  document.getElementById('climate').value = '';
  document.getElementById('season').value = '';
  document.getElementById('laundromat').checked = false;
  document.getElementById('laundromat-label').textContent = 'No';
  document.querySelectorAll('#interests-grid input').forEach(el => { el.checked = false; el.closest('.pill').classList.remove('selected'); });

  // Reset traveler toggles
  document.querySelectorAll('.traveler-toggle-card').forEach(card => {
    const key = card.dataset.traveler;
    if (key === 'self') return;
    card.classList.remove('selected');
    const input = card.querySelector('input');
    if (input) input.checked = false;
  });

  document.getElementById('traveler-luggage-sections').innerHTML = '';
  document.getElementById('wardrobe-tabs').innerHTML = '';
  document.getElementById('wardrobe-tab-content').innerHTML = '';
  document.getElementById('analysis-tabs').innerHTML = '';
  document.getElementById('analysis-tab-content').innerHTML = '';
  document.getElementById('outfits-tabs').innerHTML = '';
  document.getElementById('outfits-tab-content').innerHTML = '';

  renderTravelerLuggageSections();
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

  renderTravelerLuggageSections();
}

// ===== Public app interface =====
const app = {
  goToStep,
  handleFileInput,
  deleteItem,
  startOver,
  downloadReport,
  toggleTraveler,
  setTravelerLuggage,
  switchWardrobeTab,
  switchAnalysisTab,
  switchOutfitsTab,
};

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initUI();
});
