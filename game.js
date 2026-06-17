const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiOverlay = document.getElementById('ui-overlay');
const startBtn = document.getElementById('start-btn');
const overlayTitle = document.getElementById('overlay-title');
const scoreDisplay = document.getElementById('score-display');
const charUpload = document.getElementById('char-upload');
const uploadBox = document.getElementById('upload-box');
const charPreview = document.getElementById('char-preview');
const previewContainer = document.getElementById('preview-container');
const resetCharBtn = document.getElementById('reset-char-btn');
const clearScoresBtn = document.getElementById('clear-scores-btn');
const playerNameInput = document.getElementById('player-name');
const nameBox = document.getElementById('name-box');

const cropModal = document.getElementById('crop-modal');
const imageToCrop = document.getElementById('image-to-crop');
const cancelCropBtn = document.getElementById('cancel-crop-btn');
const cropDoneBtn = document.getElementById('crop-done-btn');

const adminModal = document.getElementById('admin-modal');
const adminCloseCross = document.getElementById('admin-close-cross');
const adminOkBtn = document.getElementById('admin-ok-btn');
const adminPasswordInput = document.getElementById('admin-password-input');

// Optimasi Retina Display / HDPI Anti-Blur
const dpr = window.devicePixelRatio || 1;
const logicalWidth = 400;
const logicalHeight = 550;
canvas.width = logicalWidth * dpr;
canvas.height = logicalHeight * dpr;
ctx.scale(dpr, dpr);

// State Game Utama
let gameRunning = false;
let score = 0;
let pipes = [];
let particles = [];
let clouds = [];
let customImage = null;
const defaultBirdImage = new Image();
defaultBirdImage.src = 'bird.png';
let cropperInstance = null;
let current_player_name = "Player";
let current_player_city = "Luar Kota"; 
let frameCount = 0;

// Konfigurasi Gameplay
const gravity = 0.24;
const jumpStrength = -5.3;
const pipeSpeed = 2.4;
const pipeSpawnRate = 95; 
const pipeGap = 145;

// Fallback keamanan jika auth.js tidak termuat sempurna
if (typeof verifyAdminPassword === 'undefined') {
    window.verifyAdminPassword = function(pass) {
        return pass === "valdydewa123";
    };
}

// =========================================================
// ⚠️ KONFIGURASI DATABASE FIREBASE ONLINE
// =========================================================
const firebaseConfig = {
  apiKey: "AIzaSyDD5LfrXrHE0uF-1toDrNTqC4QJyhLOKg4",
  authDomain: "sky-flappy-game.firebaseapp.com",
  projectId: "sky-flappy-game",
  storageBucket: "sky-flappy-game.firebasestorage.app",
  messagingSenderId: "167958907568",
  appId: "1:167958907568:web:e21673e5f7a26382e5c975"
};

let useOnlineDatabase = false;
let db;

try {
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "MASUKKAN_API_KEY_ANDA") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        useOnlineDatabase = true;
        console.log("Firebase berhasil terhubung!");
    } else {
        console.warn("Firebase Config belum diisi atau SDK tidak termuat. Beralih ke database offline lokal.");
    }
} catch (e) {
    console.error("Gagal memuat Firebase:", e);
}

// =========================================================
// OTO-DETEKSI LOKASI PEMAIN (IP GEOLOCATION)
// =========================================================
function autoDetectCity() {
    fetch('https://ipapi.co/json/')
        .then(response => response.json())
        .then(data => {
            if (data && data.city) {
                current_player_city = data.city;
                console.log("Lokasi terdeteksi otomatis:", current_player_city);
            }
        })
        .catch(err => {
            console.warn("Gagal melacak lokasi IP, beralih ke default:", err);
        });
}

