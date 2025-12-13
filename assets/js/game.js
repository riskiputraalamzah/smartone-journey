/* ======================================================
   game.js - SmartOne Journey
   Logic utama permainan: Board rendering, Player movement,
   Quiz handling, dan UI updates.
   [UPDATED: Anti-Spam & Reading Delay]
====================================================== */

// --- AMBIL ELEMEN DOM PENTING ---
const diceEl = document.getElementById("dice");
const boardEl = document.getElementById("board");
const diceValueEl = document.getElementById("diceValue");
const turnInfoEl = document.getElementById("turnInfo");
const startBtn = document.getElementById("startBtn");
const playerCountGroup = document.getElementById("player-count-group");
const playerChoices = playerCountGroup.querySelectorAll(".btn-choice");

const POINTPLAYERS = 20000;

// --- ELEMENT MODAL KUIS ---
const quizModal = document.getElementById("quizModal");
const quizQuestion = document.getElementById("quizQuestion");
const quizChoices = document.getElementById("quizChoices");
const quizSubmit = document.getElementById("quizSubmit");
const modalNotif = document.getElementById("modalNotif");

// --- ELEMENT PEMAIN & PAPAN ---
const playerInfoBoxes = [
  document.getElementById("player1-info"),
  document.getElementById("player2-info"),
  document.getElementById("player3-info"),
  document.getElementById("player4-info"),
];
const diceOverlayEl = document.getElementById("diceOverlay");
const pionEls = [
  document.getElementById("pion1"),
  document.getElementById("pion2"),
  document.getElementById("pion3"),
  document.getElementById("pion4"),
];
const boardWrapper = document.getElementById("board-wrapper");
const notifPopup = document.getElementById("notifPopup");
const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
const playerInfoContainer = document.getElementById("player-info-container");

// --- KONFIGURASI PAPAN ---
const gridSize = 6;
const path = [];
for (let c = 0; c < gridSize; c++) path.push([0, c]);
for (let r = 1; r < gridSize; r++) path.push([r, gridSize - 1]);
for (let c = gridSize - 2; c >= 0; c--) path.push([gridSize - 1, c]);
for (let r = gridSize - 2; r >= 1; r--) path.push([r, 0]);

const T = {
  START: "start",
  INCOME: "income",
  EXPENSE: "expense",
  TAX: "tax",
  SAVE: "save",
  BONUS: "bonus",
  PENALTY: "penalty",
};

// --- STATE GLOBAL ---
let allGameData = null;
let currentTiles = [];
let currentQuizBank = [];
let currentQuizLevels = null;
let currentEduText = {};

const tokenColors = ["#22d3ee", "#fbbf24", "#ef4444", "#22c55e"];

let players = [];
let selectedPlayerCount = 2;
let selectedCategoryKey = null;
let turn = 0;
let started = false;

// [BARU] Flag untuk mencegah spam klik dadu
let isProcessingTurn = false;

// [BARU] Audio Background
let backsound = null;
let winnerSound = null; // [BARU] Winner Sound
let diceSound = null; // [BARU] Dice Audio
let pionSound = null; // [BARU] Pion Audio
let isMuted = false;

const LEVEL_THRESHOLDS = { 2: 100000, 3: 230000 };
const BONUS_BY_LEVEL = { 1: 15000, 2: 8000, 3: 5000 };

// --- EVENT LISTENER SIDEBAR ---
if (sidebarToggleBtn && playerInfoContainer) {
  sidebarToggleBtn.addEventListener("click", () => {
    sidebarToggleBtn.classList.toggle("open");
    playerInfoContainer.classList.toggle("open");
  });
}

/* ------------------------------------------------------
   1. LOAD DATA & SETUP AWAL
------------------------------------------------------ */
/**
 * Memuat file `data_game.json` dan menginisialisasi
 * data permainan (kategori, quiz, tiles).
 * Menangani error jika fetch gagal.
 */
async function loadGameData() {
  try {
    const response = await fetch("data_game.json");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    allGameData = await response.json();
    populateCategorySelect();
    initMusic(); // [BARU] Preload audio lebih awal
    startBtn.disabled = false;
    startBtn.textContent = "Yok Mulai";
  } catch (err) {
    console.error("Gagal memuat data_game.json:", err);
    turnInfoEl.textContent = "Error: Gagal memuat data.";
  }
}

/**
 * populateCategorySelect
 * Mengisi UI pilihan kategori berdasarkan `allGameData.kategori`.
 * Menangani seleksi kategori dan menandai pilihan awal.
 */
function populateCategorySelect() {
  if (!allGameData) return;
  const categoryGroup = document.getElementById("category-card-group");
  categoryGroup.innerHTML = "";
  const categories = Object.keys(allGameData.kategori || {});

  const categoryIcons = {
    A: "💰",
    B: "📱",
    C: "🤝",
    D: "🏪",
    E: "🥗",
    F: "🛡️",
  };

  categories.forEach((key, index) => {
    const card = document.createElement("div");
    card.className = "card-choice";
    const namaKategori = allGameData.kategori[key].nama || key;
    const icon = categoryIcons[key] || "⭐";

    card.innerHTML = `<div class="emoji-icon">${icon}</div><span>${namaKategori}</span>`;
    card.dataset.key = key;

    if (index === 0) {
      card.classList.add("selected");
      selectedCategoryKey = key;
    }

    card.addEventListener("click", () => {
      categoryGroup
        .querySelectorAll(".card-choice")
        .forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedCategoryKey = card.dataset.key;
    });
    categoryGroup.appendChild(card);
  });
}

/* ------------------------------------------------------
   2. RENDER BOARD
------------------------------------------------------ */
/**
 * renderBoard
 * Membangun elemen DOM papan permainan berdasarkan `path`
 * dan `currentTiles`, lalu menempatkan pion.
 */
function renderBoard() {
  boardEl.innerHTML = "";
  diceOverlayEl.style.display = "none";

  const cells = new Map();
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = document.createElement("div");
      cell.className = "tile void";
      cell.dataset.pos = `${r}-${c}`;
      boardEl.appendChild(cell);
      cells.set(`${r}-${c}`, cell);
    }
  }

  path.forEach((coord, i) => {
    const [r, c] = coord;
    const cell = cells.get(`${r}-${c}`);
    const t = currentTiles[i % currentTiles.length] || {
      title: "?",
      effect: "",
      type: "income",
    };

    cell.className = `tile ${t.type}`;
    cell.innerHTML = `
      <div class="title">${t.title}</div>
      <div class="effect">${t.effect || ""}</div>
      <div class="tokens" data-idx="${i}"></div>`;
  });

  setTimeout(placeAllPions, 0);
  diceOverlayEl.style.display = "flex";
}

/* ------------------------------------------------------
   3. PLAYER MANAGEMENT
------------------------------------------------------ */
/**
 * createPlayers
 * Membuat array `players` sebanyak `n` pemain dan
 * menginisialisasi properti awal tiap pemain.
 */
