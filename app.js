let targetCoords = null;
let watchID = null;
let totalDistance = null;
const alarmAudio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

// 1. Pencarian Stasiun Gratis (Nominatim)
async function searchStation(query) {
    const resDiv = document.getElementById('search-results');
    if (query.length < 3) { resDiv.innerHTML = ''; return; }

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}+station+indonesia&limit=5`);
        const data = await response.json();
        resDiv.innerHTML = data.map(item => `
            <div class="result-item" onclick="selectStation(${item.lat}, ${item.lon}, '${item.display_name}')">
                ${item.display_name}
            </div>`).join('');
    } catch (e) { console.error("Error fetching data"); }
}

function selectStation(lat, lon, name) {
    targetCoords = { lat, lng: lon };
    document.getElementById('station-search').value = name;
    document.getElementById('search-results').innerHTML = '';
    document.getElementById('btn-start').disabled = false;
    addLog(`Tujuan disetel: ${name.split(',')[0]}`);
}

// 2. Logika Perhitungan & Tracking
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function startTracking() {
    Notification.requestPermission();
    addLog("Memulai pelacakan GPS...");

    watchID = navigator.geolocation.watchPosition((pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const dist = calculateDistance(latitude, longitude, targetCoords.lat, targetCoords.lng);
        
        if (totalDistance === null) totalDistance = dist;

        // Update UI
        document.getElementById('distance-info').innerText = `${dist.toFixed(2)} km`;
        
        // Estimasi waktu (Kecepatan default 50km/jam jika GPS diam)
        const currentSpeed = (speed && speed > 0.5) ? speed * 3.6 : 50; 
        const etaMin = Math.round((dist / currentSpeed) * 60);
        document.getElementById('eta').innerText = `${etaMin} min`;

        // Update Animasi Kereta
        let progress = ((totalDistance - dist) / totalDistance) * 85;
        document.getElementById('train-sprite').style.left = `${Math.max(5, Math.min(progress + 5, 90))}%`;

        // Cek jika tiba (Radius 800 meter)
        if (dist < 0.8) triggerArrival();

    }, null, { enableHighAccuracy: true });
}

function triggerArrival() {
    if ("vibrate" in navigator) navigator.vibrate([1000, 500, 1000, 500, 1000]);
    alarmAudio.play();
    new Notification("TIBA!", { body: "Anda sudah dekat stasiun tujuan!" });
    addLog("ALARM: Anda telah sampai!");
    navigator.geolocation.clearWatch(watchID);
}

function addLog(msg) {
    const logList = document.getElementById('travel-log');
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    
    if (logList.innerText.includes("Belum ada")) logList.innerHTML = '';
    const li = document.createElement('li');
    li.innerHTML = `<strong>[${timeStr}]</strong> ${msg}`;
    logList.prepend(li);
}
