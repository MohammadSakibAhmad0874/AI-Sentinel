/**
 * AI Sentinel — Main JS (index.html)
 * Handles: upload, typewriter, scroll reveal, scanning overlay, API call
 */

// API_BASE is set by js/config.js (auto-detects local vs production)
const API_BASE = window.SENTINEL_API_BASE || 'http://localhost:8000/api';

// Mark body as JS-ready so CSS reveal animations activate
document.documentElement.classList.add('js-ready');
document.body.classList.add('js-ready');

/* ══════════════════════════════════════
   TYPEWRITER
══════════════════════════════════════ */
const TYPEWRITER_TEXTS = [
  'Detect ChatGPT-generated content',
  'Identify Gemini AI writing',
  'Expose Claude AI patterns',
  'Spot Grok AI text',
  'Scan AI-generated images',
  'Analyse AI video content',
  'Protect your academic integrity',
];

(function initTypewriter() {
  const el = document.getElementById('typewriter-text');
  if (!el) return;

  let idx = 0, charIdx = 0, deleting = false;

  function tick() {
    const current = TYPEWRITER_TEXTS[idx];
    if (deleting) {
      el.textContent = current.slice(0, --charIdx);
      if (charIdx === 0) {
        deleting = false;
        idx = (idx + 1) % TYPEWRITER_TEXTS.length;
        setTimeout(tick, 400);
        return;
      }
      setTimeout(tick, 38);
    } else {
      el.textContent = current.slice(0, ++charIdx);
      if (charIdx === current.length) {
        deleting = true;
        setTimeout(tick, 2200);
        return;
      }
      setTimeout(tick, 65);
    }
  }
  setTimeout(tick, 1200);
})();

/* ══════════════════════════════════════
   HEADER SCROLL EFFECT
══════════════════════════════════════ */
window.addEventListener('scroll', () => {
  document.querySelector('.header')?.classList.toggle('scrolled', window.scrollY > 60);
});

/* ══════════════════════════════════════
   SCROLL REVEAL
══════════════════════════════════════ */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } });
}, { threshold: 0, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal, .reveal-left, .reveal-right')
  .forEach(el => revealObserver.observe(el));

// Force-reveal elements already in viewport on page load
window.addEventListener('load', () => {
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) el.classList.add('visible');
  });
});

/* ══════════════════════════════════════
   STATS COUNTER ANIMATION
══════════════════════════════════════ */
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    const dur    = 1800;
    const start  = performance.now();
    function step(now) {
      const pct = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - pct, 3);
      el.textContent = Math.round(ease * target) + (el.dataset.suffix || '');
      if (pct < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { animateCounters(); statsObserver.disconnect(); } });
}, { threshold: 0 });
const statsBar = document.querySelector('.stats-bar');
if (statsBar) statsObserver.observe(statsBar);

/* ══════════════════════════════════════
   FILE UPLOAD — DROP ZONE
══════════════════════════════════════ */
const dropZone    = document.getElementById('drop-zone');
const fileInput   = document.getElementById('file-input');
const selectedDiv = document.getElementById('selected-file');
const fileName    = document.getElementById('file-name-display');
const fileSize    = document.getElementById('file-size-display');
const removeBtnEl = document.getElementById('remove-file');
const analyzeBtn  = document.getElementById('btn-analyze-file');

let selectedFile = null;

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function setFile(file) {
  selectedFile = file;
  if (!file) {
    selectedDiv?.classList.remove('show');
    if (analyzeBtn) analyzeBtn.disabled = false;
    return;
  }
  if (fileName) fileName.textContent  = file.name;
  if (fileSize) fileSize.textContent  = formatBytes(file.size);
  selectedDiv?.classList.add('show');
  if (analyzeBtn) analyzeBtn.disabled = false;
}

dropZone?.addEventListener('click', () => fileInput?.click());
dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragging'); });
dropZone?.addEventListener('dragleave', ()  => dropZone.classList.remove('dragging'));
dropZone?.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragging');
  const f = e.dataTransfer.files[0];
  if (f) setFile(f);
});

fileInput?.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

removeBtnEl?.addEventListener('click', () => {
  selectedFile = null;
  if (fileInput) fileInput.value = '';
  selectedDiv?.classList.remove('show');
});

/* ══════════════════════════════════════
   SCAN OVERLAY
══════════════════════════════════════ */
const scanOverlay  = document.getElementById('scan-overlay');
const scanStatus   = document.getElementById('scan-status');
const progressFill = document.getElementById('scan-progress-fill');

const SCAN_MESSAGES = [
  'Reading file…',
  'Parsing content…',
  'Sending to detection engine…',
  'Analysing language patterns…',
  'Computing AI probability…',
  'Estimating model attribution…',
  'Generating report…',
];

let scanMsgInterval = null;

function showScanOverlay() {
  scanOverlay?.classList.add('show');
  let msgIdx = 0, progress = 0;
  if (progressFill) progressFill.style.width = '0%';
  scanMsgInterval = setInterval(() => {
    if (scanStatus) scanStatus.textContent = SCAN_MESSAGES[msgIdx % SCAN_MESSAGES.length];
    msgIdx++;
    progress = Math.min(progress + (100 / SCAN_MESSAGES.length), 90);
    if (progressFill) progressFill.style.width = progress + '%';
  }, 900);
}

function hideScanOverlay() {
  clearInterval(scanMsgInterval);
  if (progressFill) progressFill.style.width = '100%';
  setTimeout(() => scanOverlay?.classList.remove('show'), 400);
}

/* ══════════════════════════════════════
   ANALYSE — FILE
══════════════════════════════════════ */
analyzeBtn?.addEventListener('click', async () => {
  if (!selectedFile) { alert('Please upload a file first.'); return; }

  showScanOverlay();
  const form = new FormData();
  form.append('file', selectedFile);

  try {
    const res  = await fetch(`${API_BASE}/detect`, { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Detection failed.');
    sessionStorage.setItem('sentinel_result', JSON.stringify(data));
    hideScanOverlay();
    window.location.href = '/results';
  } catch (err) {
    hideScanOverlay();
    alert(`Error: ${err.message}`);
  }
});

/* ══════════════════════════════════════
   ANALYSE — TEXT PASTE
══════════════════════════════════════ */
const textArea    = document.getElementById('text-input');
const textAnalyzeBtn = document.getElementById('btn-analyze-text');

textAnalyzeBtn?.addEventListener('click', async () => {
  const txt = textArea?.value?.trim();
  if (!txt || txt.length < 20) { alert('Please enter at least 20 characters of text.'); return; }

  showScanOverlay();
  const form = new FormData();
  form.append('text', txt);

  try {
    const res  = await fetch(`${API_BASE}/detect`, { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Detection failed.');
    sessionStorage.setItem('sentinel_result', JSON.stringify(data));
    hideScanOverlay();
    window.location.href = '/results';
  } catch (err) {
    hideScanOverlay();
    alert(`Error: ${err.message}`);
  }
});

/* ══════════════════════════════════════
   NAV SMOOTH SCROLL
══════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  });
});
