// ── Spieldaten ──
const games = [
  {
    title: "Game 1",
    image: "https://placehold.co/400x200/1a1a2e/4a90e2?text=Game+1",
    description: "Ein spannendes Abenteuer wartet auf dich. Erkunde unbekannte Welten.",
    url: "games/game1.html"
  },
  {
    title: "Game 2",
    image: "https://placehold.co/400x200/1a2e1a/4ae27a?text=Game+2",
    description: "Teste deine Reflexe in diesem schnellen Action-Spiel.",
    url: "games/game2.html"
  }
];

// ── Overlay ──
const overlay   = document.getElementById("overlay");
const gameFrame = document.getElementById("game-frame");

function openGame(url) {
  gameFrame.src = url;
  overlay.style.display = "flex";
}

function closeGame() {
  overlay.style.display = "none";
  gameFrame.src = "";          // Spiel stoppen
}

// ESC schließt das Overlay
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") closeGame();
});

// ── Karten rendern ──
const grid = document.getElementById("game-grid");

games.forEach(function(game) {
  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML =
    '<img src="' + game.image + '" alt="' + game.title + '" />' +
    '<div class="card-body">' +
      '<h2>' + game.title + '</h2>' +
      '<p>' + game.description + '</p>' +
    '</div>';

  card.addEventListener("click", function() {
    openGame(game.url);        // ← Overlay öffnen, nicht navigieren
  });

  grid.appendChild(card);
});
