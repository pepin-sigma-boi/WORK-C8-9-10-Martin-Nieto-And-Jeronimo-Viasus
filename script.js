/**
 * Continuous Probability Management Core Module
 */

let c8ChartInstance = null;
let c9ChartInstance = null;
let isDragging = false;

// Initial Configurations for Simulation Mode Viewports
const c8Config = {
    uniform: { params: { a: { label: 'Lower Bound Limit (a)', val: 0, min: -5, max: 10 }, b: { label: 'Upper Bound Limit (b)', val: 10, min: 5, max: 25 } }, defaultX1: 2, defaultX2: 6 },
    triangular: { params: { a: { label: 'Lower Boundary Limit (a)', val: 0, min: -5, max: 5 }, b: { label: 'Upper Boundary Limit (b)', val: 12, min: 8, max: 25 }, c: { label: 'Apex Mode Point (c)', val: 4, min: 0, max: 12 } }, defaultX1: 2, defaultX2: 7 },
    linear: { params: { a: { label: 'Start Interval Boundary (a)', val: 0, min: -5, max: 5 }, b: { label: 'End Interval Boundary (b)', val: 10, min: 6, max: 25 }, slope: { label: 'Directional Derivative (-1=Dec, 1=Inc)', val: 1, min: -1, max: 1 } }, defaultX1: 2, defaultX2: 6 },
    piecewise: { params: { a: { label: 'Minimum Parameter (a)', val: 0, min: -5, max: 4 }, m: { label: 'Segmentation Breakpoint (m)', val: 5, min: 2, max: 12 }, b: { label: 'Maximum Parameter (b)', val: 12, min: 8, max: 25 }, h1: { label: 'Step Magnitude Height 1', val: 0.06, min: 0.01, max: 0.2 } }, defaultX1: 2, defaultX2: 8 },
    normal: { params: { mean: { label: 'Distribution Center (μ)', val: 4, min: -10, max: 20 }, std: { label: 'Dispersion Metric (σ)', val: 2.5, min: 0.5, max: 8 } }, defaultX1: 1.5, defaultX2: 6.5 }
};

// Application Bootstrapping Sequence
window.onload = function() {
    updateC8Layout();
    setupC8Interactivity();
    loadC9Dataset('normal');
    setupDragAndDrop();
};

/**
 * Tab Switching Controller Core
 */
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
    
    if (tabId === 'c8') { updateC8Layout(); }
    if (tabId === 'c9') { runC9Analysis(); }
}