function createPlayers(n = 2) {
  players = Array.from({ length: n }).map((_, i) => ({
    id: i,
    name: `P${i + 1}`,
    color: tokenColors[i % tokenColors.length],
    pos: 0,
    points: POINTPLAYERS,
    savingsPoints: 0, // Tabungan awal 0
    laps: 0,
    level: 1,
    isBankrupt: false, // [BARU] Status kebangkrutan
    usedQuestions: { 1: new Set(), 2: new Set(), 3: new Set() },
  }));
  updatePlayersPanel();
  placeAllPions();
}

/**
 * updatePlayersPanel
 * Memperbarui panel informasi pemain di sidebar sesuai
 * data `players` (poin, tabungan, level, dll.).
 */
function updatePlayersPanel() {
  playerInfoBoxes.forEach((box) => (box.style.display = "none"));

  players.forEach((p, index) => {
    const box = playerInfoBoxes[index];
    if (!box) return;

    box.style.display = "block";
    box.style.border = "none";

    box.innerHTML = `
      <div class="p-header" style="background: ${p.color};">
        <span>👤 ${p.name}</span>
        <span id="level-badge-${p.id}" style="font-size:0.8em; background:rgba(0,0,0,0.2); padding:2px 6px; border-radius:10px;">
          ⭐ Lv.${p.level}
        </span>
      </div>
      <div class="p-body">
        <div class="p-row" style="font-size:0.8em; opacity:0.7; margin-top:6px;">
          <span>💰 Poin :</span> <span>${fmt(p.points)}</span>
        </div>
        <div class="p-row" style="font-size:0.8em; opacity:0.7; margin-top:6px;">
          <span>🏦 Tabungan :</span> <span>${fmt(p.savingsPoints)}</span>
        </div>
        <div class="p-row" style="font-size:0.8em; opacity:0.7; margin-top:6px;">
          <span>🔄 Putaran: ${p.laps}</span>
        </div>
      </div>
    `;
    box.style.boxShadow = `0 8px 20px rgba(0,0,0,0.3), 0 0 0 2px ${p.color}`;

    // [UPDATED] Visual Eliminasi
    // Hanya tampilkan jika status bangkrut SUDAH dikonfirmasi (setelah popup)
    if (p.isBankrupt) {
      box.classList.add("eliminated");
      // Cek apakah stamp sudah ada biar tidak double
      if (!box.querySelector(".stamp-eliminated")) {
        const stamp = document.createElement("div");
        stamp.className = "stamp-eliminated";
        stamp.textContent = "TERELIMINASI";
        box.appendChild(stamp);
      }
    } else {
      box.classList.remove("eliminated");
      const stamp = box.querySelector(".stamp-eliminated");
      if (stamp) stamp.remove();
    }
  });
}

/**
 * updateTurnIndicator
 * Highlight panel pemain yang sedang giliran.
 */
function updateTurnIndicator() {
  players.forEach((p, index) => {
    const box = playerInfoBoxes[index];
    if (!box) return;
    if (index === turn % players.length) {
      box.classList.add("active-turn");
      box.style.border = `2px solid ${p.color}`;
      box.style.transform = "scale(1.05)";
    } else {
      box.classList.remove("active-turn");
      box.style.border = "none";
      box.style.transform = "scale(1)";
    }
  });
}

/**
 * currentPlayer
 * Mengembalikan objek pemain yang sedang aktif.
 */
function currentPlayer() {
  return players[turn % players.length];
}

/**
 * nextTurn
 * Memajukan giliran ke pemain selanjutnya yang tidak
 * berstatus bangkrut. Jika semua bangkrut, menyudahi permainan.
 */
function nextTurn() {
  // Loop untuk mencari pemain berikutnya yang TIDAK bangkrut
  let attempts = 0;
  do {
    turn = (turn + 1) % players.length;
    attempts++;
  } while (players[turn].isBankrupt && attempts <= players.length);

  // Jika semua bangkrut (teoritis gak mungkin kalau ada logika winner), reset
  if (attempts > players.length) {
    alert("Permainan Selesai!");
    return;
  }


  // Cek Game Over (Jika sisa 1 pemain)
  const activePlayers = players.filter(p => !p.isBankrupt);
  if (activePlayers.length <= 1 && players.length > 1) {
    // showInModalOrNotif(`Game Over! Pemenang: ${activePlayers[0]?.name || 'Tidak ada'}`);
    showWinnerModal(activePlayers[0]?.name || 'Champion');
    return;
  }

  updateTurnIndicator();
  const p = currentPlayer();

  // Reset dice state/visuals if needed
  diceValueEl.textContent = `Giliran ${p.name} melempar dadu!`;
}

/* ------------------------------------------------------
   4. MOVEMENT LOGIC
------------------------------------------------------ */
/**
 * tileElementAt
 * Mengembalikan elemen tile DOM berdasarkan koordinat baris/kolom.
 */
function tileElementAt(r, c) {
  return boardEl.querySelector(`.tile[data-pos="${r}-${c}"]`);
}


/**
 * updatePionPosition
 * Menghitung posisi pixel pion pada papan dan mengatur
 * style `left`/`top` agar pion tampil berada di tengah tile.
 * [UPDATED] Menangani overlap: jika ada >1 pemain di tile sama,
 * geser ke 4 sudut agar semua terlihat.
 */
function updatePionPosition(player) {
  const pion = pionEls[player.id];
  if (!pion || !boardEl) return;

  const idx = player.pos % path.length;
  const [r, c] = path[idx];
  const tile = tileElementAt(r, c);

  if (!tile) {
    pion.style.left = `0px`;
    pion.style.top = `0px`;
    return;
  }

  const boardRect = boardEl.getBoundingClientRect();
  const tileRect = tile.getBoundingClientRect();

  // Posisi Dasar (Tengah Tile)
  let left =
    tileRect.left -
    boardRect.left +
    tileRect.width / 2 -
    (pion.offsetWidth || 32) / 2;
  let top =
    tileRect.top -
    boardRect.top +
    tileRect.height / 2 -
    (pion.offsetHeight || 32) / 2;

  // [FIX] Jika pemain bangkrut, sembunyikan pion (double check)
  if (player.isBankrupt) {
    pion.style.display = "none";
    return;
  } else {
    pion.style.display = "block"; // Pastikan tampil jika aktif
  }

  // --- LOGIKA OVERLAP ---
  // Temukan semua pemain yang ada di tile ini (posisi sama, belum bangkrut)
  const peers = players.filter(p => !p.isBankrupt && p.pos === player.pos);

  if (peers.length > 1) {
    // Sort biar urutannya konsisten
    peers.sort((a, b) => a.id - b.id);
    const indexInTile = peers.findIndex(p => p.id === player.id);

    // Offset konfigurasi (x, y) dalam pixel
    const offsets = [
      { x: -8, y: -8 }, // 0: Kiri Atas
      { x: 8, y: -8 },  // 1: Kanan Atas
      { x: -8, y: 8 },  // 2: Kiri Bawah
      { x: 8, y: 8 }    // 3: Kanan Bawah
    ];

    // Gunakan modulo 4 jika pemain >4 (meski max 4)
    const off = offsets[indexInTile % 4];

    left += off.x;
    top += off.y;

    // Perkecil sedikit biar muat
    pion.style.transform = "scale(0.8)";
  } else {
    // Reset scale jika sendirian
    pion.style.transform = "scale(1)";
  }

  pion.style.left = `${Math.round(left)}px`;
  pion.style.top = `${Math.round(top)}px`;
}