// =========================================================
// SYSTEM DATABASE HYBRID
// =========================================================
function saveScore(playerName, playerCity, newScore) {
    if (newScore <= 0) return;
    if (useOnlineDatabase && db) {
        db.collection("leaderboard").add({
            name: playerName,
            city: playerCity, 
            score: newScore,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => {
            console.error("Gagal simpan online, simpan cadangan lokal:", err);
            saveScoreOfflineStorage(playerName, playerCity, newScore);
        });
    } else {
        saveScoreOfflineStorage(playerName, playerCity, newScore);
    }
}

function saveScoreOfflineStorage(playerName, playerCity, newScore) {
    let scores = getOfflineScores();
    const existingPlayerIndex = scores.findIndex(item => item.name.toLowerCase() === playerName.toLowerCase());
    if (existingPlayerIndex !== -1) {
        if (newScore > scores[existingPlayerIndex].score) {
            scores[existingPlayerIndex].score = newScore;
            scores[existingPlayerIndex].city = playerCity; 
        } else {
            return; 
        }
    } else {
        scores.push({ name: playerName, city: playerCity, score: newScore });
    }
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 10);
    localStorage.setItem('sky_flappy_hybrid_scores', JSON.stringify(scores));
    renderOfflineLeaderboard();
}

function getOfflineScores() {
    const scores = localStorage.getItem('sky_flappy_hybrid_scores');
    return scores ? JSON.parse(scores) : [];
}

function renderOfflineLeaderboard() {
    const scores = getOfflineScores();
    updateLeaderboardUI(scores, false);
}

function updateLeaderboardUI(dataSnapshot, isOnline) {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;
    leaderboardList.innerHTML = '';
    let count = 0;
    let processedScores = [];

    if (isOnline && dataSnapshot) {
        let uniquePlayers = {};
        dataSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data && data.name) {
                const pName = data.name.trim();
                const pCity = data.city ? data.city.trim() : "Luar Kota";
                const pScore = data.score || 0;
                if (!uniquePlayers[pName] || pScore > uniquePlayers[pName].score) {
                    uniquePlayers[pName] = { score: pScore, city: pCity };
                }
            }
        });
        for (let name in uniquePlayers) {
            processedScores.push({ name: name, city: uniquePlayers[name].city, score: uniquePlayers[name].score });
        }
        processedScores.sort((a, b) => b.score - a.score);
    } else {
        processedScores = Array.isArray(dataSnapshot) ? dataSnapshot : [];
    }

    const topTenScores = processedScores.slice(0, 10);
    topTenScores.forEach((item) => {
        count++;
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="player-info-block">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.name}">#${count} ${item.name}</span>
                <span class="player-city-text">📍 ${item.city || 'Luar Kota'}</span>
            </div>
            <span>${item.score} pts</span>
        `;
        leaderboardList.appendChild(li);
    });
    for (let i = count; i < 10; i++) {
        const li = document.createElement('li');
        li.innerHTML = `<div><span>#${i + 1} ----</span></div> <span>- pts</span>`;
        leaderboardList.appendChild(li);
    }
}

function clearAllScoresData() {
    if (useOnlineDatabase && db) {
        db.collection("leaderboard").get().then((snapshot) => {
            const batch = db.batch();
            snapshot.forEach((doc) => { batch.delete(doc.ref); });
            return batch.commit();
        });
    } else {
        localStorage.removeItem('sky_flappy_hybrid_scores');
        renderOfflineLeaderboard();
    }
}

function preloadLeaderboardSystem() {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (leaderboardList) {
        leaderboardList.innerHTML = '<li style="justify-content: center; color: #64748b; font-weight:600;">⏳ Memuat skor global...</li>';
    }
    if (useOnlineDatabase && db) {
        db.collection("leaderboard").orderBy("score", "desc").onSnapshot((snapshot) => {
            updateLeaderboardUI(snapshot, true);
        }, (error) => {
            console.error("Firebase Snapshot error, beralih ke offline:", error);
            useOnlineDatabase = false;
            renderOfflineLeaderboard();
        });
    } else {
        renderOfflineLeaderboard();
    }
}

