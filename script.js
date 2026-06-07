/**
 * Continuous Probability Management Core Module
 */

let c8ChartInstance = null;
let c9ChartInstance = null;
let isDragging = false;
 
// ─── C8 CONFIG ───────────────────────────────────────────────────────────────
const c8Config = {
    uniform:     { params: { a: { label: 'Lower Bound (a)', val: 0, min: -5, max: 10 }, b: { label: 'Upper Bound (b)', val: 10, min: 5, max: 25 } }, defaultX1: 2, defaultX2: 6 },
    triangular:  { params: { a: { label: 'Lower Boundary (a)', val: 0, min: -5, max: 5 }, b: { label: 'Upper Boundary (b)', val: 12, min: 8, max: 25 }, c: { label: 'Mode / Apex (c)', val: 4, min: 0, max: 12 } }, defaultX1: 2, defaultX2: 7 },
    linear:      { params: { a: { label: 'Start Interval (a)', val: 0, min: -5, max: 5 }, b: { label: 'End Interval (b)', val: 10, min: 6, max: 25 }, slope: { label: 'Direction (-1 = Dec, 1 = Inc)', val: 1, min: -1, max: 1 } }, defaultX1: 2, defaultX2: 6 },
    piecewise:   { params: { a: { label: 'Minimum (a)', val: 0, min: -5, max: 4 }, m: { label: 'Breakpoint (m)', val: 5, min: 2, max: 12 }, b: { label: 'Maximum (b)', val: 12, min: 8, max: 25 }, h1: { label: 'Height of Piece 1 (h1)', val: 0.06, min: 0.01, max: 0.2 } }, defaultX1: 2, defaultX2: 8 },
    normal:      { params: { mean: { label: 'Mean (μ)', val: 4, min: -10, max: 20 }, std: { label: 'Std Deviation (σ)', val: 2.5, min: 0.5, max: 8 } }, defaultX1: 1.5, defaultX2: 6.5 }
};
 
// ─── BOOTSTRAP ───────────────────────────────────────────────────────────────
window.onload = function () {
    updateC8Layout();
    setupC8Interactivity();
    loadC9Dataset('normal');
    setupDragAndDrop();
};
 
// ─── TAB SWITCHING ────────────────────────────────────────────────────────────
// FIX: receives the button element explicitly instead of relying on global `event`
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(tabId).classList.add('active');
    if (tabId === 'c8') updateC8Layout();
    if (tabId === 'c9') runC9Analysis();
}
 
// ─── C8: LAYOUT & CONTROLS ───────────────────────────────────────────────────
function updateC8Layout() {
    const type = document.getElementById('c8-dist-type').value;
    const config = c8Config[type];
    const container = document.getElementById('c8-params-container');
 
    let html = '';
    for (let p in config.params) {
        const spec = config.params[p];
        html += `
            <div class="form-group">
                <label>${spec.label}</label>
                <div class="slider-input-group">
                    <input type="range" id="param-${p}-slider" min="${spec.min}" max="${spec.max}" step="any" value="${spec.val}" oninput="syncC8ParamControl('${p}', 'slider')">
                    <input type="number" id="param-${p}" value="${spec.val}" step="any" oninput="syncC8ParamControl('${p}', 'number')">
                </div>
            </div>`;
    }
    container.innerHTML = html;
 
    const globalMin = type === 'normal' ? -15 : -5;
    const globalMax = type === 'normal' ? 25 : 30;
    document.getElementById('c8-x1-slider').min = globalMin;
    document.getElementById('c8-x1-slider').max = globalMax;
    document.getElementById('c8-x2-slider').min = globalMin;
    document.getElementById('c8-x2-slider').max = globalMax;
 
    document.getElementById('c8-x1').value        = config.defaultX1;
    document.getElementById('c8-x1-slider').value = config.defaultX1;
    document.getElementById('c8-x2').value        = config.defaultX2;
    document.getElementById('c8-x2-slider').value = config.defaultX2;
 
    updateC8Calculations();
}
 