playerChoices.forEach((button) => {
  button.addEventListener("click", () => {
    playerChoices.forEach((btn) => btn.classList.remove("selected"));
    button.classList.add("selected");
    selectedPlayerCount = Number(button.dataset.value);
  });
});

/**
 * placeAllPions
 * Memperlihatkan pion untuk pemain yang ada dan menyembunyikan
 * pion cadangan. Memanggil `updatePionPosition` untuk tiap pion.
 */
function placeAllPions() {
  players.forEach((p) => {
    const el = pionEls[p.id];
    if (el) {
      el.style.display = "flex";
    }
    updatePionPosition(p);
  });
  for (let i = players.length; i < pionEls.length; i++) {
    pionEls[i].style.display = "none";
  }
}

window.addEventListener("resize", () => {
  if (typeof window._pionResizeTimeout !== "undefined")
    clearTimeout(window._pionResizeTimeout);
  window._pionResizeTimeout = setTimeout(() => placeAllPions(), 120);
});

/* ------------------------------------------------------
   5. GAMEPLAY ACTIONS
------------------------------------------------------ */
/**
 * rollDice
 * Menghasilkan nilai dadu acak 1..6.
 */
function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * applyStartBonus
 * Memberi pemain bonus saat melewati START.
 */
function applyStartBonus(player) {
  player.points += 10000;
  showInModalOrNotif(`${player.name} melewati START: +10.000 Poin`);
}

// game.js - Fungsi Helper Baru

/**
 * Menangani pengurangan poin.
 * Return TRUE jika pemain selamat, FALSE jika bangkrut.
 */
/**
 * handleExpense
 * Mengurangi `amount` dari `player.points` dan jika perlu
 * menggunakan `player.savingsPoints`. Mengembalikan `true`
 * jika pemain masih hidup setelah pengurangan, `false` bila
 * dinyatakan bangkrut (dan memanggil `handleGameOver`).
 * @param {Object} player
 * @param {number} amount
 * @returns {boolean}
 */
function handleExpense(player, amount) {
  // amount harus positif (contoh: 12000 untuk pengeluaran 12k)

  // Skenario 1: Poin Dompet Cukup
  if (player.points >= amount) {
    player.points -= amount;
    return true;
  }

  // Skenario 2: Poin Kurang, Cek Tabungan (Darurat)
  const deficit = amount - player.points; // Kekurangan biaya

  if (player.savingsPoints >= deficit) {
    // Kuras dompet jadi 0
    player.points = 0;
    // Ambil sisanya dari tabungan
    player.savingsPoints -= deficit;

    // Tampilkan Notif Darurat (Merah/Kritis)
    showNotif(
      `⚠️ DANA DARURAT TERPAKAI!`,
      `Poin habis! ${fmt(deficit)} diambil dari Tabungan.`,
      3000
    );
    return true; // Selamat
  }

  // Skenario 3: Tabungan pun Tak Cukup (BANGKRUT)
  player.points = 0;
  player.savingsPoints = 0;
  handleGameOver(player); // Panggil fungsi game over
  return false; // Tamat
}

// game.js - Fungsi Baru untuk Popup Cantik

/**
 * showTilePopup
 * Menyusun dan menampilkan popup notifikasi tile dengan
 * ikon sesuai tipe, nominal, dan deskripsi edukasi.
 */
function showTilePopup(type, title, amount, desc) {
  return new Promise((resolve) => {
    // 1. Tentukan Ikon berdasarkan tipe
    let icon = "📄";
    if (type === T.INCOME) icon = "💰";
    else if (type === T.EXPENSE) icon = "💸";
    else if (type === T.TAX) icon = "🏦";
    else if (type === T.SAVE) icon = "🤖";
    else if (type === T.PENALTY) icon = "⚠️";
    else if (type === T.BONUS) icon = "🎁";
    else if (type === T.START) icon = "🚀";

    // 2. Format Nominal (Plus/Minus)
    let amountClass = "neutral";
    let amountText = "";

    if (typeof amount === 'number') {
      if (amount > 0) {
        amountClass = "plus";
        amountText = "+ " + fmt(amount);
      } else if (amount < 0) {
        amountClass = "minus";
        amountText = "- " + fmt(Math.abs(amount));
      }
    } else {
      amountText = amount; // Jika teks (misal: "Jawab Kuis!")
    }

    // 3. Susun HTML - Tambah Tombol OK
    const html = `
      <div class="notif-content">
        <div class="notif-icon-box">${icon}</div>
        <div class="notif-title-box">${title}</div>
        <div class="notif-amount-box ${amountClass}">${amountText}</div>
        ${desc ? `<div class="notif-desc-box">"${desc}"</div>` : ''}
        <button id="popupCloseBtn" class="popup-close-btn">OK</button>
      </div>
    `;

    // 4. Tampilkan pakai notifPopup yang sudah ada
    notifPopup.innerHTML = html;
    notifPopup.classList.add("show");

    // Hapus timer lama (jika ada sisa)
    if (notifPopup._t) clearTimeout(notifPopup._t);

    // 5. Event Listener Tombol Close
    const btn = document.getElementById("popupCloseBtn");
    if (btn) {
      btn.onclick = () => {
        notifPopup.classList.remove("show");
        resolve(); // Lanjut game setelah klik OK
      };
    } else {
      // Fallback safety
      setTimeout(() => {
        notifPopup.classList.remove("show");
        resolve();
      }, 3000);
    }
  });
}

// game.js - Update resolveTile

/**
 * resolveTile
 * Menjalankan efek tile tempat pemain mendarat (income,
 * expense, tax, save, bonus, penalty, start), men-trigger
 * quiz bila diperlukan, dan memperbarui level/panel.
 * [ASYNC] Menunggu animasi/popup selesai sebelum giliran berakhir.
 */
