/* ======================================================
   game.js - SmartOne Finance (final: absolute pions)
   - Menyusun ulang token system: pindah dari inside-tile -> absolute overlay
   - Mempertahankan semua logika game sebelumnya
====================================================== */

const diceEl = document.getElementById("dice");

// SmartOne Finance — Versi 4.0 (Sinkron 4-Sudut)
/* eslint-disable */
const boardEl = document.getElementById("board");
const rollBtn = document.getElementById("rollBtn");
const diceValueEl = document.getElementById("diceValue");
const turnInfoEl = document.getElementById("turnInfo");
const startBtn = document.getElementById("startBtn");
const playerCountSel = document.getElementById("playerCount");
const categorySel = document.getElementById("categorySel");
const quizModal = document.getElementById("quizModal");
const quizQuestion = document.getElementById("quizQuestion");
const quizChoices = document.getElementById("quizChoices");
const quizSubmit = document.getElementById("quizSubmit");

// --- MODIFIKASI 1: Ambil Elemen Baru ---
// Panel Info Pemain (4 Sudut)
const playerInfoBoxes = [
  document.getElementById("player1-info"),
  document.getElementById("player2-info"),
  document.getElementById("player3-info"),
  document.getElementById("player4-info")
];
// Dadu (di tengah)
const diceOverlayEl = document.getElementById("diceOverlay");
// Pion absolute (harus ada di HTML)
const pionEls = [
  document.getElementById("pion1"),
  document.getElementById("pion2"),
  document.getElementById("pion3"),
  document.getElementById("pion4"),
];
// wrapper
const boardWrapper = document.getElementById("board-wrapper");
// --- Akhir Modifikasi 1 ---


// --- Board shape: 6x6 outer ring (20 tiles) ---
const gridSize = 6;
const path = [];
for (let c = 0; c < gridSize; c++) path.push([0, c]);
for (let r = 1; r < gridSize; r++) path.push([r, gridSize - 1]);
for (let c = gridSize - 2; c >= 0; c--) path.push([gridSize - 1, c]);
for (let r = gridSize - 2; r >= 1; r--) path.push([r, 0]);

// Jenis tile
const T = {
  START: "start",
  INCOME: "income",
  EXPENSE: "expense",
  TAX: "tax",
  SAVE: "save",
  BONUS: "bonus",
  PENALTY: "penalty",
};

// --- Variabel Global untuk Data ---
let allGameData = null;
let currentTiles = [];
let currentQuizBank = [];        // fallback (legacy)
let currentQuizLevels = null;    // ⭐ UPDATE: akan menampung quizLevels jika tersedia
let currentEduText = {};

// Pemain
const tokenColors = ["#22d3ee", "#fbbf24", "#ef4444", "#22c55e"];
let players = [];
let turn = 0;
let started = false;

// --- ⭐ UPDATE: Konfigurasi Level & Bonus ---
const LEVEL_THRESHOLDS = { // minimal poin untuk naik ke level selanjutnya
  2: 130000, // level 1 -> 2
  3: 300000  // level 2 -> 3
};
const BONUS_BY_LEVEL = {  // bonus jawaban benar per level (disepakati)
  1: 15000,
  2: 8000,
  3: 5000
};
// --- akhir update ---

// --- FUNGSI BARU: Load Data Game dari JSON ---
async function loadGameData() {
  try {
    const response = await fetch("data_game.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    allGameData = await response.json();
    populateCategorySelect();

    startBtn.disabled = false;
    startBtn.textContent = "YOK Mulai"; // <-- Ganti teks tombol

  } catch (err) {
    console.error("Gagal memuat data_game.json:", err);
    turnInfoEl.textContent = "Error: Gagal memuat data. Coba refresh halaman.";
  }
}

// --- FUNGSI BARU: Mengisi Dropdown Kategori ---
function populateCategorySelect() {
  if (!allGameData) return;
  categorySel.innerHTML = "";
  const categories = Object.keys(allGameData.kategori);
  categories.forEach(key => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = allGameData.kategori[key].nama;
    categorySel.appendChild(option);
  });
}

