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
    luggageSize: '',
  },
  items: [],   // [{ id, imageData, analysis }]
  packingAnalysis: null,
  outfits: null,
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

// ===== Step Navigation =====
async function goToStep(step) {
  if (step > state.currentStep) {
    if (!validateStep(state.currentStep)) return;
    if (state.currentStep === 1) collectTripParams();
    if (step === 3 && state.currentStep === 2) {
      await runPackingAnalysis();
    }
    if (step === 4 && state.currentStep === 3) {
      await runOutfitPlanning();
    }
  }
  state.currentStep = step;
  renderStep(step);
}

function validateStep(step) {
  if (step === 1) {
    const p = collectTripParams(true);
    if (!p.destination.trim()) { showToast('Please enter a destination.', true); return false; }
    if (!p.duration || p.duration < 1) { showToast('Please enter trip duration.', true); return false; }
    if (!p.climate) { showToast('Please select a climate.', true); return false; }
    if (!p.season) { showToast('Please select a season.', true); return false; }
    if (!p.luggageSize) { showToast('Please select a luggage size.', true); return false; }
    if (p.interests.length === 0) { showToast('Please select at least one interest.', true); return false; }
  }
  if (step === 2) {
    if (state.items.length === 0) { showToast('Please add at least one clothing item.', true); return false; }
    if (state.items.some(i => !i.analysis)) { showToast('Please wait for all items to finish analyzing.', true); return false; }
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
    luggageSize: (document.querySelector('input[name="luggage"]:checked') || {}).value || '',
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

// ===== Step 2: Wardrobe =====
async function handleFileInput(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  input.value = '';

  for (const file of files) {
    await processImageFile(file);
  }
}

async function processImageFile(file) {
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
  state.items.push(item);
  renderWardrobeGrid();

  // Analyze the item
  try {
    const result = await apiPost('/api/analyze-item', { imageData: dataUrl });
    item.analysis = result.analysis;
    renderWardrobeGrid();
  } catch (e) {
    showToast(`Could not analyze item: ${e.message}`, true);
    // Remove the item if analysis failed
    state.items = state.items.filter(i => i.id !== id);
    renderWardrobeGrid();
  }
}

function deleteItem(id) {
  state.items = state.items.filter(i => i.id !== id);
  renderWardrobeGrid();
}

function renderWardrobeGrid() {
  const empty = document.getElementById('wardrobe-empty');
  const grid = document.getElementById('wardrobe-grid');

  if (state.items.length === 0) {
    empty.style.display = 'block';
    grid.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  grid.style.display = 'grid';

  grid.innerHTML = state.items.map(item => {
    const analyzing = !item.analysis;
    const name = item.analysis ? item.analysis.type : '…';
    const category = item.analysis ? item.analysis.category : '';
    const tags = item.analysis ? [...(item.analysis.style || []), ...(item.analysis.weatherSuitability || [])].slice(0, 4) : [];

    return `
      <div class="item-card ${analyzing ? 'item-analyzing' : ''}" id="item-${item.id}">
        <img class="item-card-img" src="${item.imageData}" alt="clothing item" />
        ${!analyzing ? `<button class="item-delete-btn" onclick="app.deleteItem(${item.id})" title="Remove">✕</button>` : ''}
        <div class="item-card-body">
          <div class="item-card-name">${name}</div>
          ${category ? `<div class="item-card-category">${category}</div>` : ''}
          ${tags.length ? `<div class="item-card-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
          ${analyzing ? '<div class="item-analyzing-label">Analyzing…</div>' : ''}
        </div>
      </div>`;
  }).join('');
}

// ===== Step 3: Packing Analysis =====
async function runPackingAnalysis() {
  showLoading('Analyzing your packing list…');
  try {
    const itemAnalyses = state.items.map(i => i.analysis);
    const result = await apiPost('/api/analyze-packing', {
      items: itemAnalyses,
      tripParams: state.tripParams,
    });
    state.packingAnalysis = result;
    renderPackingAnalysis(result);
  } catch (e) {
    showToast(`Analysis failed: ${e.message}`, true);
    throw e;
  } finally {
    hideLoading();
  }
}

function getScoreColor(score) {
  if (score >= 75) return '#27ae60';
  if (score >= 50) return '#f39c12';
  return '#e74c3c';
}

function renderPackingAnalysis(data) {
  const container = document.getElementById('analysis-content');

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

// ===== Step 4: Outfit Planner =====
async function runOutfitPlanning() {
  showLoading('Generating outfit recommendations…');
  try {
    const itemAnalyses = state.items.map(i => i.analysis);
    const result = await apiPost('/api/get-outfits', {
      items: itemAnalyses,
      tripParams: state.tripParams,
    });
    state.outfits = result;
    renderOutfits(result);
  } catch (e) {
    showToast(`Outfit planning failed: ${e.message}`, true);
    throw e;
  } finally {
    hideLoading();
  }
}

function renderOutfits(data) {
  const container = document.getElementById('outfits-content');
  const outfits = data.outfits || [];
  const tips = data.stylingTips || [];

  container.innerHTML = `
    <div class="outfits-grid">
      ${outfits.map(outfit => {
        const usedItems = (outfit.itemIndices || []).map(idx => state.items[idx - 1]).filter(Boolean);
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
  if (!state.packingAnalysis || !state.outfits) {
    showToast('Please complete the analysis and outfit steps first.', true);
    return;
  }

  const p = state.tripParams;
  const data = state.packingAnalysis;
  const outfitsData = state.outfits;
  const missing = data.missing || [];
  const excessive = data.excessive || [];
  const tips = data.tips || [];
  const outfits = outfitsData.outfits || [];
  const stylingTips = outfitsData.stylingTips || [];

  const html = `
    <h1>PackSmart — Trip Report</h1>
    <h2>Trip Details</h2>
    <table class="report-table">
      <tr><td>Destination</td><td>${p.destination}</td></tr>
      <tr><td>Duration</td><td>${p.duration} days</td></tr>
      <tr><td>Climate</td><td>${p.climate}</td></tr>
      <tr><td>Season</td><td>${p.season}</td></tr>
      <tr><td>Activities</td><td>${p.interests.join(', ')}</td></tr>
      <tr><td>Laundromat Access</td><td>${p.hasLaundromat ? 'Yes' : 'No'}</td></tr>
      <tr><td>Luggage Size</td><td>${p.luggageSize}</td></tr>
    </table>

    <h2>Packing Analysis</h2>
    <p><strong>Coverage Score:</strong> ${data.coverageScore}%</p>
    <p>${data.summary || ''}</p>

    ${missing.length ? `
    <h3>Missing Items</h3>
    <ul>
      ${missing.map(m => `<li><strong>[${m.priority || 'optional'}]</strong> ${m.item} — ${m.reason}</li>`).join('')}
    </ul>` : ''}

    ${excessive.length ? `
    <h3>Potentially Excessive</h3>
    <ul>
      ${excessive.map(e => `<li>${e.item} — ${e.reason}</li>`).join('')}
    </ul>` : ''}

    ${data.accessories ? `<h3>Accessories</h3><p>${data.accessories}</p>` : ''}

    ${tips.length ? `
    <h3>Packing Tips</h3>
    <ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}

    <h2>Outfit Plans</h2>
    ${outfits.map(outfit => `
      <div class="report-outfit">
        <h3>${outfit.name} ${outfit.weatherBadge ? `(${outfit.weatherBadge})` : ''}</h3>
        <p><em>${outfit.occasion || ''}</em></p>
        <p>${outfit.description || ''}</p>
      </div>`).join('')}

    ${stylingTips.length ? `
    <h3>Styling Tips</h3>
    <ul>${stylingTips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
  `;

  document.getElementById('print-report').innerHTML = html;
  window.print();
}

// ===== Start Over =====
function startOver() {
  state.currentStep = 1;
  state.tripParams = { destination: '', duration: 0, climate: '', season: '', interests: [], hasLaundromat: false, luggageSize: '' };
  state.items = [];
  state.packingAnalysis = null;
  state.outfits = null;
  itemIdCounter = 0;

  // Reset form
  document.getElementById('destination').value = '';
  document.getElementById('duration').value = '';
  document.getElementById('climate').value = '';
  document.getElementById('season').value = '';
  document.getElementById('laundromat').checked = false;
  document.getElementById('laundromat-label').textContent = 'No';
  document.querySelectorAll('#interests-grid input').forEach(el => { el.checked = false; el.closest('.pill').classList.remove('selected'); });
  document.querySelectorAll('input[name="luggage"]').forEach(el => { el.checked = false; el.closest('.luggage-card').classList.remove('selected'); });

  // Reset wardrobe
  renderWardrobeGrid();

  // Reset analysis / outfits placeholders
  document.getElementById('analysis-content').innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Your analysis will appear here once you proceed from the Wardrobe step.</p></div>`;
  document.getElementById('outfits-content').innerHTML = `<div class="empty-state"><div class="empty-icon">👗</div><p>Your outfit plans will appear here.</p></div>`;

  renderStep(1);
}

// ===== UI Interactivity (non-app logic) =====
function initUI() {
  // Pill checkboxes
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pill.classList.toggle('selected', pill.querySelector('input').checked);
    });
  });

  // Luggage cards
  document.querySelectorAll('.luggage-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.luggage-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });

  // Laundromat toggle label
  document.getElementById('laundromat').addEventListener('change', function () {
    document.getElementById('laundromat-label').textContent = this.checked ? 'Yes' : 'No';
  });
}

// ===== Public app interface =====
const app = {
  goToStep,
  handleFileInput,
  deleteItem,
  startOver,
  downloadReport,
};

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  renderWardrobeGrid();
});