async function resolveTile(player) {
  const tile = currentTiles[player.pos % currentTiles.length];
  const eduText = currentEduText[tile.type] || "";

  // Ambil elemen tile untuk koordinat awal animasi
  const tileEl = tileElementAt(path[player.pos % path.length][0], path[player.pos % path.length][1]);
  const startRect = tileEl ? tileEl.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
  const endRect = getPlayerInfoRect(player.id);

  let runQuiz = false;
  let pointChange = 0;
  let pointType = "neutral";

  switch (tile.type) {
    case T.INCOME:
      pointChange = tile.points;
      pointType = "plus";
      player.points += tile.points;
      await showTilePopup(T.INCOME, tile.title, tile.points, eduText);
      break;

    case T.EXPENSE:
      const expenseCost = Math.abs(tile.points);
      const survivedExp = handleExpense(player, expenseCost);
      if (survivedExp) {
        pointChange = -expenseCost;
        pointType = "minus";
        await showTilePopup(T.EXPENSE, tile.title, -expenseCost, eduText);
      }
      break;

    case T.TAX:
      const cut = Math.floor(player.points * (tile.percent / 100));
      player.points -= cut;
      pointChange = -cut;
      pointType = "minus";
      await showTilePopup(T.TAX, tile.title, -cut, `Pajak ${tile.percent}% dari poinmu.`);
      break;

    case T.SAVE:
      if (player.points >= tile.points) {
        player.points -= tile.points;
        player.savingsPoints += tile.points;
        // Animasi minus dulu (masuk tabungan)
        pointChange = -tile.points;
        pointType = "minus";
        await showTilePopup(T.SAVE, tile.title, tile.points, "Uang diamankan ke Tabungan.");
      } else {
        await showTilePopup(T.SAVE, "Gagal Menabung", "Gagal", "Poin di tangan tidak cukup.");
      }
      break;

    case T.BONUS:
      await showTilePopup(T.BONUS, tile.title, "KUIS!", "Jawab benar dapat poin.");
      runQuiz = true;
      break;

    case T.PENALTY:
      const penaltyCost = Math.abs(tile.points);
      const survivedPen = handleExpense(player, penaltyCost);
      if (survivedPen) {
        pointChange = -penaltyCost;
        pointType = "minus";
        await showTilePopup(T.PENALTY, tile.title, -penaltyCost, "Denda pelanggaran.");
      }
      break;

    case T.START:
      await showTilePopup(T.START, "Start Point", "", "Siap putaran baru!");
      break;
  }

  // JIKA ADA PERUBAHAN POIN -> JALANKAN ANIMASI
  if (pointChange !== 0) {
    // Tunggu sebentar biar popup muncul dulu
    await new Promise(r => setTimeout(r, 500));

    // LOGIKA MOBILE: Jika layar kecil (< 768px), skip animasi "fly" karena layout tertutup/sempit
    if (window.innerWidth >= 768) {
      // [FIX] Pastikan pointType sesuai dengan pointChange jika masih neutral
      // Ini memastikan color putih tidak muncul untuk expense/penalty
      if (pointType === "neutral" && pointChange !== 0) {
        pointType = pointChange > 0 ? "plus" : "minus";
      }

      let txt = (pointChange > 0 ? "+" : "") + fmt(pointChange);

      // KHUSUS T.SAVE: 
      // Logika game: poin berkurang dari dompet (-).
      // Visual popup: "Menabung +8.000" (Hijau/Positif).
      // User request: Samakan visual fly dengan popup board.
      if (tile.type === T.SAVE && pointChange < 0) {
        txt = "+" + fmt(Math.abs(pointChange)); // Tampilkan "+8.000"
        pointType = "plus"; // Pakai warna Hijau
      }

      await animatePointFly(startRect, endRect, txt, pointType);
    }
  }

  // Handle Kuis (delay sedikit biar popup muncul dulu)
  if (runQuiz) {
    await new Promise(r => setTimeout(r, 1200));
    // handleQuiz juga perlu async/await kalau mau nunggu selesai
    await handleQuiz(player);
  }

  updatePlayerLevel(player);
  updatePlayersPanel();
}

/* ------------------------------------------------------
   6. UTILITIES
   Fungsi utilitas kecil: formatting dan helper string.
   Tidak mengubah state permainan langsung.
------------------------------------------------------ */
/**
 * fmt
 * Format angka sesuai locale `id-ID`.
 */
function fmt(n) {
  return n.toLocaleString("id-ID");
}

/**
 * toPoinStr
 * Mengubah angka menjadi string berformat poin (+/- x Poin).
 */
function toPoinStr(n) {
  return (
    (n < 0 ? "-" : "+") + " " + Math.abs(n).toLocaleString("id-ID") + " Poin"
  );
}

/* ------------------------------------------------------
  7. NOTIFICATIONS
------------------------------------------------------ */
/**
 * showNotif
 * Menampilkan notifikasi singkat di elemen `notifPopup`.
 */
function showNotif(msg, eduMsg = "", time = 1500) {
  let html = `<span>${msg}</span>`;
  if (eduMsg) html += `<small>${eduMsg}</small>`;
  notifPopup.innerHTML = html;

  const duration = eduMsg ? 2500 : time;

  notifPopup.classList.add("show");
  clearTimeout(notifPopup._t);
  notifPopup._t = setTimeout(
    () => notifPopup.classList.remove("show"),
    duration
  );
}

/**
 * showInModalOrNotif
 * Jika modal kuis terbuka, tampilkan notifikasi di dalam modal,
 * jika tidak, gunakan `showNotif` biasa.
 */
function showInModalOrNotif(msg, eduMsg = "", time = 1500) {
  if (quizModal.open) {
    modalNotif.textContent = msg;
    modalNotif.style.display = "block";
    clearTimeout(modalNotif._t);
    modalNotif._t = setTimeout(() => {
      modalNotif.style.display = "none";
    }, time);
  } else {
    showNotif(msg, eduMsg, time);
  }
}

/**
 * animatePointFly
 * Membuat elemen teks melayang dari posisi kotak (startRect)
 * menuju ke panel info pemain (endRect).
 */
function animatePointFly(startRect, endRect, text, typeClass) {
  return new Promise((resolve) => {
    // 1. Buat elemen
    const el = document.createElement("div");
    el.className = `flying-point ${typeClass}`;
    el.textContent = text;
    document.body.appendChild(el);

    // 2. Set posisi awal
    const startX = startRect.left + startRect.width / 2;
    const startY = startRect.top + startRect.height / 2;

    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    el.style.transform = "translate(-50%, -50%) scale(0.5)";

    // Force reflow
    void el.offsetWidth;

    // 3. Set posisi akhir (target)
    const endX = endRect.left + endRect.width / 2;
    const endY = endRect.top + endRect.height / 2;

    el.style.left = `${endX}px`;
    el.style.top = `${endY}px`;
    el.style.transform = "translate(-50%, -50%) scale(1.2)";
    el.style.opacity = "0"; // Fade out saat sampai

    // 4. Hapus setelah selesai
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
      resolve();
    }, 1000); // Sesuai durasi CSS transition (1s)
  });
}

