// Global Variables
let audioContext, analyser, dataArray, animationId, noiseChart;
let sleepSessionData = [], dbData = [], labels = [];
let noiseFloor = 45; 
let historyBuffer = [];

// DOM Elements
const volumeDisplay = document.getElementById('volume-display');
const statusDisplay = document.getElementById('detection-status');
const statusCont = document.getElementById('status-container');
const mainCard = document.getElementById('main-card');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const exportDropdown = document.getElementById('export-dropdown');

// Initialize Chart.js
const ctx = document.getElementById('noiseChart').getContext('2d');
noiseChart = new Chart(ctx, {
    type: 'line',
    data: { 
        labels: labels, 
        datasets: [{ 
            data: dbData, 
            borderColor: '#38bdf8', 
            fill: true, 
            backgroundColor: 'rgba(56,189,248,0.1)', 
            pointRadius: 0, 
            borderWidth: 2 
        }] 
    },
    options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        scales: { y: { min: 20, max: 100, display: false }, x: { display: false } }, 
        plugins: { legend: { display: false } } 
    }
});

// START TRACKING
async function startTracking() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(stream);
        
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Screen Wake Lock
        if ('wakeLock' in navigator) await navigator.wakeLock.request('screen');

        // UI Updates
        startBtn.disabled = true;
        stopBtn.disabled = false;
        exportDropdown.style.display = 'none';
        mainCard.classList.add('active-tracking');
        
        updateData();
    } catch (err) {
        console.error(err);
        alert("Microphone access denied. Please use HTTPS or localhost.");
    }
}

// STOP TRACKING
function stopTracking() {
    cancelAnimationFrame(animationId);
    if(audioContext) audioContext.close();
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    exportDropdown.style.display = 'block';
    mainCard.classList.remove('active-tracking');
    statusDisplay.innerText = "Tracking Stopped";
    statusCont.className = "status-badge busy";
}

// AUDIO ANALYSIS LOOP
function updateData() {
    analyser.getByteFrequencyData(dataArray);
    const nyquist = audioContext.sampleRate / 2;
    const binSize = nyquist / dataArray.length;

    let sSum = 0, tSum = 0, oSum = 0, sC = 0, tC = 0, oC = 0;

    for (let i = 0; i < dataArray.length; i++) {
        const freq = i * binSize;
        if (freq >= 40 && freq < 600) { sSum += dataArray[i]; sC++; } // Snore
        else if (freq >= 600 && freq <= 2000) { tSum += dataArray[i]; tC++; } // Talk
        else { oSum += dataArray[i]; oC++; } // Noise
    }

    const avgS = sSum / sC, avgT = tSum / tC, avgO = oSum / oC;
    const currentMax = Math.max(avgS, avgT);
    const now = new Date().toLocaleTimeString();

    // Adaptive Noise Floor Logic
    historyBuffer.push(currentMax);
    if (historyBuffer.length > 150) {
        let minInHistory = Math.min(...historyBuffer);
        let maxInHistory = Math.max(...historyBuffer);
        if (maxInHistory - minInHistory < 6) {
            noiseFloor = (noiseFloor * 0.8) + (maxInHistory * 0.2);
            historyBuffer = [];
        }
        historyBuffer.shift();
    }

    // Detection Classification
    statusCont.className = "status-badge active";
    volumeDisplay.style.color = "#fff";
    let status = "Listening...";

    if (avgS > noiseFloor + 12 && avgS > avgT * 1.3) {
        status = "💤 Snoring Detected";
        statusCont.classList.add('snore');
        volumeDisplay.style.color = "#facc15";
        logData("Snoring", Math.round(avgS));
    } else if (avgT > noiseFloor + 12 && avgT > avgO * 1.5) {
        status = "🗣️ Sleep Talking";
        statusCont.classList.add('talk');
        volumeDisplay.style.color = "#ef4444";
        logData("Talking", Math.round(avgT));
    } else if (currentMax < noiseFloor + 5) {
        status = "🍃 Silent";
        statusCont.className = "status-badge hening";
    }

    volumeDisplay.innerHTML = `${Math.round(currentMax)}<span class="unit">dB</span>`;
    statusDisplay.innerText = status;

    // Chart Update
    if (dbData.length > 40) { dbData.shift(); labels.shift(); }
    dbData.push(currentMax); 
    labels.push(now);
    noiseChart.update('none');

    animationId = requestAnimationFrame(updateData);
}

function logData(type, level) {
    const time = new Date().toLocaleTimeString();
    const last = sleepSessionData[sleepSessionData.length - 1];
    if (!last || (Date.now() - last.ts > 3000)) {
        sleepSessionData.push({ time, type, level, ts: Date.now() });
    }
}

// EVENT LISTENERS
startBtn.addEventListener('click', startTracking);
stopBtn.addEventListener('click', stopTracking);

// EXPORT FUNCTIONS
document.getElementById('exportTxt').onclick = () => {
    let summary = `SLEEPGUARD PRO - SESSION REPORT\nDate: ${new Date().toLocaleDateString()}\n\n`;
    sleepSessionData.forEach(r => summary += `[${r.time}] ${r.type}: ${r.level} dB\n`);
    const blob = new Blob([summary], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `SleepReport_${Date.now()}.txt`;
    a.click();
};

document.getElementById('exportPdf').onclick = async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(22); doc.text("SleepGuard Pro Report", 20, 20);
    doc.setFontSize(10); doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);
    
    const chartImg = document.getElementById('noiseChart').toDataURL('image/png');
    doc.addImage(chartImg, 'PNG', 20, 40, 170, 60);

    const body = sleepSessionData.map(r => [r.time, r.type, `${r.level} dB`]);
    doc.autoTable({ startY: 110, head: [['Time', 'Activity', 'Level']], body: body });
    
    doc.save(`SleepReport_${Date.now()}.pdf`);
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
