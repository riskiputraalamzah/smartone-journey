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

const LEVEL_THRESHOLDS = { 2: 130000, 3: 300000 };
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
async function loadGameData() {
  try {
    const response = await fetch("data_game.json");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    allGameData = await response.json();
    populateCategorySelect();
    startBtn.disabled = false;
    startBtn.textContent = "Yok Mulai";
  } catch (err) {
    console.error("Gagal memuat data_game.json:", err);
    turnInfoEl.textContent = "Error: Gagal memuat data.";
  }
}

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
function createPlayers(n = 2) {
  players = Array.from({ length: n }).map((_, i) => ({
    id: i,
    name: `P${i + 1}`,
    color: tokenColors[i % tokenColors.length],
    pos: 0,
    points: 50000,
    savingsPoints: 0,
    laps: 0,
    level: 1,
    usedQuestions: { 1: new Set(), 2: new Set(), 3: new Set() },
  }));
  updatePlayersPanel();
  placeAllPions();
}

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
        <span style="font-size:0.8em; background:rgba(0,0,0,0.2); padding:2px 6px; border-radius:10px;">
          ⭐ Lv.${p.level}
        </span>
      </div>
      <div class="p-body">
        <div class="p-row">
          <span>💰</span> <span>${fmt(p.points)}</span>
        </div>
        <div class="p-row">
          <span>🏦</span> <span>${fmt(p.savingsPoints)}</span>
        </div>
        <div class="p-row" style="font-size:0.8em; opacity:0.7; margin-top:6px;">
          <span>🔄 Putaran: ${p.laps}</span>
        </div>
      </div>
    `;
    box.style.boxShadow = `0 8px 20px rgba(0,0,0,0.3), 0 0 0 2px ${p.color}`;
  });
}

function currentPlayer() {
  return players[turn % players.length];
}
function nextTurn() {
  turn = (turn + 1) % players.length;
  setTurnInfo();
}
function setTurnInfo() {
  const p = currentPlayer();
  diceValueEl.textContent = `Giliran ${p.name} melempar dadu!`;
}

/* ------------------------------------------------------
   4. MOVEMENT LOGIC
------------------------------------------------------ */
function tileElementAt(r, c) {
  return boardEl.querySelector(`.tile[data-pos="${r}-${c}"]`);
}

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
  const left =
    tileRect.left -
    boardRect.left +
    tileRect.width / 2 -
    (pion.offsetWidth || 32) / 2;
  const top =
    tileRect.top -
    boardRect.top +
    tileRect.height / 2 -
    (pion.offsetHeight || 32) / 2;

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
function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function applyStartBonus(player) {
  player.points += 10000;
  showInModalOrNotif(`${player.name} melewati START: +10.000 Poin`);
}

function resolveTile(player) {
  const tile = currentTiles[player.pos % currentTiles.length];
  const eduText = currentEduText[tile.type] || "";

  let pointMessage = "";
  let runQuiz = false;

  switch (tile.type) {
    case T.INCOME:
      player.points += tile.points;
      pointMessage = `${player.name}: ${tile.title} ${toPoinStr(tile.points)}`;
      break;
    case T.EXPENSE:
      player.points += tile.points;
      pointMessage = `${player.name}: ${tile.title} ${toPoinStr(tile.points)}`;
      break;
    case T.TAX: {
      const cut = Math.floor(player.points * (tile.percent / 100));
      player.points -= cut;
      pointMessage = `${player.name}: Bayar ${tile.title} ${toPoinStr(-cut)}`;
      break;
    }
    case T.SAVE:
      if (player.points >= tile.points) {
        player.points -= tile.points;
        player.savingsPoints += tile.points;
        pointMessage = `${player.name}: Menabung ${toPoinStr(tile.points)}`;
      } else {
        pointMessage = `${player.name}: Poin kurang untuk menabung.`;
      }
      break;
    case T.BONUS:
      pointMessage = `${player.name}: ${tile.title}!`;
      runQuiz = true;
      break;
    case T.PENALTY:
      player.points += tile.points;
      pointMessage = `${player.name}: Denda ${tile.title} ${toPoinStr(
        tile.points
      )}`;
      break;
    case T.START:
      pointMessage = `${player.name} di START.`;
      break;
  }

  if (pointMessage) {
    showInModalOrNotif(pointMessage, eduText);
  }

  if (runQuiz) {
    setTimeout(() => {
      handleQuiz(player);
    }, 500);
  }

  updatePlayerLevel(player);
  updatePlayersPanel();
}

function fmt(n) {
  return n.toLocaleString("id-ID");
}
function toPoinStr(n) {
  return (
    (n < 0 ? "-" : "+") + " " + Math.abs(n).toLocaleString("id-ID") + " Poin"
  );
}

/* ------------------------------------------------------
   6. NOTIFICATIONS
------------------------------------------------------ */
function showNotif(msg, eduMsg = "", time = 2500) {
  let html = `<span>${msg}</span>`;
  if (eduMsg) html += `<small>${eduMsg}</small>`;
  notifPopup.innerHTML = html;

  const duration = eduMsg ? 4500 : time;

  notifPopup.classList.add("show");
  clearTimeout(notifPopup._t);
  notifPopup._t = setTimeout(
    () => notifPopup.classList.remove("show"),
    duration
  );
}

function showInModalOrNotif(msg, eduMsg = "", time = 2000) {
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

/* ------------------------------------------------------
   7. QUIZ SYSTEM
------------------------------------------------------ */
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
      } catch (e) {}
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
   8. ANIMATION & FLOW
------------------------------------------------------ */
function rollDiceAnimated() {
  return new Promise((resolve) => {
    playDiceSound();
    const result = Math.floor(Math.random() * 6) + 1;
    const diceContainer = diceEl.querySelector('.dice-container');

    // Hapus kelas hasil sebelumnya
    for (let i = 1; i <= 6; i++) {
      diceContainer.classList.remove('show-' + i);
    }

    // Tambahkan kelas untuk animasi roll
    diceEl.classList.add("roll");

    setTimeout(() => {
      diceEl.classList.remove("roll");
      // Tampilkan sisi yang benar
      diceContainer.classList.add('show-' + result);
      resolve(result);
    }, 800); // Sesuaikan durasi dengan animasi di CSS
  });
}

async function movePlayerAnimated(player, steps) {
  const ringLen = path.length;
  for (let i = 0; i < steps; i++) {
    const oldPos = player.pos;
    player.pos = (player.pos + 1) % ringLen;

    if (player.pos === 0 && oldPos !== 0) {
      player.laps++;
      applyStartBonus(player);
      updatePlayersPanel();
    }
    updatePionPosition(player);
    await new Promise((r) => setTimeout(r, 220));
  }
  highlightLanding(player.pos);
  resolveTile(player);
  updatePlayersPanel();
}

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
    showNotif(
      `${player.name}: Jawaban benar! +${bonus.toLocaleString("id-ID")} poin`
    );
  } else {
    showNotif(`${player.name}: Jawaban salah.`);
  }

  updatePlayersPanel();
  updatePlayerLevel(player);
}

function highlightLanding(index) {
  const tile = boardEl
    .querySelector(`.tokens[data-idx="${index}"]`)
    ?.closest(".tile");
  if (!tile) return;
  tile.classList.add("highlight");
  setTimeout(() => tile.classList.remove("highlight"), 1200);
}

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
    /* ignore */
  }
}

/* ------------------------------------------------------
   9. EVENT LISTENERS & START
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
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 4. Ganti Giliran & Buka Kunci
  nextTurn();
  diceEl.removeAttribute("aria-disabled");
  isProcessingTurn = false; // Siap untuk klik berikutnya

  setTimeout(scrollToTurnPanel, 500);
});
// =============================================

// Klik Tombol Mulai (Start)
startBtn.addEventListener("click", () => {
  const n = selectedPlayerCount;
  const categoryKey = selectedCategoryKey;
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
  createPlayers(n);
  turn = 0;
  started = true;
  setTurnInfo();
  diceEl.removeAttribute("aria-disabled");

  // Reset flag
  isProcessingTurn = false;

  document.getElementById("screen-setup").classList.remove("active");
  document.getElementById("screen-game").classList.add("active");

  setTimeout(placeAllPions, 150);
});

function updatePlayerLevel(player) {
  const oldLevel = player.level;
  if (player.points >= LEVEL_THRESHOLDS[3]) player.level = 3;
  else if (player.points >= LEVEL_THRESHOLDS[2]) player.level = 2;
  else player.level = 1;

  if (player.level !== oldLevel) {
    showInModalOrNotif(
      `${player.name} naik ke LEVEL ${player.level}!`,
      "",
      1800
    );
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
    diceEl.textContent = "🎲";
    diceEl.classList.remove("roll");
    pionEls.forEach((p) => (p.style.display = "none"));
    playerInfoBoxes.forEach((box) => (box.style.display = "none"));
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
  } catch (e) {}
}
function closeHowToPlayModal() {
  try {
    howToPlayModal.close();
  } catch (e) {}
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
function scrollToTurnPanel() {
  if (window.innerWidth > 768) return;
  turnInfoEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

loadGameData();