// --- MODIFIKASI 3: Render papan ---
function renderBoard() {
  boardEl.innerHTML = "";
  // Sembunyikan dadu di tengah papan dulu
  diceOverlayEl.style.display = 'none';

  const cells = new Map();
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = document.createElement("div");
      cell.className = "tile void"; // <-- Petak tengah akan disembunyikan CSS
      cell.dataset.pos = `${r}-${c}`;
      boardEl.appendChild(cell);
      cells.set(`${r}-${c}`, cell);
    }
  }
  path.forEach((coord, i) => {
    const [r, c] = coord;
    const cell = cells.get(`${r}-${c}`);
    const t = currentTiles[i % currentTiles.length] || { title: "?", effect: "", type: "income" };

    cell.className = `tile ${t.type}`; // <-- CSS akan otomatis nampilin ini
    cell.innerHTML = `
      <div class="title">${t.title}</div>
      <div class="effect">${t.effect || ""}</div>
      <div class="tokens" data-idx="${i}"></div>`;
  });

  // Force reposition pions (jika sudah ada pemain)
  setTimeout(() => {
    placeAllPions();
  }, 0);

  // Tampilkan dadu setelah papan jadi
  diceOverlayEl.style.display = 'flex';
}
// --- Akhir Modifikasi 3 ---


// =====================
// Player management
// =====================
function createPlayers(n = 2) {
  players = Array.from({ length: n }).map((_, i) => ({
    id: i,
    name: `P${i + 1}`,
    color: tokenColors[i % tokenColors.length],
    pos: 0,
    points: 50000,
    savingsPoints: 0,
    laps: 0,
    // ⭐ UPDATE: level awal dan used questions per level
    level: 1,
    usedQuestions: { 1: new Set(), 2: new Set(), 3: new Set() }
  }));
  updatePlayersPanel();
  placeAllPions(); // place initial pions
}

// --- MODIFIKASI 2: Ganti Total updatePlayersPanel ---
function updatePlayersPanel() {
  // Sembunyikan semua panel info dulu
  playerInfoBoxes.forEach(box => box.style.display = 'none');

  // Tampilkan panel sesuai jumlah pemain
  players.forEach((p, index) => {
    const box = playerInfoBoxes[index];
    if (!box) return; // Jaga-jaga

    box.style.display = 'block'; // Tampilkan panel
    box.innerHTML = `
      <strong>${p.name}</strong><br>
      Level: ${p.level} <br> 
      Skor: ${fmt(p.points)}<br>
      Tabungan: ${fmt(p.savingsPoints)}<br>
      Putaran: ${p.laps}`;

    // Set warna border sesuai token
    box.style.borderColor = p.color;
  });
}
// --- Akhir Modifikasi 2 ---


function currentPlayer() {
  return players[turn % players.length];
}
function nextTurn() {
  turn = (turn + 1) % players.length;
  setTurnInfo();
}
function setTurnInfo() {
  const p = currentPlayer();
  turnInfoEl.textContent = `Giliran: ${p.name} — Skor ${fmt(
    p.points
  )} | Tabungan ${fmt(p.savingsPoints)}`;
}


// =====================
// PION ABSOLUTE: posisi & helper
// =====================

// Dapatkan elemen tile by r,c
function tileElementAt(r, c) {
  return boardEl.querySelector(`.tile[data-pos="${r}-${c}"]`);
}

// Update satu pion berdasarkan player.pos
function updatePionPosition(player) {
  const pion = pionEls[player.id];
  if (!pion || !boardEl) return;

  // gunakan path untuk menemukan r,c
  const idx = player.pos % path.length;
  const [r, c] = path[idx];

  const tile = tileElementAt(r, c);
  if (!tile) {
    // kalau tile tidak ada (edge-case), letakkan di 0,0
    pion.style.left = `0px`;
    pion.style.top = `0px`;
    return;
  }

  const boardRect = boardEl.getBoundingClientRect();
  const tileRect = tile.getBoundingClientRect();

  // pos relative to board
  const left = tileRect.left - boardRect.left + tileRect.width / 2 - (pion.offsetWidth || 18) / 2;
  const top = tileRect.top - boardRect.top + tileRect.height / 2 - (pion.offsetHeight || 18) / 2;

  pion.style.left = `${Math.round(left)}px`;
  pion.style.top = `${Math.round(top)}px`;
}

// Pindahkan semua pion
function placeAllPions() {
  // only for active players
  players.forEach((p) => {
    // set pion color (safety)
    const el = pionEls[p.id];
    if (el) {
      el.style.background = p.color;
      el.style.display = 'block';
    }
    updatePionPosition(p);
  });

  // hide unused pion elements
  for (let i = players.length; i < pionEls.length; i++) {
    const el = pionEls[i];
    if (el) el.style.display = 'none';
  }
}

