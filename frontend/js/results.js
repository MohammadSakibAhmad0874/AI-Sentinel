/**
 * AI Sentinel — Results JS
 * Renders detection result from sessionStorage
 */

const MODEL_CONFIG = {
  chatgpt: { label: 'ChatGPT-like',  icon: '🤖', color: '#FF6B35' },
  gemini:  { label: 'Gemini-like',   icon: '✨', color: '#FCDE9C' },
  claude:  { label: 'Claude-like',   icon: '🔮', color: '#C3423F' },
  other:   { label: 'Other AI-like', icon: '⚡', color: '#2DC78A' },
};

function fmtBytes(b) {
  if (!b) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function getFileIcon(filename, type) {
  if (type === 'image') return '🖼️';
  if (type === 'video') return '🎬';
  const ext = (filename || '').split('.').pop().toLowerCase();
  const map = { pdf:'📄', docx:'📝', pptx:'📊', txt:'📃', md:'📋',
                py:'🐍', js:'⚡', ts:'🔷', html:'🌐', java:'☕',
                cpp:'⚙️', c:'⚙️', go:'🔵', rs:'🦀', sql:'🗄️' };
  return map[ext] || '📁';
}

/* ══════════════════════════════════════
   BOOT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('sentinel_result');
  if (!raw) { showEmpty(); return; }

  let data;
  try { data = JSON.parse(raw); }
  catch (e) { showEmpty(); return; }

  render(data);
});

/* ══════════════════════════════════════
   EMPTY STATE
══════════════════════════════════════ */
function showEmpty() {
  document.getElementById('results-content')?.remove();
  const el = document.getElementById('empty-state');
  if (el) el.style.display = 'block';
}

/* ══════════════════════════════════════
   MAIN RENDER
══════════════════════════════════════ */
function render(data) {
  const { file_type } = data;

  renderFileInfo(data);
  renderDonut(data);
  renderAttribution(data);

  if (file_type === 'text') {
    document.getElementById('text-tab-panel')?.classList.remove('hidden');
    renderHighlights(data);
    initTabs(data);
  } else if (file_type === 'image') {
    document.getElementById('media-tab-panel')?.classList.remove('hidden');
    renderImageResult(data);
    initTabs(data);
  } else if (file_type === 'video') {
    document.getElementById('media-tab-panel')?.classList.remove('hidden');
    renderVideoResult(data);
    initTabs(data);
  }
}

/* ── File info bar ───────────────────────────────────────── */
function renderFileInfo(data) {
  const icon = document.getElementById('file-icon-lg');
  const name = document.getElementById('result-filename');
  const meta = document.getElementById('result-meta');
  const badge= document.getElementById('file-type-badge');

  if (icon)  icon.textContent  = getFileIcon(data.filename, data.file_type);
  if (name)  name.textContent  = data.filename || 'Pasted Text';
  if (meta)  meta.textContent  = [
    data.file_type?.toUpperCase(),
    fmtBytes(data.file_size),
    data.duration ? `Duration: ${fmtTime(data.duration)}` : '',
    data.frames_analyzed ? `${data.frames_analyzed} frames analysed` : '',
  ].filter(Boolean).join('  ·  ');
  if (badge) badge.textContent = data.file_type || 'Unknown';
}

/* ── Donut chart ─────────────────────────────────────────── */
function renderDonut(data) {
  const ai  = parseFloat(data.ai_percent)    || 0;
  const hum = parseFloat(data.human_percent) || 0;
  const R   = 80;
  const C   = 2 * Math.PI * R; // ≈ 502.65

  const aiArc  = document.getElementById('donut-ai');
  const humArc = document.getElementById('donut-human');
  const pctEl  = document.getElementById('donut-pct');
  const subEl  = document.getElementById('donut-sub');

  if (pctEl) pctEl.textContent = ai.toFixed(1) + '%';
  if (subEl) subEl.textContent = ai >= 50 ? 'AI Content' : 'Mostly Human';

  // Animate after slight delay
  setTimeout(() => {
    if (aiArc)  aiArc.style.strokeDasharray  = `${(ai / 100) * C} ${C}`;
    if (humArc) {
      humArc.style.strokeDasharray  = `${(hum / 100) * C} ${C}`;
      humArc.style.strokeDashoffset = `-${(ai / 100) * C}`;
    }
  }, 300);

  // Legend
  document.getElementById('legend-ai-pct')  && (document.getElementById('legend-ai-pct').textContent  = ai.toFixed(1) + '%');
  document.getElementById('legend-hum-pct') && (document.getElementById('legend-hum-pct').textContent = hum.toFixed(1) + '%');
}

/* ── Model attribution ───────────────────────────────────── */
function renderAttribution(data) {
  const attr = data.model_attribution || {};
  const container = document.getElementById('model-bars');
  if (!container) return;

  container.innerHTML = '';
  Object.entries(MODEL_CONFIG).forEach(([key, cfg]) => {
    const pct = parseFloat(attr[key]) || 0;
    const item = document.createElement('div');
    item.className = 'model-bar-item';
    item.innerHTML = `
      <div class="model-bar-header">
        <span class="model-name"><span class="model-icon">${cfg.icon}</span>${cfg.label}</span>
        <span class="model-pct" style="color:${cfg.color}">${pct.toFixed(1)}%</span>
      </div>
      <div class="model-bar-track">
        <div class="model-bar-fill" data-target="${pct}" style="background:${cfg.color}"></div>
      </div>`;
    container.appendChild(item);
  });

  // Animate bars
  setTimeout(() => {
    container.querySelectorAll('.model-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.target + '%';
    });
  }, 500);
}