function getPlayerInfoRect(playerId) {
  const box = playerInfoBoxes[playerId];
  if (box) return box.getBoundingClientRect();
  // Fallback ke tengah layar jika tidak ketemu
  return { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
}

/* ------------------------------------------------------
   8. QUIZ SYSTEM
------------------------------------------------------ */
/**
 * askQuiz
 * Menampilkan modal kuis menggunakan data `bank` dan
 * mengembalikan Promise yang resolve dengan jawaban.
 */
function askQuiz(bank, playerLevel = 1) {
  return new Promise((resolve) => {
    const item = bank[Math.floor(Math.random() * bank.length)];
    if (!item) {
      showInModalOrNotif("Tidak ada kuis tersedia.");
      return resolve({ answer: null, correct: false, item: null });
    }

    modalNotif.style.display = "none";
    quizQuestion.textContent = item.q;
    quizChoices.innerHTML = "";

    item.choices.forEach((c, idx) => {
      const wrapper = document.createElement("label");
      wrapper.className = "quiz-option";
      wrapper.innerHTML = `<input type="radio" name="quizOpt" value="${idx}"> <span>${c}</span>`;
      quizChoices.appendChild(wrapper);
    });

    quizSubmit.onclick = async (ev) => {
      ev.preventDefault();
      const sel = quizChoices.querySelector('input[name="quizOpt"]:checked');
      const answer = sel ? Number(sel.value) : null;
      const correct = answer === item.correct;

      modalNotif.textContent = correct ? `Jawaban benar!` : `Jawaban salah.`;
      modalNotif.style.display = "block";

      await new Promise((r) => setTimeout(r, 1000));
      try {
        quizModal.close();
      } catch (e) { }
      resolve({ answer, correct, item });
    };

    try {
      quizModal.showModal();
    } catch (e) {
      console.error("Dialog error", e);
    }
  });
}

/* ------------------------------------------------------
  9. ANIMATION & FLOW
------------------------------------------------------ */
/**
 * rollDiceAnimated
 * Memainkan animasi dadu dan mengembalikan nilai hasilnya.
 * Mengembalikan Promise yang resolve angka 1..6.
 */
function rollDiceAnimated() {
  return new Promise((resolve) => {
    playDiceSound();
    const result = Math.floor(Math.random() * 6) + 1;
    const diceContainer = diceEl.querySelector(".dice-container");

    // Hapus kelas hasil sebelumnya
    for (let i = 1; i <= 6; i++) {
      diceContainer.classList.remove("show-" + i);
    }

    // Tambahkan kelas untuk animasi roll
    diceEl.classList.add("roll");

    setTimeout(() => {
      stopDiceSound(); // [BARU] Stop suara saat animasi selesai
      diceEl.classList.remove("roll");
      // Tampilkan sisi yang benar
      diceContainer.classList.add("show-" + result);
      resolve(result);
    }, 800); // Sesuaikan durasi dengan animasi di CSS
  });
}

/**
 * movePlayerAnimated
 * Menggerakkan pion `player` sejumlah `steps` langkah
 * secara animasi (delay per langkah) lalu memanggil
 * `resolveTile` pada tile tujuan.
 */
async function movePlayerAnimated(player, steps) {
  const ringLen = path.length;
  for (let i = 0; i < steps; i++) {
    playPionSound(); // [BARU] Sound per langkah
    const oldPos = player.pos;
    player.pos = (player.pos + 1) % ringLen;

    if (player.pos === 0 && oldPos !== 0) {
      player.laps++;
      applyStartBonus(player);
      updatePlayersPanel();
    }
    // Update SEMUA pion agar jika ada yang bergeser/masuk/keluar formation, visualnya ikut update
    placeAllPions();
    await new Promise((r) => setTimeout(r, 220));
  }
  highlightLanding(player.pos);
  await resolveTile(player);
  updatePlayersPanel();
}

/**
 * handleQuiz
 * Menjalankan alur kuis untuk `player` sesuai levelnya,
 * memberi poin jika benar, kemudian memperbarui UI.
 */
async function handleQuiz(player) {
  const level = player.level || 1;
  let bank = null;

  if (currentQuizLevels?.[level]?.length > 0) bank = currentQuizLevels[level];
  else if (currentQuizBank?.length > 0) bank = currentQuizBank;
  if (!bank && currentQuizLevels?.["1"]?.length > 0)
    bank = currentQuizLevels["1"];

  if (!bank || bank.length === 0) {
    showInModalOrNotif("Tidak ada soal untuk level ini.");
    return;
  }

  const { answer, correct, item } = await askQuiz(bank, level);

  if (answer === null) {
    showInModalOrNotif(`${player.name} tidak menjawab.`);
    return;
  }

  if (correct) {
    const bonus = BONUS_BY_LEVEL[level] || BONUS_BY_LEVEL[1];
    player.points += bonus;

    // Animasi Poin Kuis
    const endRect = getPlayerInfoRect(player.id);
    const startRect = { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 }; // Dari tengah (modal)

    showNotif(
      `${player.name}: Jawaban benar!`,
      `+${bonus.toLocaleString("id-ID")} poin`
    );
    // Hanya animasi jika bukan mobile
    if (window.innerWidth >= 768) {
      await animatePointFly(startRect, endRect, "+" + fmt(bonus), "plus");
    }
  } else {
    showNotif(`${player.name}: Jawaban salah.`);
  }

  updatePlayersPanel();
  updatePlayerLevel(player);
}

/**
 * highlightLanding
 * Menambahkan kelas highlight pada tile yang menjadi tujuan
 * agar pemain melihat dimana mendarat.
 */
function highlightLanding(index) {
  const tile = boardEl
    .querySelector(`.tokens[data-idx="${index}"]`)
    ?.closest(".tile");
  if (!tile) return;
  tile.classList.add("highlight");
  setTimeout(() => tile.classList.remove("highlight"), 1200);
}

/**
 * playDiceSound
 * Memainkan suara dice.mp3, looping selama animasi.
 */
function playDiceSound() {
  if (isMuted) return; // Cek mute global

  if (!diceSound) {
    diceSound = new Audio("assets/sound/dice.mp3");
    diceSound.loop = true; // Looping saat berputar
    diceSound.volume = 1.0;
  }

  diceSound.currentTime = 0;
  diceSound.play().catch(e => console.log("Dice play error:", e));
}

/**
 * playPionSound
 * Memainkan efek suara langkah pion.
 * Menggunakan cloneNode() agar bisa overlapping (spam cepat).
 */
function playPionSound() {
  if (isMuted) return;

  if (!pionSound) {
    pionSound = new Audio("assets/sound/pion2.mp3");
    pionSound.volume = 1.0;
  }

  // Clone node agar bisa dimainkan berulang kali secara paralel
  const soundClone = pionSound.cloneNode(true);
  soundClone.play().catch(e => {
    // Ignore autoplay errors
  });
}

/**
 * stopDiceSound
 * Menghentikan suara dadu seketika.
 */
function stopDiceSound() {
  if (diceSound) {
    diceSound.pause();
    diceSound.currentTime = 0;
  }
}

/* ------------------------------------------------------
  10. EVENT LISTENERS & START
------------------------------------------------------ */

// === KLIK DADU DENGAN ANTI-SPAM & JEDA ===
diceEl.addEventListener("click", async () => {
  // 1. GUARD CLAUSE: Cegah klik beruntun/spam
  if (!started || isProcessingTurn) return;

  // Kunci dadu
  isProcessingTurn = true;
  diceEl.setAttribute("aria-disabled", "true");

  const p = currentPlayer();
  scrollToBoard();

  // 2. Lempar & Jalan
  const d = await rollDiceAnimated();
  diceValueEl.textContent = `${p.name} melempar dadu: ${d}`;

  await movePlayerAnimated(p, d);

  // 3. JEDA PENTING (2 Detik)
  // Memberi waktu baca notifikasi poin/edukasi sebelum ganti pemain
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // 4. Ganti Giliran & Buka Kunci
  nextTurn();
  diceEl.removeAttribute("aria-disabled");
  isProcessingTurn = false; // Siap untuk klik berikutnya

  setTimeout(scrollToTurnPanel, 500);
});

/**
 * Memuat file `data_game.json` dan menginisialisasi
 * data permainan (kategori, quiz, tiles).
 * Menangani error jika fetch gagal.
 */
async function loadGameData() {
  try {
    const response = await fetch("assets/data/data_game.json");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    allGameData = await response.json();
    populateCategorySelect();
    initMusic(); // [BARU] Preload audio lebih awal
    startBtn.disabled = false;
    startBtn.textContent = "Yok Mulai";
  } catch (err) {
    console.error("Gagal memuat data_game.json:", err);
    turnInfoEl.textContent = "Error: Gagal memuat data.";
  }
}

// [REMOVED DUPLICATE VARS]

// === LOGIKA AUDIO BACKGROUND ===
function initMusic() {
  // 1. Backsound Loop
  if (!backsound) {
    backsound = new Audio("assets/sound/backsound.mp3");
    backsound.loop = true;
    backsound.volume = 0.5;
    backsound.preload = "auto";
  }

  // [BARU] 2. Winner Sound
  if (!winnerSound) {
    winnerSound = new Audio("assets/sound/winner.mp3");
    winnerSound.loop = true;
    winnerSound.volume = 0.6;
    winnerSound.preload = "auto";
  }

  // 3. Preload Dice Sound
  if (!diceSound) {
    diceSound = new Audio("assets/sound/dice.mp3");
    diceSound.loop = true;
    diceSound.volume = 1.0;
    diceSound.preload = "auto";
    diceSound.load();
  }

  // 4. Preload Pion Sound
  if (!pionSound) {
    pionSound = new Audio("assets/sound/pion2.mp3");
    pionSound.volume = 1.0;
    pionSound.preload = "auto";
    pionSound.load();
  }
}

function playMusic() {
  initMusic();
  // Pastikan winner sound mati saat main
  if (winnerSound) {
    winnerSound.pause();
    winnerSound.currentTime = 0;
  }

  if (!isMuted && backsound) {
    backsound.play().catch(e => console.log("Audio play failed (interaction needed):", e));
  }
}

function stopMusic() {
  if (backsound) {
    backsound.pause();
    backsound.currentTime = 0;
  }
  if (winnerSound) {
    winnerSound.pause();
    winnerSound.currentTime = 0;
  }
}

function toggleMute() {
  isMuted = !isMuted;
  const btn = document.getElementById("muteBtn");

  if (isMuted) {
    if (backsound) backsound.pause();
    if (winnerSound) winnerSound.pause(); // Mute winner sound too
    if (btn) btn.textContent = "🔇";
    if (btn) btn.classList.add("muted");
  } else {
    // Resume music logic
    // Cek apakah sedang winner modal? Agak kompleks valuenya.
    // Simpelnya: jika started, play backsound. Jika winner modal show?
    const winnerModal = document.getElementById("winnerModal");
    if (winnerModal && winnerModal.classList.contains("show")) {
      if (winnerSound) winnerSound.play().catch(e => console.log(e));
    } else if (backsound && started) {
      backsound.play().catch(e => console.log(e));
    }

    if (btn) btn.textContent = "🔊";
    if (btn) btn.classList.remove("muted");
  }
}

// =============================================

// Klik Tombol Mulai (Start)
// Klik Tombol Mulai (Start)
startBtn.addEventListener("click", () => {
  startGameSession(selectedPlayerCount, selectedCategoryKey);
});

/**
 * startGameSession
 * Memulai sesi permainan baru dengan konfigurasi yang ada.
 */
function startGameSession(playerCount, categoryKey) {
  const selectedCategory = allGameData.kategori[categoryKey] || {};
  const catTitleEl = document.getElementById("categoryTitle");
  if (catTitleEl) {
    catTitleEl.textContent = selectedCategory.nama || "Kategori Terpilih";
  }

  currentTiles = selectedCategory.tiles || [];
  currentQuizLevels = selectedCategory.quizLevels || null;
  currentQuizBank = selectedCategory.quizBank || [];
  currentEduText = selectedCategory.eduText || {};

  renderBoard();
  createPlayers(playerCount);
  turn = 0;
  started = true;

  updateTurnIndicator();
  const firstP = currentPlayer();
  diceValueEl.textContent = `Giliran ${firstP.name} melempar dadu!`;

  diceEl.removeAttribute("aria-disabled");

  // Reset flag
  isProcessingTurn = false;

  document.getElementById("screen-setup").classList.remove("active");
  document.getElementById("screen-game").classList.add("active");

  // Hide modal if open (for restart case)
  const winnerModal = document.getElementById("winnerModal");
  if (winnerModal) winnerModal.classList.remove("show");

  const gameOverOverlay = document.getElementById("gameOverOverlay");
  if (gameOverOverlay) gameOverOverlay.classList.remove("active");

  setTimeout(placeAllPions, 150);

  // Mulai Musik
  playMusic();
}

function updatePlayerLevel(player) {
  const oldLevel = player.level;
  if (player.points >= LEVEL_THRESHOLDS[3]) player.level = 3;
  else if (player.points >= LEVEL_THRESHOLDS[2]) player.level = 2;
  else player.level = 1;

  if (player.level !== oldLevel) {
    const isLevelUp = player.level > oldLevel;
    const actionText = isLevelUp ? "naik ke" : "turun ke";

    showInModalOrNotif(
      `${player.name} ${actionText} LEVEL ${player.level}!`,
      "",
      1800
    );

    // [ANIMATION] Level Change Fly
    if (window.innerWidth >= 768) {
      setTimeout(() => {
        // Start from center screen (overlay) or player position? User requested similar to point fly.
        // Let's start from center screen since the Modal/Notif appears there.
        const startRect = { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };

        // Target is the level badge we just ID'd
        const levelBadgeEl = document.getElementById(`level-badge-${player.id}`);
        const endRect = levelBadgeEl ? levelBadgeEl.getBoundingClientRect() : getPlayerInfoRect(player.id);

        const txt = (isLevelUp ? "UP " : "DOWN ") + "Lv." + player.level;
        const typeClass = isLevelUp ? "plus" : "minus"; // plus=green, minus=red

        animatePointFly(startRect, endRect, txt, typeClass);
      }, 500); // Delay slightly so it appears after modal shows up
    }
  }
}

// Tombol Kembali (Back)
const backBtnGame = document.getElementById("backBtnGame");
if (backBtnGame) {
  backBtnGame.addEventListener("click", () => {
    if (
      !confirm(
        "Yakin ingin kembali ke menu utama? Progres permainan akan hilang."
      )
    )
      return;

    document.getElementById("screen-game").classList.remove("active");
    document.getElementById("screen-setup").classList.add("active");

    started = false;
    turn = 0;
    players = [];
    isProcessingTurn = false;

    // HAPUS BARIS 'diceEl.textContent = "🎲";' KARENA MENGHANCURKAN STRUKTUR 3D DADU.

    // PERBAIKAN: Hanya hapus kelas CSS dan reset atribut
    diceEl.classList.remove("roll");
    diceEl.removeAttribute("aria-disabled"); // Pastikan dice tidak dalam status 'disabled'

    // PERBAIKAN: Reset teks instruksi dadu (gunakan diceValueEl, bukan diceEl)
    diceValueEl.textContent = "Lempar dadu!";

    // Reset pion dan info pemain
    pionEls.forEach((p) => (p.style.display = "none"));
    playerInfoBoxes.forEach((box) => (box.style.display = "none"));

    // Stop Musik
    stopMusic();
  });
}

const gassMulaiBtn = document.getElementById("gassMulaiBtn");
if (gassMulaiBtn) {
  gassMulaiBtn.addEventListener("click", () => {
    document.getElementById("screen-landing").classList.remove("active");
    document.getElementById("screen-setup").classList.add("active");
  });
}

// Modal Cara Bermain
const howToPlayModal = document.getElementById("howToPlayModal");
const howToPlayBtnLanding = document.getElementById("howToPlayBtnLanding");
const howToPlayBtnGame = document.getElementById("howToPlayBtnGame");
const closeHowToPlay = document.getElementById("closeHowToPlay");
const closeHowToPlayBtn = document.getElementById("closeHowToPlayBtn");

function openHowToPlayModal() {
  try {
    howToPlayModal.showModal();
  } catch (e) { }
}
function closeHowToPlayModal() {
  try {
    howToPlayModal.close();
  } catch (e) { }
}

if (howToPlayBtnLanding)
  howToPlayBtnLanding.addEventListener("click", openHowToPlayModal);
if (howToPlayBtnGame)
  howToPlayBtnGame.addEventListener("click", openHowToPlayModal);
if (closeHowToPlay)
  closeHowToPlay.addEventListener("click", closeHowToPlayModal);
if (closeHowToPlayBtn)
  closeHowToPlayBtn.addEventListener("click", closeHowToPlayModal);

if (howToPlayModal) {
  howToPlayModal.addEventListener("click", (e) => {
    const rect = howToPlayModal.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      closeHowToPlayModal();
    }
  });
}