// reposition pions on resize (so they stay in correct place)
window.addEventListener("resize", () => {
  // slight debounce
  if (typeof window._pionResizeTimeout !== "undefined") clearTimeout(window._pionResizeTimeout);
  window._pionResizeTimeout = setTimeout(() => {
    placeAllPions();
  }, 120);
});

// =====================
// Flow / Movement
// =====================

function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}
function applyStartBonus(player) {
  player.points += 10000;
  toast(`${player.name} melewati START: +10.000 Poin`);
}

// --- resolveTile (MODIFIKASI) ---
function resolveTile(player) {
  const tile = currentTiles[player.pos % currentTiles.length];
  showEdu(tile.type);

  switch (tile.type) {
    case T.INCOME:
      player.points += tile.points;
      toast(`${player.name}: ${tile.title} ${toPoinStr(tile.points)}`);
      break;
    case T.EXPENSE:
      player.points += tile.points;
      toast(`${player.name}: ${tile.title} ${toPoinStr(tile.points)}`);
      break;
    case T.TAX: {
      const cut = Math.floor(player.points * (tile.percent / 100));
      player.points -= cut;
      toast(`${player.name}: Bayar ${tile.title} ${toPoinStr(-cut)}`);
      break;
    }
    case T.SAVE:
      if (player.points >= tile.points) {
        player.points -= tile.points;
        player.savingsPoints += tile.points;
        toast(`${player.name}: Menabung ${toPoinStr(tile.points)}`);
      } else {
        toast(`${player.name}: Poin kurang untuk menabung.`);
      }
      break;
    case T.BONUS:
      toast(`${player.name}: ${tile.title}!`);
      handleQuiz(player);
      break;
    case T.PENALTY:
      player.points += tile.points;
      toast(`${player.name}: Denda ${tile.title} ${toPoinStr(tile.points)}`);
      break;
    case T.START:
      toast(`${player.name} di START.`);
  }
  updatePlayerLevel(player);
  updatePlayersPanel();
}

function fmt(n) {
  return n.toLocaleString("id-ID");
}
function toPoinStr(n) {
  return (n < 0 ? "-" : "+") + " " + Math.abs(n).toLocaleString("id-ID") + " Poin";
}
function toast(msg) {
  diceValueEl.textContent = msg;
  diceValueEl.classList.remove("money-pop-anim", "money-gain", "money-loss");
  if (msg.includes("+")) {
    diceValueEl.classList.add("money-gain");
  } else if (msg.includes("-")) {
    diceValueEl.classList.add("money-loss");
  }
  void diceValueEl.offsetWidth;
  diceValueEl.classList.add("money-pop-anim");
  setTimeout(() => {
    diceValueEl.classList.remove("money-gain", "money-loss");
  }, 800);
}

// --- showEdu (MODIFIKASI) ---
function showEdu(type) {
  const popup = document.getElementById("eduPopup");
  const msg = currentEduText[type];
  if (!msg) return;
  popup.textContent = msg;
  popup.classList.add("show");
  setTimeout(() => {
    popup.classList.remove("show");
  }, 4500);
}

function highlightLanding(index) {
  const tile = boardEl
    .querySelector(`.tokens[data-idx="${index}"]`)
    ?.closest(".tile");
  if (!tile) return;
  tile.classList.add("highlight");
  setTimeout(() => tile.classList.remove("highlight"), 1200);
}

// --- askQuiz (MODIFIKASI) ---
function askQuiz(bank) {
  return new Promise((resolve) => {
    const item = bank[Math.floor(Math.random() * bank.length)];

    if (!item) {
      toast("Tidak ada kuis tersedia.");
      return resolve(null);
    }

    quizQuestion.textContent = item.q;
    quizChoices.innerHTML = "";
    let answer = null;

    item.choices.forEach((c, idx) => {
      const label = document.createElement("label");
      label.innerHTML = `<input type="radio" name="q" value="${idx}"> <span>${c}</span>`;
      quizChoices.appendChild(label);
    });

    // listener tidak pakai once=true
    quizChoices.onclick = () => {
      const r = quizChoices.querySelector('input[name="q"]:checked');
      answer = r ? Number(r.value) : null;
    };

    quizSubmit.onclick = () => {
      quizModal.close();
      resolve(answer);
    };

    quizModal.showModal();
  });
}