/* ── Text highlights ─────────────────────────────────────── */
function renderHighlights(data) {
  const content = document.getElementById('highlight-content');
  if (!content) return;

  const chunks = data.chunks || [];
  if (!chunks.length) {
    content.textContent = 'No text content to display.';
    return;
  }

  content.innerHTML = '';
  chunks.forEach((chunk, i) => {
    const span = document.createElement('span');
    span.textContent = chunk.text + ' ';

    if (chunk.is_ai) {
      const score = chunk.ai_score || 0;
      // Pick highlight class based on which model is most attributed
      let cls = 'chunk-ai';
      const attr = data.model_attribution || {};
      const top  = Object.entries(attr).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (top === 'chatgpt') cls += ' chatgpt-like';
      else if (top === 'gemini') cls += ' gemini-like';
      else if (top === 'claude') cls += ' claude-like';

      span.className = cls;
      span.title     = `AI Score: ${score}%`;

      // Tooltip on hover
      span.addEventListener('mouseenter', e => showTooltip(e, `🤖 AI Detected — ${score}% confidence`));
      span.addEventListener('mouseleave', hideTooltip);
    } else {
      span.className = 'chunk-human';
    }
    content.appendChild(span);
    // Stagger animation
    span.style.animation = `fade-in-up .4s ease ${i * 0.04}s both`;
  });
}

/* ── Image result ────────────────────────────────────────── */
function renderImageResult(data) {
  const verdictEl = document.getElementById('media-verdict');
  const confEl    = document.getElementById('media-confidence');
  const methodEl  = document.getElementById('media-method');

  const isAI = data.is_ai;
  const pct  = parseFloat(data.ai_percent) || 0;

  if (verdictEl) {
    verdictEl.className    = `verdict-badge ${isAI ? 'ai' : 'human'}`;
    verdictEl.textContent  = isAI ? '🤖 AI Generated' : '✅ Likely Human';
  }
  if (confEl)   confEl.textContent  = `Confidence: ${pct.toFixed(1)}%`;
  if (methodEl) methodEl.textContent = `Method: ${data.method || '—'}`;

  const markers = data.markers_found || [];
  if (markers.length) {
    const markerEl = document.getElementById('media-markers');
    if (markerEl) {
      markerEl.style.display = 'block';
      markerEl.textContent   = `AI Markers Found: ${markers.join(', ')}`;
    }
  }
}

/* ── Video result ────────────────────────────────────────── */
function renderVideoResult(data) {
  const verdictEl  = document.getElementById('media-verdict');
  const confEl     = document.getElementById('media-confidence');
  const framesEl   = document.getElementById('video-frames-info');
  const timelineEl = document.getElementById('video-timeline-bar');
  const tlLabels   = document.getElementById('timeline-labels');

  const aiPct        = parseFloat(data.ai_percent) || 0;
  const aiFramePct   = parseFloat(data.ai_frame_percent) || 0;
  const duration     = parseFloat(data.duration) || 0;
  const frameResults = data.frame_results || [];

  if (verdictEl) {
    verdictEl.className    = `verdict-badge ${aiPct >= 50 ? 'ai' : 'human'}`;
    verdictEl.textContent  = aiPct >= 50 ? '🤖 Likely AI Generated' : '✅ Likely Authentic';
  }
  if (confEl)   confEl.textContent   = `Average AI Confidence: ${aiPct.toFixed(1)}%  |  AI Frame %: ${aiFramePct.toFixed(1)}%`;
  if (framesEl) framesEl.textContent = `${data.frames_analyzed || 0} frames analysed over ${fmtTime(duration)}`;

  // Timeline
  if (timelineEl && frameResults.length) {
    timelineEl.innerHTML = '';
    const totalDur = duration || 1;
    frameResults.forEach((fr, idx) => {
      const nextT  = frameResults[idx + 1]?.timestamp ?? duration;
      const segDur = nextT - fr.timestamp;
      const pct    = (segDur / totalDur) * 100;
      const seg    = document.createElement('div');
      seg.className = `timeline-seg ${fr.is_ai ? 'ai' : 'human'}`;
      seg.style.width = pct + '%';
      seg.title = `${fmtTime(fr.timestamp)}: ${fr.is_ai ? 'AI' : 'Human'} (${fr.ai_percent.toFixed(1)}%)`;
      timelineEl.appendChild(seg);
    });
  }

  if (tlLabels && duration) {
    tlLabels.innerHTML = '';
    const steps = Math.min(5, Math.ceil(duration / 10));
    for (let i = 0; i <= steps; i++) {
      const t = Math.round((i / steps) * duration);
      const s = document.createElement('span');
      s.textContent = fmtTime(t);
      tlLabels.appendChild(s);
    }
  }
}