function syncC8ParamControl(p, source) {
    const slider = document.getElementById(`param-${p}-slider`);
    const number = document.getElementById(`param-${p}`);
    if (source === 'slider') number.value = parseFloat(slider.value).toFixed(2);
    else slider.value = number.value;
    updateC8Calculations();
}
 
function syncC8BoundControl(id, source) {
    const slider = document.getElementById(`c8-${id}-slider`);
    const number = document.getElementById(`c8-${id}`);
    if (source === 'slider') number.value = parseFloat(slider.value).toFixed(2);
    else slider.value = number.value;
    updateC8Calculations();
}
 
function getC8Parameters() {
    const type = document.getElementById('c8-dist-type').value;
    const params = {};
    for (let p in c8Config[type].params) {
        const el = document.getElementById(`param-${p}`);
        params[p] = el ? parseFloat(el.value) : c8Config[type].params[p].val;
    }
    return params;
}
 
// ─── PDF & CDF FUNCTIONS ─────────────────────────────────────────────────────
function evaluatePDF(type, x, p) {
    switch (type) {
        case 'uniform':
            return (x >= p.a && x <= p.b) ? 1 / (p.b - p.a) : 0;
        case 'triangular':
            if (x < p.a || x > p.b) return 0;
            if (x < p.c)  return (2 * (x - p.a)) / ((p.b - p.a) * (p.c - p.a));
            if (x === p.c) return 2 / (p.b - p.a);
            return (2 * (p.b - x)) / ((p.b - p.a) * (p.b - p.c));
        case 'linear': {
            if (x < p.a || x > p.b) return 0;
            const len = p.b - p.a;
            return p.slope >= 0
                ? (2 * (x - p.a)) / (len * len)
                : (2 * (p.b - x)) / (len * len);
        }
        case 'piecewise': {
            if (x < p.a || x > p.b) return 0;
            const h2 = Math.max(0, (1 - p.h1 * (p.m - p.a)) / (p.b - p.m));
            return x <= p.m ? p.h1 : h2;
        }
        case 'normal':
            return (1 / (p.std * Math.sqrt(2 * Math.PI))) *
                Math.exp(-Math.pow(x - p.mean, 2) / (2 * p.std * p.std));
    }
    return 0;
}
 
function evaluateCDF(type, x, p) {
    switch (type) {
        case 'uniform':
            return x < p.a ? 0 : x > p.b ? 1 : (x - p.a) / (p.b - p.a);
        case 'triangular':
            if (x < p.a) return 0;
            if (x > p.b) return 1;
            return x <= p.c
                ? Math.pow(x - p.a, 2) / ((p.b - p.a) * (p.c - p.a))
                : 1 - Math.pow(p.b - x, 2) / ((p.b - p.a) * (p.b - p.c));
        case 'linear':
            if (x < p.a) return 0;
            if (x > p.b) return 1;
            return p.slope >= 0
                ? Math.pow(x - p.a, 2) / Math.pow(p.b - p.a, 2)
                : 1 - Math.pow(p.b - x, 2) / Math.pow(p.b - p.a, 2);
        case 'piecewise': {
            if (x < p.a) return 0;
            if (x > p.b) return 1;
            const area1 = p.h1 * (p.m - p.a);
            const h2 = Math.max(0, (1 - area1) / (p.b - p.m));
            return x <= p.m ? p.h1 * (x - p.a) : area1 + h2 * (x - p.m);
        }
        case 'normal':
            return 0.5 * (1 + erf((x - p.mean) / (p.std * Math.sqrt(2))));
    }
    return 0;
}
 