function rollDiceAnimated() {
  return new Promise((resolve) => {
    playDiceSound();
    const result = Math.floor(Math.random() * 6) + 1;
    diceEl.classList.add("roll");
    setTimeout(() => {
      diceEl.classList.remove("roll");
      diceEl.textContent = result;
      resolve(result);
    }, 450);
  });
}
function movePlayerAnimated(player, steps) {
  return new Promise(async (resolve) => {
    const ringLen = path.length;
    for (let i = 0; i < steps; i++) {
      const oldPos = player.pos;
      player.pos = (player.pos + 1) % ringLen;
      if (player.pos === 0 && oldPos !== 0) {
        player.laps++;
        applyStartBonus(player);
        updatePlayersPanel();
      }

      // Pindahkan pion absolute ke posisi baru
      updatePionPosition(player);

      // beri jeda supaya animasi terpanggil
      await new Promise((r) => setTimeout(r, 220));
    }
    highlightLanding(player.pos);
    resolveTile(player);
    updatePlayersPanel();
    resolve();
  });
}

// --- handleQuiz (MODIFIKASI) ---
async function handleQuiz(player) {
  const level = player.level || 1; // default level 1
  const bank = currentQuizLevels[level];

  if (!bank || bank.length === 0) {
    toast("Tidak ada soal untuk level ini.");
    return;
  }

  const ans = await askQuiz(bank);

  if (ans === null) {
    toast(`${player.name}: Tidak menjawab. Tidak ada bonus.`);
    return;
  }

  const item = bank.find(q => q.q === quizQuestion.textContent);

  if (!item) {
    toast("Soal tidak ditemukan.");
    return;
  }

  if (ans === item.correct) {
    // bonus berdasarkan level
    const bonus = level === 1 ? 15000 : level === 2 ? 8000 : 5000;
    player.points += bonus;
    toast(`${player.name}: Jawaban benar! +${bonus.toLocaleString("id-ID")} Poin`);
  } else {
    toast(`${player.name}: Jawaban salah.`);
  }

  updatePlayersPanel();
}
// --- ⭐ UPDATE: fungsi untuk mengupdate level pemain berdasarkan poin ---
function updatePlayerLevel(player) {
  const oldLevel = player.level;
  if (player.points >= LEVEL_THRESHOLDS[3]) player.level = 3;
  else if (player.points >= LEVEL_THRESHOLDS[2]) player.level = 2;
  else player.level = 1;

  if (player.level !== oldLevel) {
    toast(`${player.name} naik ke LEVEL ${player.level}!`);
  }
}
// --- akhir update ---

function playDiceSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(120, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // beberapa browser mungkin blok audio auto
    // ignore
  }
}

function scrollToBoard() {
  if (window.innerWidth > 768) return;
  boardEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

function scrollToTurnPanel() {
  if (window.innerWidth > 768) return;
  turnInfoEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

rollBtn.addEventListener("click", async () => {
  if (!started) return;
  rollBtn.disabled = true;
  const p = currentPlayer();
  scrollToBoard();
  const d = await rollDiceAnimated();
  diceValueEl.textContent = `${p.name} melempar dadu: ${d}`;
  await movePlayerAnimated(p, d);
  nextTurn();
  setTimeout(scrollToTurnPanel, 1000);
  rollBtn.disabled = false;
});

// --- MODIFIKASI 4: Ganti startBtn listener ---
startBtn.addEventListener("click", () => {
  // 1. Ambil nilai dari SEMUA pilihan setup
  const n = Math.max(2, Math.min(4, Number(playerCountSel.value || 2)));
  const categoryKey = categorySel.value;

  // 2. Set data global berdasarkan kategori yg dipilih
  const selectedCategory = allGameData.kategori[categoryKey];
  currentTiles = selectedCategory.tiles || [];
  // ⭐ UPDATE: if JSON memiliki quizLevels, pakai itu; jika tidak fallback ke quizBank
  currentQuizLevels = selectedCategory.quizLevels || null; // { "1": [...], "2": [...], "3": [...] }
  currentQuizBank = selectedCategory.quizBank || []; // legacy fallback
  currentEduText = selectedCategory.eduText || {};

  // 3. Render papan berdasarkan data yg dipilih
  renderBoard();

  // 4. Buat pemain dan mulai game
  createPlayers(n);
  turn = 0;
  started = true;
  setTurnInfo();
  rollBtn.disabled = false;

  // 5. Pindah dari layar setup ke layar game
  const screenSetup = document.getElementById("screen-setup");
  const screenGame = document.getElementById("screen-game");
  screenSetup.classList.remove("active");
  screenGame.classList.add("active");

  // pastikan pion berada di tempat benar setelah transisi
  setTimeout(placeAllPions, 150);
});
// --- Akhir Modifikasi 4 ---


// --- INIT (MODIFIKASI) ---
loadGameData();
