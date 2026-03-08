let watchID;
const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'); // Gunakan URL suara atau file lokal

// Registrasi Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius Bumi (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Hasil dalam km
}

function startTracking() {
    if (!navigator.geolocation) {
        alert("GPS tidak didukung!");
        return;
    }

    // Meminta izin notifikasi
    Notification.requestPermission();

    const targetVal = document.getElementById('station-select').value.split(',');
    const destLat = parseFloat(targetVal[0]);
    const destLon = parseFloat(targetVal[1]);

    watchID = navigator.geolocation.watchPosition((position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const speed = position.coords.speed || 1; // Kecepatan m/s

        const dist = calculateDistance(userLat, userLon, destLat, destLon);
        
        document.getElementById('current-pos').innerText = `Lokasi Anda: ${userLat.toFixed(4)}, ${userLon.toFixed(4)}`;
        document.getElementById('distance-info').innerText = `Jarak ke tujuan: ${dist.toFixed(2)} km`;
        
        // Estimasi waktu (jarak / kecepatan)
        const etaMin = (dist / (speed * 0.06)).toFixed(1); 
        document.getElementById('eta').innerText = `Estimasi: ${etaMin} menit`;

        // Trigger jika jarak kurang dari 500 meter (0.5 km)
        if (dist < 0.5) {
            sendNotification();
        }
    }, (err) => {
        console.error(err);
    }, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
    });
}

function sendNotification() {
    if (Notification.permission === "granted") {
        new Notification("Tiba di Stasiun!", {
            body: "Anda sudah dekat dengan stasiun tujuan.",
            icon: "https://via.placeholder.com/192"
        });
        audio.play();
    }
    navigator.geolocation.clearWatch(watchID);
}