function erf(z) {
    const t = 1.0 / (1.0 + 0.5 * Math.abs(z));
    const ans = 1 - t * Math.exp(-z * z - 1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
        t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 +
        t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return z >= 0 ? ans : -ans;
}
 
// ─── C8: CALCULATE & RENDER ───────────────────────────────────────────────────
function updateC8Calculations() {
    const type     = document.getElementById('c8-dist-type').value;
    const probType = document.getElementById('c8-prob-type').value;
    const p        = getC8Parameters();
 
    document.getElementById('c8-x2-group').style.display = probType === 'between' ? 'block' : 'none';
 
    const x1 = parseFloat(document.getElementById('c8-x1').value) || 0;
    const x2 = parseFloat(document.getElementById('c8-x2').value) || 0;
 
    let prob = 0;
    if (probType === 'below')   prob = evaluateCDF(type, x1, p);
    if (probType === 'above')   prob = 1 - evaluateCDF(type, x1, p);
    if (probType === 'between') prob = Math.max(0, evaluateCDF(type, x2, p) - evaluateCDF(type, x1, p));
 
    document.getElementById('c8-results').innerText = `Calculated Probability Area: P = ${prob.toFixed(4)}`;
    renderC8Chart(type, p, probType, x1, x2);
}
 
function renderC8Chart(type, p, probType, x1, x2) {
    const startX = type === 'normal' ? p.mean - 4 * p.std : p.a - (p.b - p.a) * 0.2;
    const endX   = type === 'normal' ? p.mean + 4 * p.std : p.b + (p.b - p.a) * 0.2;
    const steps  = 200;
    const delta  = (endX - startX) / steps;
 
    const labels = [], pdfData = [], shadeData = [];
    for (let i = 0; i <= steps; i++) {
        const cx = startX + i * delta;
        const y  = evaluatePDF(type, cx, p);
        labels.push(cx);
        pdfData.push(y);
        const shaded = (probType === 'below' && cx <= x1) ||
                       (probType === 'above' && cx >= x1) ||
                       (probType === 'between' && cx >= x1 && cx <= x2);
        shadeData.push(shaded ? y : 0);
    }
 
    if (c8ChartInstance) c8ChartInstance.destroy();
    const ctx = document.getElementById('c8Chart').getContext('2d');
    c8ChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Shaded Area', data: shadeData, backgroundColor: 'rgba(59,130,246,0.25)', fill: true, borderColor: 'transparent', pointRadius: 0, order: 2 },
                { label: 'PDF f(x)',    data: pdfData,   borderColor: '#3b82f6', borderWidth: 2.5, fill: false, pointRadius: 0, order: 1 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { type: 'linear', position: 'bottom', grid: { color: '#334155' }, ticks: { color: '#94a3b8', maxTicksLimit: 10 } },
                y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
            },
            plugins: { legend: { labels: { color: '#f8fafc' } } }
        }
    });
}
 
function setupC8Interactivity() {
    const canvas = document.getElementById('c8Chart');
 
    function updateFromEvent(e) {
        if (!c8ChartInstance) return;
        const rect   = canvas.getBoundingClientRect();
        const xVal   = c8ChartInstance.scales.x.getValueForPixel(e.clientX - rect.left);
        if (xVal === undefined || isNaN(xVal)) return;
 
        const probType = document.getElementById('c8-prob-type').value;
        const x1Input  = document.getElementById('c8-x1');
        const x1Slider = document.getElementById('c8-x1-slider');
 
        if (probType === 'between') {
            const x2Input  = document.getElementById('c8-x2');
            const x2Slider = document.getElementById('c8-x2-slider');
            const cx1 = parseFloat(x1Input.value) || 0;
            const cx2 = parseFloat(x2Input.value) || 0;
            if (Math.abs(xVal - cx1) < Math.abs(xVal - cx2)) {
                x1Input.value = xVal.toFixed(2); x1Slider.value = xVal;
            } else {
                x2Input.value = xVal.toFixed(2); x2Slider.value = xVal;
            }
        } else {
            x1Input.value = xVal.toFixed(2); x1Slider.value = xVal;
        }
        updateC8Calculations();
    }
 
    canvas.addEventListener('mousedown', (e) => { isDragging = true;  updateFromEvent(e); });
    canvas.addEventListener('mousemove', (e) => { if (isDragging) updateFromEvent(e); });
    window.addEventListener('mouseup',   ()  => { isDragging = false; });
}
 
// ─── C9: FILE HANDLING ────────────────────────────────────────────────────────
function handleFileSelect(event) {
    processUploadedFile(event.target.files[0]);
}
 