// =========================================================
// MODEL OBJEK GAMEPLAY
// =========================================================
const bird = {
    x: 85,
    y: 220, 
    radius: 16,
    velocity: 0,
    angle: 0,
    history: [], 
    
    draw() {
        if (gameRunning) {
            for (let i = 0; i < this.history.length; i++) {
                let pos = this.history[i];
                let alpha = (i + 1) / (this.history.length + 1) * 0.15;
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.translate(pos.x, pos.y);
                ctx.rotate(pos.angle);
                this.drawKarakterInti();
                ctx.restore();
            }
        }
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        this.drawKarakterInti();
        ctx.restore();
    },

    drawKarakterInti() {
        if (customImage && customImage.complete) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(customImage, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
        } else if (defaultBirdImage && defaultBirdImage.complete && defaultBirdImage.width > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(defaultBirdImage, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            let gradient = ctx.createRadialGradient(-4, -4, 2, 0, 0, this.radius);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.3, '#34d399');
            gradient.addColorStop(0.8, '#059669');
            gradient.addColorStop(1, '#064e3b');
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(-3, -3, 6, 3, Math.PI / 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fill();
        }
    },
    
    update() {
        if (!gameRunning) {
            this.y = 220;
            this.velocity = 0;
            this.angle = 0;
            this.history = [];
            return;
        }
        this.velocity += gravity;
        this.y += this.velocity;
        this.history.push({ x: this.x, y: this.y, angle: this.angle });
        if (this.history.length > 4) this.history.shift();
        this.angle = Math.min(Math.PI / 5, Math.max(-Math.PI / 7, this.velocity * 0.05));
        if (this.y + this.radius > logicalHeight - 45) {
            this.y = logicalHeight - 45 - this.radius;
            gameOver();
        }
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.velocity = 0;
        }
    },
    
    jump() {
        if (gameRunning) {
            this.velocity = jumpStrength;
            for(let i=0; i<5; i++) {
                particles.push(new Particle(this.x - 5, this.y, '#60a5fa'));
            }
        }
    }
};