function scrollToBoard() {
  if (window.innerWidth > 768) return;
  boardEl.scrollIntoView({ behavior: "smooth", block: "center" });
}
/**
 * scrollToTurnPanel
 * Scroll viewport ke panel informasi giliran pada perangkat kecil.
 */
function scrollToTurnPanel() {
  if (window.innerWidth > 768) return;
  turnInfoEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ======================================================
  11. MODAL & GAME OVER LOGIC (FIXED)
  Gantikan semua fungsi handleGameOver, showCustomModal, 
  dan checkWinnerBySurvival yang lama dengan ini.
====================================================== */

// 1. Ambil Elemen DOM Modal (Pastikan ID di HTML sudah sesuai)
const gameOverOverlay = document.getElementById('gameOverOverlay');
const goIcon = document.getElementById('goIcon');
const goTitle = document.getElementById('goTitle');
const goMessage = document.getElementById('goMessage');

// 2. Fungsi Menampilkan Modal Custom
// 2. Fungsi Menampilkan Modal Custom
function showCustomModal(title, message, isWin = false, isTotalGameOver = true) {
  // Set konten teks
  goTitle.textContent = title;
  goMessage.textContent = message;
  goIcon.textContent = isWin ? "🏆" : "💀";

  // Ubah warna border & teks judul (Hijau menang, Merah kalah)
  const box = document.querySelector('.game-over-box');
  if (box) {
    if (isWin) {
      box.style.borderColor = '#22c55e';
      goTitle.style.color = '#22c55e';

      // [BARU] START WINNER MUSIC
      if (backsound) backsound.pause();
      if (winnerSound) {
        winnerSound.currentTime = 0;
        winnerSound.play().catch(e => console.log(e));
      }
    } else {
      box.style.borderColor = '#ef4444';
      goTitle.style.color = '#ef4444';
    }
  }

  // --- LOGIKA TOMBOL (INI KUNCINYA) ---
  const btnGroup = document.querySelector('.go-buttons');
  if (btnGroup) {
    btnGroup.innerHTML = ''; // Hapus tombol lama biar ga numpuk!

    if (isTotalGameOver) {
      // A. GAME BENAR-BENAR SELESAI (Menang / Single Player Kalah / Semua Lawan Kalah)
      // Munculkan tombol Restart & Menu

      const btnRestart = document.createElement('button');
      btnRestart.textContent = "Main Lagi";
      btnRestart.onclick = () => {
        // Stop winner sound & play backsound
        if (winnerSound) {
          winnerSound.pause();
          winnerSound.currentTime = 0;
        }
        restartGame();
      };

      const btnMenu = document.createElement('button');
      btnMenu.textContent = "Menu Utama";
      btnMenu.className = "btn-secondary";
      btnMenu.onclick = () => {
        // Reset Manual UI & State
        if (gameOverOverlay) gameOverOverlay.classList.remove('active');
        document.getElementById("screen-game").classList.remove("active");
        document.getElementById("screen-setup").classList.add("active");

        // Stop all music
        stopMusic();

        // Reset variable global
        started = false;
        turn = 0;
        players = [];
        isProcessingTurn = false;
        if (diceEl) diceEl.classList.remove("roll");
        if (diceValueEl) diceValueEl.textContent = "Lempar dadu!";
      };

      btnGroup.appendChild(btnRestart);
      btnGroup.appendChild(btnMenu);

    } else {
      // B. CUMA ELIMINASI SATU PEMAIN (Multiplayer masih jalan)
      // Cuma tombol OK biar modal hilang

      const btnOk = document.createElement('button');
      btnOk.textContent = "Saya Mengerti (Lanjut Nonton)";
      btnOk.className = "btn-secondary";
      btnOk.onclick = () => {
        if (gameOverOverlay) gameOverOverlay.classList.remove('active');
        // Tidak perlu panggil nextTurn() manual di sini karena
        // logika dadu/turn flow sudah akan skip pemain bangkrut otomatis.
      };
      btnGroup.appendChild(btnOk);
    }
  }

  if (gameOverOverlay) gameOverOverlay.classList.add('active');
}

// 3. Fungsi Handle Game Over (Update Logika Multiplayer)
function handleGameOver(player) {
  player.isBankrupt = true;

  // Sembunyikan pion pemain yang kalah
  const pion = document.getElementById(`pion${player.id + 1}`);
  if (pion) pion.style.display = 'none';

  // Cek berapa pemain yang masih hidup
  const activePlayers = players.filter(p => !p.isBankrupt);

  // KONDISI 1: SINGLE PLAYER -> Kalah = Total Game Over
  if (players.length === 1) {
    showCustomModal(
      "GAME OVER!",
      "Uang dan tabunganmu habis. Coba lagi strategi keuanganmu!",
      false,
      true // TRUE = Tampilkan tombol Restart/Menu
    );
    return;
  }

  // KONDISI 2: MULTIPLAYER -> Masih ada teman main
  if (players.length > 1) {
    // Munculkan modal eliminasi (Bukan total game over)
    showCustomModal(
      "KAMU BANGKRUT!",
      `Sayang sekali ${player.name}, kamu tereliminasi. Pemain lain masih berjuang!`,
      false,
      false // FALSE = Cuma tombol "Saya Mengerti"
    );

    // Cek apakah setelah ini sisa 1 orang (Pemenang)
    checkWinnerBySurvival();
  }
}

// 4. Fungsi Cek Pemenang (Survival Mode)
function checkWinnerBySurvival() {
  const activePlayers = players.filter(p => !p.isBankrupt);

  // Jika Multiplayer DAN Sisa 1 orang yang bertahan
  if (players.length > 1 && activePlayers.length === 1) {
    const winner = activePlayers[0];

    // Beri delay 2 detik agar modal "Kamu Bangkrut" milik loser sempat terbaca
    // sebelum ditimpa modal "Pemenang"
    setTimeout(() => {
      showCustomModal(
        "PEMENANG!",
        `Selamat ${winner.name}! Kamu adalah satu-satunya yang bertahan!`,
        true, // Menang (Hijau)
        true  // Total Game Over (Ada tombol Restart)
      );
    }, 2000);
  }
}

/**
 * showCustomModal, handleGameOver, checkWinnerBySurvival
 * ------------------------------------------------------
 * Kumpulan fungsi untuk menampilkan modal game-over,
 * menangani eliminasi pemain, dan menentukan pemenang
 * pada mode survival (multiplayer).
 */

/* ======================================================
  12. WINNER MODAL & CONFETTI LOGIC
====================================================== */
const winnerModal = document.getElementById("winnerModal");
const winnerNameEl = document.getElementById("winnerName");
const confettiContainer = document.getElementById("confetti-container");
const backToMenuBtn = document.getElementById("backToMenuBtn");
const playAgainBtn = document.getElementById("playAgainBtn");

if (backToMenuBtn) {
  backToMenuBtn.addEventListener("click", () => {
    resetGameToMenu();
  });
}

if (playAgainBtn) {
  playAgainBtn.addEventListener("click", () => {
    restartGame();
  });
}

function restartGame() {
  // Restart dengan setting yang SAMA
  if (typeof startGameSession === 'function') {
    startGameSession(selectedPlayerCount, selectedCategoryKey);
  }
}

function showWinnerModal(name) {
  if (!winnerModal) return;

  if (winnerNameEl) winnerNameEl.textContent = name;
  winnerModal.classList.add("show");
  createConfetti();

  // [BARU] Stop backsound, play winner sound
  if (backsound) backsound.pause();
  if (winnerSound) {
    winnerSound.currentTime = 0;
    winnerSound.play().catch(e => console.log("Winner sound play error:", e));
  }
}

function createConfetti() {
  if (!confettiContainer) return;
  confettiContainer.innerHTML = "";

  const colors = ["#ef4444", "#22c55e", "#3b82f6", "#f59e0b", "#a855f7"];

  for (let i = 0; i < 100; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = Math.random() * 100 + "%";
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animation = `fall ${Math.random() * 3 + 2}s linear infinite`;
    confetti.style.animationDelay = Math.random() * 5 + "s";
    confettiContainer.appendChild(confetti);
  }
}

function resetGameToMenu() {
  winnerModal.classList.remove("show");
  if (typeof gameOverOverlay !== 'undefined' && gameOverOverlay) gameOverOverlay.classList.remove('active');
  document.getElementById("screen-game").classList.remove("active");
  document.getElementById("screen-setup").classList.add("active");

  started = false;
  turn = 0;
  players = [];
  isProcessingTurn = false;

  diceEl.classList.remove("roll");
  diceEl.removeAttribute("aria-disabled");
  diceValueEl.textContent = "Lempar dadu!";

  pionEls.forEach((p) => (p.style.display = "none"));
  playerInfoBoxes.forEach((box) => (box.style.display = "none"));

  stopMusic();
}

/**
 * updateTurnIndicator
 * Highlight panel pemain yang sedang giliran.
 * [UPDATED] Safe Visuals (Glow + Scale via CSS)
 */
function updateTurnIndicator() {
  players.forEach((p, index) => {
    const box = playerInfoBoxes[index];
    if (!box) return;

    if (index === turn % players.length) {
      box.classList.add("active-turn");
      box.style.setProperty('--player-color', p.color);
      // Hapus inline interference
      box.style.border = "";
      box.style.transform = "";
    } else {
      box.classList.remove("active-turn");
      box.style.removeProperty('--player-color');
      // Reset defaults
      box.style.border = "none";
      box.style.transform = "scale(1)";
    }
  });
}

/* ======================================================
   13. LOADING LOGIC
====================================================== */
/* ======================================================
   13. LOADING LOGIC
====================================================== */
function performInitialLoading() {
  const overlay = document.getElementById("loading-overlay");
  const bar = document.getElementById("progressBar");
  const txt = document.getElementById("loadingText");
  const landing = document.getElementById("screen-landing");

  if (overlay) overlay.classList.remove("hidden");

  // Load Data Normally
  const dataLoadPromise = loadGameData().then(() => {
    console.log("Data loaded for Loading Screen");
  });

  // [BARU] Preload Image Promise
  const imageLoadPromise = new Promise((resolve) => {
    const img = new Image();
    img.src = "assets/images/mascot.png";
    img.onload = () => resolve();
    img.onerror = () => resolve(); // Tetap lanjut meski error
  });

  // Tunggu semua (Data + Image) sebentar, tapi tetap jalankan animasi progress
  Promise.all([dataLoadPromise, imageLoadPromise]).then(() => {
    // Optional: Bisa percepat progress di sini jika mau
    // console.log("All Assets Ready");
  });

  // Simulasi Progress
  let width = 0;
  const timer = setInterval(() => {
    width += Math.random() * 12; // Lebih cepat sedikit biar ga bosen
    if (width > 100) width = 100;

    if (bar) bar.style.width = width + "%";

    // Text changes
    if (txt) {
      if (width < 30) txt.textContent = "Menghubungkan ke server...";
      else if (width < 60) txt.textContent = "Memuat aset permainan...";
      else if (width < 90) txt.textContent = "Menyiapkan papan...";
      else txt.textContent = "Siap bermain!";
    }

    if (width >= 100) {
      clearInterval(timer);
      setTimeout(() => {
        if (overlay) overlay.classList.add("hidden");
        if (landing) landing.classList.add("active");
      }, 500);
    }
  }, 150); // Speed up interval slightly
}

// Init when DOM ready
document.addEventListener("DOMContentLoaded", () => {
  performInitialLoading();
});

// loadGameData(); // Moved to performInitialLoading