function setupDragAndDrop() {
    const dropZone = document.getElementById('c9-drop-zone');
    if (!dropZone) return;
    ['dragenter', 'dragover'].forEach(name =>
        dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(name =>
        dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
    dropZone.addEventListener('drop', (e) => processUploadedFile(e.dataTransfer.files[0]));
}
 
function processUploadedFile(file) {
    if (!file) return;
    const statusEl = document.getElementById('upload-status');
    statusEl.innerHTML = `⏳ Loading: <strong>${file.name}</strong>...`;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('c9-data-input').value = e.target.result.replace(/[\t,]+/g, '\n');
        statusEl.innerHTML = `✅ Loaded: <strong>${file.name}</strong>`;
        runC9Analysis();
    };
    reader.readAsText(file);
}
 
function loadC9Dataset(type) {
    const datasets = {
        uniform:    "10.2\n12.4\n15.1\n11.8\n18.3\n14.2\n19.7\n11.1\n16.4\n13.5\n17.9\n12.1\n15.6\n14.8\n16.2\n18.9\n10.5\n13.1\n17.2\n15.0",
        triangular: "5.1\n6.8\n8.2\n9.5\n10.1\n11.4\n11.9\n12.5\n13.2\n14.0\n14.5\n15.2\n16.3\n17.1\n18.5\n19.2\n21.4\n22.8\n24.1\n25.0",
        normal:     "22.1\n24.5\n28.2\n19.4\n23.8\n25.1\n31.4\n22.9\n26.7\n24.0\n18.1\n25.6\n23.2\n27.1\n21.5\n24.9\n29.3\n22.6\n25.8\n20.3"
    };
    document.getElementById('c9-data-input').value  = datasets[type];
    document.getElementById('c9-model-select').value = type === 'triangular' ? 'triangular' : type;
    runC9Analysis();
}
 
// ─── C9: ANALYSIS ENGINE ──────────────────────────────────────────────────────
function runC9Analysis() {
    const raw    = document.getElementById('c9-data-input').value;
    const values = raw.split(/[\n,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v)).sort((a, b) => a - b);
 
    if (values.length < 3) {
        document.getElementById('c9-parameters-output').innerText = 'Insufficient data. Provide at least 3 numeric values.';
        return;
    }
 
    const model  = document.getElementById('c9-model-select').value;
    const min    = values[0];
    const max    = values[values.length - 1];
    const mean   = values.reduce((a, b) => a + b, 0) / values.length;
    const std    = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);
 
    // Estimated mode for triangular
    const cEst = Math.max(min, Math.min(max, 3 * mean - min - max));
 
    // ── Log output ──
    let log = `--- PARAMETER ESTIMATION RESULTS ---\n`;
    log += `N (sample size)   : ${values.length}\n`;
    log += `Min               : ${min.toFixed(3)}\n`;
    log += `Max               : ${max.toFixed(3)}\n`;
    log += `Mean (μ)          : ${mean.toFixed(3)}\n`;
    log += `Std Deviation (σ) : ${std.toFixed(3)}\n`;
    log += `\n--- FITTED MODEL: ${model.toUpperCase()} ---\n`;
 
    if (model === 'uniform') {
        log += `Parameters: a = ${min.toFixed(3)}, b = ${max.toFixed(3)}\n`;
        log += `PDF f(x) = 1/(b-a) = ${(1/(max-min)).toFixed(4)} for x in [${min.toFixed(2)}, ${max.toFixed(2)}]`;
    } else if (model === 'triangular') {
        log += `Parameters: a = ${min.toFixed(3)}, b = ${max.toFixed(3)}, c ≈ ${cEst.toFixed(3)}\n`;
        log += `c estimated as: 3μ - a - b`;
    } else if (model === 'linear' || model === 'linear_dec') {
        const dir = model === 'linear' ? 'Increasing' : 'Decreasing';
        log += `Parameters: a = ${min.toFixed(3)}, b = ${max.toFixed(3)}\n`;
        log += `Direction: ${dir}\n`;
        log += `PDF f(x) = 2(x-a)/(b-a)² [inc.] or 2(b-x)/(b-a)² [dec.]`;
    } else if (model === 'piecewise') {
        const h1 = 1 / (2 * (max - min));
        const m  = mean;
        log += `Parameters: a = ${min.toFixed(3)}, m ≈ ${m.toFixed(3)}, b = ${max.toFixed(3)}\n`;
        log += `h1 ≈ ${h1.toFixed(4)}, h2 ≈ ${h1.toFixed(4)} (equal-height approximation)`;
    } else if (model === 'normal') {
        log += `Parameters: μ = ${mean.toFixed(3)}, σ = ${std.toFixed(3)}\n`;
        log += `PDF f(x) = (1/σ√2π) · exp(-(x-μ)²/2σ²)`;
    }
 
    document.getElementById('c9-parameters-output').innerText = log;
 
    // ── Insight ──
    let insight = `Data fitted to a <strong>${model.toUpperCase()}</strong> distribution. `;
    insight += `Range: <strong>${(max - min).toFixed(2)}</strong> units, centered at <strong>${mean.toFixed(2)}</strong>. `;
    if (model === 'normal') insight += 'Bell-shaped distribution suggests natural variability around a central mean.';
    if (model === 'uniform') insight += 'Roughly equal frequency across the range — consistent with uniform spread.';
    if (model === 'triangular') insight += 'Peaked distribution with a single most-likely value (mode).';
    if (model === 'linear' || model === 'linear_dec') insight += 'Monotone PDF — probability increases or decreases linearly across the range.';
    if (model === 'piecewise') insight += 'Step-shaped PDF — useful for data with distinct constant-density intervals.';
    document.getElementById('c9-interpretation-output').innerHTML = insight;
 
    // ── Probability from fitted model ──
    computeC9Probability(model, min, max, mean, std, cEst);
 
    // ── Chart ──
    buildC9Chart(values, model, min, max, mean, std, cEst);
}
 