class Cloud {
    constructor(x = logicalWidth + 70) {
        this.x = x;
        this.y = Math.random() * 160 + 20;
        this.baseSize = Math.random() * 25 + 20;
        this.speed = Math.random() * 0.3 + 0.15;
    }
    update() { this.x -= this.speed; }
    draw() {
        ctx.save();
        ctx.shadowColor = 'rgba(15, 23, 42, 0.03)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 3;
        let cloudGrad = ctx.createLinearGradient(this.x, this.y - this.baseSize, this.x, this.y + this.baseSize);
        cloudGrad.addColorStop(0, '#ffffff');
        cloudGrad.addColorStop(0.7, '#ffffff');
        cloudGrad.addColorStop(1, '#e2e8f0');
        ctx.fillStyle = cloudGrad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.baseSize, 0, Math.PI * 2);
        ctx.arc(this.x + this.baseSize * 0.65, this.y - this.baseSize * 0.25, this.baseSize * 0.8, 0, Math.PI * 2);
        ctx.arc(this.x - this.baseSize * 0.65, this.y + this.baseSize * 0.1, this.baseSize * 0.7, 0, Math.PI * 2);
        ctx.arc(this.x + this.baseSize * 1.2, this.y + this.baseSize * 0.15, this.baseSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.8) * 3 - 1;
        this.speedY = (Math.random() - 0.5) * 3;
        this.color = color;
        this.alpha = 1;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.alpha -= 0.025;
    }
    draw() {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

// KUNCI VISUAL PIPA (TIDAK BERUBAH)
class Pipe {
    constructor() {
        this.topHeight = Math.random() * (logicalHeight - pipeGap - 180) + 60;
        this.bottomHeight = logicalHeight - this.topHeight - pipeGap - 45;
        this.x = logicalWidth;
        this.width = 68; 
        this.passed = false;
    }

    drawPipeSegment(yStart, height, isTop) {
        ctx.save();
        
        let bodyGrad = ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
        bodyGrad.addColorStop(0, '#10b981');    
        bodyGrad.addColorStop(0.25, '#a7f3d0'); 
        bodyGrad.addColorStop(0.55, '#10b981'); 
        bodyGrad.addColorStop(1, '#065f46');    

        ctx.fillStyle = bodyGrad;
        ctx.fillRect(this.x, yStart, this.width, height);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(this.x, yStart, this.width, height);

        let lipX = this.x - 3.5;
        let lipWidth = this.width + 7; 
        let lipHeight = 26;
        let lipY = isTop ? (yStart + height - lipHeight) : yStart;

        let lipGrad = ctx.createLinearGradient(lipX, 0, lipX + lipWidth, 0);
        lipGrad.addColorStop(0, '#0d9467');    
        lipGrad.addColorStop(0.25, '#85dbae'); 
        lipGrad.addColorStop(0.55, '#0d9467'); 
        lipGrad.addColorStop(1, '#043f2e');    

        ctx.fillStyle = lipGrad;
        ctx.fillRect(lipX, lipY, lipWidth, lipHeight);
        ctx.strokeRect(lipX, lipY, lipWidth, lipHeight);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        let lineY = isTop ? (lipY + 6) : (lipY + lipHeight - 10);
        ctx.fillRect(lipX + 2, lineY, lipWidth - 4, 4);

        ctx.restore();
    }

    draw() {
        this.drawPipeSegment(0, this.topHeight, true);
        this.drawPipeSegment(logicalHeight - 45 - this.bottomHeight, this.bottomHeight, false);
    }

    update() { this.x -= pipeSpeed; }
    collidesWith(birdObj) {
        let birdLeft = birdObj.x - birdObj.radius + 3;
        let birdRight = birdObj.x + birdObj.radius - 3;
        let birdTop = birdObj.y - birdObj.radius + 3;
        let birdBottom = birdObj.y + birdObj.radius - 3;
        if (birdRight > this.x && birdLeft < this.x + this.width) {
            if (birdTop < this.topHeight) return true;
            if (birdBottom > logicalHeight - 45 - this.bottomHeight) return true;
        }
        return false;
    }
}

for (let i = 0; i < 4; i++) {
    clouds.push(new Cloud(Math.random() * logicalWidth));
}

function startGame() {
    if (gameRunning) return; 

    let inputName = playerNameInput.value.trim();
    if (inputName !== "") {
        current_player_name = inputName;
    } else {
        const randomId = Math.floor(1000 + Math.random() * 9000); 
        current_player_name = "Player-" + randomId;
        playerNameInput.value = current_player_name; 
    }
    
    canvas.focus(); 
    bird.y = 220;
    bird.velocity = 0;
    bird.angle = 0;
    bird.history = [];
    pipes = [];
    particles = [];
    score = 0;
    frameCount = 0;
    scoreDisplay.textContent = score;
    scoreDisplay.classList.remove('score-pop'); 
    nameBox.style.display = 'none';
    uiOverlay.style.opacity = '0';
    setTimeout(() => { uiOverlay.style.visibility = 'hidden'; }, 300);
    setTimeout(() => { gameRunning = true; }, 12);
}

function gameOver() {
    if (gameRunning) {
        gameRunning = false;
        saveScore(current_player_name, current_player_city, score); 
        for(let i=0; i<15; i++) {
            particles.push(new Particle(bird.x, bird.y, '#ef4444'));
        }
        nameBox.style.display = 'block';
        uiOverlay.style.visibility = 'visible';
        uiOverlay.style.opacity = '1';
        overlayTitle.innerHTML = `GAME OVER<br><span style="font-size: 15px; color: #475569; font-weight:700;">${current_player_name}: ${score} pts</span>`;
        startBtn.textContent = 'Main Lagi';
    }
}

function animate() {
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    
    let skyGrad = ctx.createLinearGradient(0, 0, 0, logicalHeight);
    skyGrad.addColorStop(0, '#bae6fd');
    skyGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    
    if (gameRunning) {
        frameCount++;
        if (frameCount % 220 === 0) clouds.push(new Cloud());
    }
    for (let i = clouds.length - 1; i >= 0; i--) {
        if (gameRunning) clouds[i].update();
        clouds[i].draw();
        if (clouds[i].x + 100 < 0) clouds.splice(i, 1);
    }
    if (gameRunning) {
        if (pipes.length === 0 || frameCount % pipeSpawnRate === 0) {
            pipes.push(new Pipe());
        }
    }
    bird.update();
    bird.draw();
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].alpha <= 0) particles.splice(i, 1);
    }
    for (let i = pipes.length - 1; i >= 0; i--) {
        if (gameRunning) {
            pipes[i].update();
            if (pipes[i].collidesWith(bird)) gameOver();
            if (!pipes[i].passed && pipes[i].x + pipes[i].width < bird.x) {
                score++;
                pipes[i].passed = true;
                scoreDisplay.textContent = score;
                
                scoreDisplay.classList.remove('score-pop');
                void scoreDisplay.offsetWidth; 
                scoreDisplay.classList.add('score-pop');
            }
        }
        pipes[i].draw();
        if (pipes[i].x + pipes[i].width < -20) pipes.splice(i, 1);
    }
    
    ctx.fillStyle = '#239169';
    ctx.fillRect(0, logicalHeight - 45, logicalWidth, 45);
    
    ctx.strokeStyle = '#181a1b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, logicalHeight - 45);
    ctx.lineTo(logicalWidth, logicalHeight - 45);
    ctx.stroke();

    requestAnimationFrame(animate);
}

charUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            imageToCrop.src = event.target.result;
            cropModal.classList.add('active');
            if (cropperInstance) cropperInstance.destroy();
            cropperInstance = new Cropper(imageToCrop, {
                aspectRatio: 1, viewMode: 1, dragMode: 'move', background: false, autoCropArea: 0.8
            });
        };
        reader.readAsDataURL(file);
    }
});

cropDoneBtn.addEventListener('click', () => {
    if (cropperInstance) {
        const croppedCanvas = cropperInstance.getCroppedCanvas({ width: 120, height: 120 });
        customImage = new Image();
        customImage.src = croppedCanvas.toDataURL();
        customImage.onload = function() {
            charPreview.src = customImage.src;
            previewContainer.style.display = 'flex';
            uploadBox.querySelector('.upload-label').style.display = 'none';
            cropModal.classList.remove('active');
        };
    }
});

cancelCropBtn.addEventListener('click', () => {
    cropModal.classList.remove('active');
    charUpload.value = '';
});

resetCharBtn.addEventListener('click', (e) => {
    e.preventDefault();
    customImage = null;
    charUpload.value = '';
    previewContainer.style.display = 'none';
    uploadBox.querySelector('.upload-label').style.display = 'flex';
});

playerNameInput.addEventListener('keydown', (e) => {
    e.stopPropagation(); 
    if (e.code === 'Enter') startGame();
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameRunning) bird.jump();
        else if (uiOverlay.style.visibility !== 'hidden' && uiOverlay.style.opacity === '1') startGame();
    }
});

canvas.addEventListener('click', () => { if (gameRunning) bird.jump(); });

canvas.addEventListener('touchstart', (e) => {
    if (gameRunning) {
        if (e.touches.length === 1) {
            e.preventDefault(); 
            bird.jump();
        }
    }
}, { passive: false });

// =========================================================================
// 🌟 SOLUSI TOTAL SATU KALI KLIK INSTAN MAIN (BEBAS RESTRIKSI FULLSCREEN)
// =========================================================================
function handleStartButtonTrigger(e) {
    e.preventDefault();
    e.stopPropagation();
    startGame();
}

// Ikat langsung menggunakan event pointer mobile & desktop untuk bypass delay browser 300ms
startBtn.addEventListener('touchstart', handleStartButtonTrigger, { passive: false });
startBtn.addEventListener('click', handleStartButtonTrigger);

clearScoresBtn.addEventListener('click', () => {
    adminPasswordInput.value = ''; 
    adminModal.classList.add('active'); 
});

adminCloseCross.addEventListener('click', () => {
    adminModal.classList.remove('active');
});

adminOkBtn.addEventListener('click', () => {
    const passwordInputValue = adminPasswordInput.value.trim();
    if (passwordInputValue === "") {
        adminModal.classList.remove('active');
        return;
    }
    if (verifyAdminPassword(passwordInputValue)) {
        adminModal.classList.remove('active'); 
        if (confirm("Yakin ingin menghapus seluruh skor?")) {
            clearAllScoresData();
        }
    } else {
        alert("Kata sandi salah!");
        adminPasswordInput.value = ''; 
    }
});

adminPasswordInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Enter') adminOkBtn.click();
});

document.addEventListener('DOMContentLoaded', () => {
    preloadLeaderboardSystem();
    autoDetectCity(); 
    if (playerNameInput) playerNameInput.focus();
});

animate();