/* ══════════════════════════════════════
   TABS
══════════════════════════════════════ */
function initTabs(data) {
  const tabs  = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.remove('hidden');
    });
  });
}

/* ══════════════════════════════════════
   TOOLTIP
══════════════════════════════════════ */
const tooltip = document.getElementById('chunk-tooltip');
function showTooltip(e, text) {
  if (!tooltip) return;
  tooltip.textContent = text;
  tooltip.style.left  = (e.clientX + 12) + 'px';
  tooltip.style.top   = (e.clientY - 36) + 'px';
  tooltip.classList.add('show');
}
function hideTooltip() { tooltip?.classList.remove('show'); }
document.addEventListener('mousemove', e => {
  if (tooltip?.classList.contains('show')) {
    tooltip.style.left = (e.clientX + 12) + 'px';
    tooltip.style.top  = (e.clientY - 36) + 'px';
  }
});

/* ══════════════════════════════════════
   COPY — highlighted AI text
══════════════════════════════════════ */
document.getElementById('btn-copy')?.addEventListener('click', () => {
  const chunks = document.querySelectorAll('.chunk-ai');
  if (!chunks.length) { showToast('No AI content found to copy.'); return; }
  const texts = Array.from(chunks).map(c => c.textContent.trim()).join('\n\n');
  navigator.clipboard.writeText(texts).then(() => showToast('✅ AI-detected text copied!'));
});

/* ══════════════════════════════════════
   EXPORT REPORT
══════════════════════════════════════ */
document.getElementById('btn-export')?.addEventListener('click', () => {
  const raw = sessionStorage.getItem('sentinel_result');
  if (!raw) return;
  const data = JSON.parse(raw);
  const lines = [
    '═══════════════════════════════════════',
    '         AI SENTINEL — SCAN REPORT',
    '═══════════════════════════════════════',
    `File: ${data.filename || 'Pasted Text'}`,
    `Type: ${data.file_type || '—'}`,
    `Size: ${fmtBytes(data.file_size)}`,
    '',
    '─── SUMMARY ───────────────────────────',
    `AI Probability:    ${data.ai_percent?.toFixed(1) ?? '—'}%`,
    `Human Probability: ${data.human_percent?.toFixed(1) ?? '—'}%`,
    '',
    '─── ESTIMATED MODEL ATTRIBUTION ───────',
    '  (Heuristic-based — NOT guaranteed)',
  ];
  const attr = data.model_attribution || {};
  Object.entries(MODEL_CONFIG).forEach(([k, cfg]) => {
    lines.push(`  ${cfg.icon} ${cfg.label.padEnd(20)} ${(attr[k] || 0).toFixed(1)}%`);
  });
  lines.push('');
  if (data.disclaimer) {
    lines.push('─── DISCLAIMER ─────────────────────────');
    lines.push(data.disclaimer);
    lines.push('');
  }
  lines.push('─── CHUNK ANALYSIS ─────────────────────');
  (data.chunks || []).forEach((c, i) => {
    lines.push(`[${i + 1}] ${c.is_ai ? '⚠ AI' : '✓ Human'} (${c.ai_score}%) — ${c.text.slice(0, 100)}…`);
  });
  lines.push('');
  lines.push(`Generated by AI Sentinel · ${new Date().toLocaleString()}`);

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: `sentinel-report-${Date.now()}.txt`
  });
  a.click();
  URL.revokeObjectURL(url);
  showToast('📄 Report downloaded!');
});

/* ── New Analysis ─────────────────────────────────────────── */
document.getElementById('btn-new')?.addEventListener('click', () => {
  sessionStorage.removeItem('sentinel_result');
  window.location.href = '/';
});

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
const toast = document.getElementById('copy-toast');
let toastTimer;
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}