// Evaluate CDF for fitted C9 models
function c9CDF(model, x, min, max, mean, std, cEst) {
    if (model === 'uniform') {
        return x < min ? 0 : x > max ? 1 : (x - min) / (max - min);
    }
    if (model === 'triangular') {
        if (x < min) return 0;
        if (x > max) return 1;
        return x <= cEst
            ? Math.pow(x - min, 2) / ((max - min) * (cEst - min))
            : 1 - Math.pow(max - x, 2) / ((max - min) * (max - cEst));
    }
    if (model === 'linear') {
        if (x < min) return 0; if (x > max) return 1;
        return Math.pow(x - min, 2) / Math.pow(max - min, 2);
    }
    if (model === 'linear_dec') {
        if (x < min) return 0; if (x > max) return 1;
        return 1 - Math.pow(max - x, 2) / Math.pow(max - min, 2);
    }
    if (model === 'piecewise') {
        if (x < min) return 0; if (x > max) return 1;
        const m  = mean;
        const h1 = 1 / (2 * (max - min));
        const area1 = h1 * (m - min);
        const h2 = Math.max(0, (1 - area1) / (max - m));
        return x <= m ? h1 * (x - min) : area1 + h2 * (x - m);
    }
    if (model === 'normal') {
        return 0.5 * (1 + erf((x - mean) / (std * Math.sqrt(2))));
    }
    return 0;
}
 
function computeC9Probability(model, min, max, mean, std, cEst) {
    const probType    = document.getElementById('c9-prob-type').value;
    const x1Group     = document.getElementById('c9-x1-group');
    const resultEl    = document.getElementById('c9-prob-result');
 
    // Show/hide custom x1 input
    x1Group.style.display = (probType === 'below' || probType === 'above') ? 'block' : 'none';
 
    let prob = 0;
    if (probType === 'between') {
        const lo = mean - std;
        const hi = mean + std;
        prob = c9CDF(model, hi, min, max, mean, std, cEst) - c9CDF(model, lo, min, max, mean, std, cEst);
    } else if (probType === 'tails') {
        const lo = mean - 2 * std;
        const hi = mean + 2 * std;
        prob = c9CDF(model, lo, min, max, mean, std, cEst) + (1 - c9CDF(model, hi, min, max, mean, std, cEst));
    } else if (probType === 'below') {
        const x1 = parseFloat(document.getElementById('c9-x1-custom').value) || 0;
        prob = c9CDF(model, x1, min, max, mean, std, cEst);
    } else if (probType === 'above') {
        const x1 = parseFloat(document.getElementById('c9-x1-custom').value) || 0;
        prob = 1 - c9CDF(model, x1, min, max, mean, std, cEst);
    }
 
    resultEl.innerText = `P = ${Math.max(0, Math.min(1, prob)).toFixed(4)}`;
}
 