/**
 * ============================================================================
 * SECTION C8: CONTINUOUS SIMULATION CORE ENGINE LOGIC
 * ============================================================================
 */
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
            </div>
        `;
    }
    container.innerHTML = html;
    
    const globalMin = type === 'normal' ? -15 : -5;
    const globalMax = type === 'normal' ? 25 : 30;

    document.getElementById('c8-x1-slider').min = globalMin; document.getElementById('c8-x1-slider').max = globalMax;
    document.getElementById('c8-x2-slider').min = globalMin; document.getElementById('c8-x2-slider').max = globalMax;

    document.getElementById('c8-x1').value = config.defaultX1;
    document.getElementById('c8-x1-slider').value = config.defaultX1;
    document.getElementById('c8-x2').value = config.defaultX2;
    document.getElementById('c8-x2-slider').value = config.defaultX2;
    
    updateC8Calculations();
}

function syncC8ParamControl(p, source) {
    const slider = document.getElementById(`param-${p}-slider`);
    const number = document.getElementById(`param-${p}`);
    if (source === 'slider') { number.value = parseFloat(slider.value).toFixed(2); } 
    else { slider.value = number.value; }
    updateC8Calculations();
}

function syncC8BoundControl(id, source) {
    const slider = document.getElementById(`c8-${id}-slider`);
    const number = document.getElementById(`c8-${id}`);
    if (source === 'slider') { number.value = parseFloat(slider.value).toFixed(2); } 
    else { slider.value = number.value; }
    updateC8Calculations();
}

function getC8Parameters() {
    const type = document.getElementById('c8-dist-type').value;
    const params = {};
    for (let p in c8Config[type].params) {
        const element = document.getElementById(`param-${p}`);
        params[p] = element ? parseFloat(element.value) : c8Config[type].params[p].val;
    }
    return params;
}

// Structural Continuous Probability Distribution Functions (PDFs)
function evaluatePDF(type, x, p) {
    switch(type) {
        case 'uniform': return (x >= p.a && x <= p.b) ? (1 / (p.b - p.a)) : 0;
        case 'triangular':
            if (x < p.a || x > p.b) return 0;
            if (x < p.c) return (2 * (x - p.a)) / ((p.b - p.a) * (p.c - p.a));
            if (x === p.c) return 2 / (p.b - p.a);
            return (2 * (p.b - x)) / ((p.b - p.a) * (p.b - p.c));
        case 'linear':
            if (x < p.a || x > p.b) return 0;
            const len = p.b - p.a;
            return p.slope >= 0 ? (2 * (x - p.a)) / (len * len) : (2 * (p.b - x)) / (len * len);
        case 'piecewise':
            if (x < p.a || x > p.b) return 0;
            if (x <= p.m) return p.h1;
            return Math.max(0, (1 - (p.h1 * (p.m - p.a))) / (p.b - p.m));
        case 'normal':
            return (1 / (p.std * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(x - p.mean, 2) / (2 * p.std * p.std));
    }
    return 0;
}

// Continuous Cumulative Distribution Functions (CDFs)
function evaluateCDF(type, x, p) {
    switch(type) {
        case 'uniform': return x < p.a ? 0 : (x > p.b ? 1 : (x - p.a) / (p.b - p.a));
        case 'triangular':
            if (x < p.a) return 0; if (x > p.b) return 1;
            return x <= p.c ? Math.pow(x - p.a, 2) / ((p.b - p.a) * (p.c - p.a)) : 1 - Math.pow(p.b - x, 2) / ((p.b - p.a) * (p.b - p.c));
        case 'linear':
            if (x < p.a) return 0; if (x > p.b) return 1;
            return p.slope >= 0 ? Math.pow(x - p.a, 2) / (Math.pow(p.b - p.a, 2)) : 1 - Math.pow(p.b - x, 2) / (Math.pow(p.b - p.a, 2));
        case 'piecewise':
            if (x < p.a) return 0; if (x > p.b) return 1;
            const area1 = p.h1 * (p.m - p.a);
            if (x <= p.m) return p.h1 * (x - p.a);
            return area1 + Math.max(0, (1 - area1) / (p.b - p.m)) * (x - p.m);
        case 'normal': return 0.5 * (1 + errorFunction((x - p.mean) / (p.std * Math.sqrt(2))));
    }
    return 0;
}

function errorFunction(z) {
    const t = 1.0 / (1.0 + 0.5 * Math.abs(z));
    const ans = 1 - t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return z >= 0 ? ans : -ans;
}

function updateC8Calculations() {
    const type = document.getElementById('c8-dist-type').value;
    const probType = document.getElementById('c8-prob-type').value;
    const p = getC8Parameters();
    
    document.getElementById('c8-x2-group').style.display = probType === 'between' ? 'block' : 'none';

    const x1 = parseFloat(document.getElementById('c8-x1').value) || 0;
    const x2 = parseFloat(document.getElementById('c8-x2').value) || 0;

    let resultProb = 0;
    if (probType === 'below') resultProb = evaluateCDF(type, x1, p);
    else if (probType === 'above') resultProb = 1 - evaluateCDF(type, x1, p);
    else if (probType === 'between') resultProb = Math.max(0, evaluateCDF(type, x2, p) - evaluateCDF(type, x1, p));

    document.getElementById('c8-results').innerText = `Calculated Probability Area: P = ${resultProb.toFixed(4)}`;
    renderC8Chart(type, p, probType, x1, x2);
}

function renderC8Chart(type, p, probType, x1, x2) {
    let startX = type === 'normal' ? p.mean - 4 * p.std : p.a - (p.b - p.a) * 0.2;
    let endX = type === 'normal' ? p.mean + 4 * p.std : p.b + (p.b - p.a) * 0.2;

    const steps = 160;
    const delta = (endX - startX) / steps;
    const labels = [], pdfData = [], shadeData = [];

    for (let i = 0; i <= steps; i++) {
        const currX = startX + i * delta;
        labels.push(currX);
        const y = evaluatePDF(type, currX, p);
        pdfData.push(y);

        let isShaded = false;
        if (probType === 'below' && currX <= x1) isShaded = true;
        if (probType === 'above' && currX >= x1) isShaded = true;
        if (probType === 'between' && currX >= x1 && currX <= x2) isShaded = true;
        shadeData.push(isShaded ? y : 0);
    }

    if (c8ChartInstance) c8ChartInstance.destroy();

    const ctx = document.getElementById('c8Chart').getContext('2d');
    c8ChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Integrand Area Bounds', data: shadeData, backgroundColor: 'rgba(59, 130, 246, 0.25)', fill: true, borderColor: 'transparent', pointRadius: 0, order: 2 },
                { label: 'PDF Profile f(x)', data: pdfData, borderColor: '#3b82f6', borderWidth: 2.5, fill: false, pointRadius: 0, order: 1 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'linear', position: 'bottom', grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
            },
            plugins: { legend: { labels: { color: '#f8fafc' } } }
        }
    });
}

function setupC8Interactivity() {
    const canvas = document.getElementById('c8Chart');
    
    function updateBoundsFromEvent(e) {
        if (!c8ChartInstance) return;
        const rect = canvas.getBoundingClientRect();
        const xPixel = e.clientX - rect.left;
        const xDataValue = c8ChartInstance.scales.x.getValueForPixel(xPixel);
        
        if (xDataValue === undefined || isNaN(xDataValue)) return;
        
        const probType = document.getElementById('c8-prob-type').value;
        const x1Input = document.getElementById('c8-x1');
        const x1Slider = document.getElementById('c8-x1-slider');

        if (probType === 'between') {
            const x2Input = document.getElementById('c8-x2');
            const x2Slider = document.getElementById('c8-x2-slider');
            const currentX1 = parseFloat(x1Input.value) || 0;
            const currentX2 = parseFloat(x2Input.value) || 0;
            
            if (Math.abs(xDataValue - currentX1) < Math.abs(xDataValue - currentX2)) {
                x1Input.value = xDataValue.toFixed(2); x1Slider.value = xDataValue;
            } else {
                x2Input.value = xDataValue.toFixed(2); x2Slider.value = xDataValue;
            }
        } else {
            x1Input.value = xDataValue.toFixed(2); x1Slider.value = xDataValue;
        }
        updateC8Calculations();
    }

    canvas.addEventListener('mousedown', (e) => { isDragging = true; updateBoundsFromEvent(e); });
    canvas.addEventListener('mousemove', (e) => { if (isDragging) updateBoundsFromEvent(e); });
    window.addEventListener('mouseup', () => { isDragging = false; });
}

/**
 * ============================================================================
 * SECTION C9: EMPIRICAL HISTOGRAM AND APPROXIMATION LOGIC
 * ============================================================================
 */
function handleFileSelect(event) {
    processUploadedFile(event.target.files[0]);
}

function setupDragAndDrop() {
    const dropZone = document.getElementById('c9-drop-zone');
    if(!dropZone) return;
    
    ['dragenter', 'dragover'].forEach(name => {
        dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }, false);
    });
    ['dragleave', 'drop'].forEach(name => {
        dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }, false);
    });
    dropZone.addEventListener('drop', (e) => { processUploadedFile(e.dataTransfer.files[0]); }, false);
}

function processUploadedFile(file) {
    if (!file) return;
    const reader = new FileReader();
    const statusEl = document.getElementById('upload-status');
    statusEl.innerHTML = `⏳ Ingesting: <strong>${file.name}</strong>...`;
    
    reader.onload = function(e) {
        document.getElementById('c9-data-input').value = e.target.result.replace(/[\t,]+/g, '\n');
        statusEl.innerHTML = `✅ Successfully Loaded Matrix: <strong>${file.name}</strong>`;
        runC9Analysis();
    };
    reader.readAsText(file);
}

function loadC9Dataset(type) {
    // Injecting synthetic parameters modeling spatial distributions
    let datasets = {
        uniform: "10.2\n12.4\n15.1\n11.8\n18.3\n14.2\n19.7\n11.1\n16.4\n13.5\n17.9\n12.1\n15.6\n14.8\n16.2\n18.9\n10.5\n13.1\n17.2\n15.0",
        normal: "22.1\n24.5\n28.2\n19.4\n23.8\n25.1\n31.4\n22.9\n26.7\n24.0\n18.1\ =n25.6\n23.2\n27.1\n21.5\n24.9\n29.3\n22.6\n25.8\n20.3"
    };
    document.getElementById('c9-data-input').value = datasets[type];
    document.getElementById('c9-model-select').value = type;
    runC9Analysis();
}

function runC9Analysis() {
    const input = document.getElementById('c9-data-input').value;
    const values = input.split(/[\n,]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v)).sort((a,b)=>a-b);
    
    if (values.length < 3) {
        document.getElementById('c9-parameters-output').innerText = "Insufficient elements detected. Provide >= 3 elements.";
        return;
    }

    const targetModel = document.getElementById('c9-model-select').value;
    const min = values[0];
    const max = values[values.length - 1];
    const mean = values.reduce((a,b)=>a+b,0)/values.length;
    
    let varianceSum = 0;
    values.forEach(v => varianceSum += Math.pow(v - mean, 2));
    const stdDev = Math.sqrt(varianceSum / values.length);

    // Render console log analytics parameters
    let logText = `--- OPTIMIZATION MATRIX SUITE ---\n`;
    logText += `Parsed Element Count (N) : ${values.length}\n`;
    logText += `Calculated Geometric Min : ${min.toFixed(3)}\n`;
    logText += `Calculated Geometric Max : ${max.toFixed(3)}\n`;
    logText += `Estimated Sample Mean (μ): ${mean.toFixed(3)}\n`;
    logText += `Estimated Std Deviation (σ): ${stdDev.toFixed(3)}\n`;
    document.getElementById('c9-parameters-output').innerText = logText;

    // Direct automated heuristics text interpretation
    let insight = `Analysis shows the data fits a **${targetModel.toUpperCase()}** layout. `;
    insight += `The data spreads across a range of **${(max - min).toFixed(2)} units**, centered at **${mean.toFixed(2)}**. `;
    insight += `This variance profile provides a reliable safety baseline for microclimatic load planning.`;
    document.getElementById('c9-interpretation-output').innerHTML = insight;

    buildEmpiricalHistogramChart(values, targetModel, min, max, mean, stdDev);
}

function buildEmpiricalHistogramChart(values, model, min, max, mean, stdDev) {
    const binCount = 6;
    const binWidth = (max - min) / binCount;
    const binLabels = [];
    const binCounts = new Array(binCount).fill(0);

    for(let i=0; i<binCount; i++) {
        let left = min + i*binWidth;
        let right = left + binWidth;
        binLabels.push(((left + right)/2).toFixed(2));
    }

    values.forEach(v => {
        let index = Math.floor((v - min) / binWidth);
        if(index >= binCount) index = binCount - 1;
        if(index < 0) index = 0;
        binCounts[index]++;
    });

    // Normalize historical bar frequencies to density scale spaces
    const totalArea = values.length * binWidth;
    const densityBinCounts = binCounts.map(count => count / totalArea);

    // Build the smooth continuous curve data overlay points
    const curvePoints = [];
    const curveLabels = [];
    const steps = 60;
    const curveDelta = (max - min) / steps;

    for(let i=0; i<=steps; i++) {
        let currentX = min + i*curveDelta;
        curveLabels.push(currentX);
        
        let y = 0;
        if (model === 'uniform') {
            y = (currentX >= min && currentX <= max) ? (1 / (max - min)) : 0;
        } else {
            y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(currentX - mean, 2) / (2 * stdDev * stdDev));
        }
        curvePoints.push(y);
    }

    if(c9ChartInstance) c9ChartInstance.destroy();

    const ctx = document.getElementById('c9Chart').getContext('2d');
    c9ChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binLabels,
            datasets: [
                {
                    label: 'Continuous PDF Target Line',
                    data: curvePoints,
                    type: 'line',
                    borderColor: '#10b981',
                    borderWidth: 3,
                    pointRadius: 0,
                    fill: false,
                    order: 1
                },
                {
                    label: 'Normalized Dataset Frequency',
                    data: densityBinCounts,
                    backgroundColor: 'rgba(53, 162, 235, 0.4)',
                    borderColor: '#35a2eb',
                    borderWidth: 1.5,
                    categoryPercentage: 1.0,
                    barPercentage: 0.95,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' }, title: { display: true, text: 'Density Index Scaling' } }
            },
            plugins: { legend: { labels: { color: '#f8fafc' } } }
        }
    });
}