// ─── C9: CHART ────────────────────────────────────────────────────────────────
// FIX: use a single numeric x-axis so histogram bars and PDF curve align correctly
function buildC9Chart(values, model, min, max, mean, std, cEst) {
    const binCount = 6;
    const binWidth = (max - min) / binCount;
 
    // Build histogram density data as scatter/bar points with x = bin center
    const histData = [];
    for (let i = 0; i < binCount; i++) {
        const lo    = min + i * binWidth;
        const hi    = lo + binWidth;
        const count = values.filter(v => v >= lo && (i === binCount - 1 ? v <= hi : v < hi)).length;
        const density = count / (values.length * binWidth);
        histData.push({ x: lo, y: density, width: binWidth });
    }
 
    // Build PDF curve points
    const steps = 120;
    const curveDelta = (max - min) / steps;
    const curveData  = [];
    for (let i = 0; i <= steps; i++) {
        const cx = min + i * curveDelta;
        let y = 0;
        if (model === 'uniform')   y = (cx >= min && cx <= max) ? 1 / (max - min) : 0;
        if (model === 'normal')    y = (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(cx - mean, 2) / (2 * std * std));
        if (model === 'triangular') {
            if (cx >= min && cx <= max) {
                if (cx < cEst)       y = (2 * (cx - min))  / ((max - min) * (cEst - min));
                else if (cx === cEst) y = 2 / (max - min);
                else                 y = (2 * (max - cx))  / ((max - min) * (max - cEst));
            }
        }
        if (model === 'linear')     y = (cx >= min && cx <= max) ? (2 * (cx - min))  / Math.pow(max - min, 2) : 0;
        if (model === 'linear_dec') y = (cx >= min && cx <= max) ? (2 * (max - cx))  / Math.pow(max - min, 2) : 0;
        if (model === 'piecewise') {
            const m  = mean;
            const h1 = 1 / (2 * (max - min));
            const h2 = Math.max(0, (1 - h1 * (m - min)) / (max - m));
            y = (cx >= min && cx <= max) ? (cx <= m ? h1 : h2) : 0;
        }
        curveData.push({ x: cx, y });
    }
 
    if (c9ChartInstance) c9ChartInstance.destroy();
    const ctx = document.getElementById('c9Chart').getContext('2d');
 
    c9ChartInstance = new Chart(ctx, {
        data: {
            datasets: [
                {
                    type: 'line',
                    label: 'Fitted PDF',
                    data: curveData,
                    borderColor: '#10b981',
                    borderWidth: 3,
                    pointRadius: 0,
                    fill: false,
                    order: 1
                },
                {
                    type: 'bar',
                    label: 'Empirical Density',
                    data: histData.map(d => ({ x: d.x + d.width / 2, y: d.y })),
                    backgroundColor: 'rgba(53,162,235,0.45)',
                    borderColor: '#35a2eb',
                    borderWidth: 1.5,
                    barPercentage: 1.0,
                    categoryPercentage: 1.0,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    offset: false,
                    grid:  { color: '#334155' },
                    ticks: { color: '#94a3b8', maxTicksLimit: 10 },
                    title: { display: true, text: 'x', color: '#94a3b8' }
                },
                y: {
                    beginAtZero: true,
                    grid:  { color: '#334155' },
                    ticks: { color: '#94a3b8' },
                    title: { display: true, text: 'Density', color: '#94a3b8' }
                }
            },
            plugins: { legend: { labels: { color: '#f8fafc' } } }
        }
    });
}
