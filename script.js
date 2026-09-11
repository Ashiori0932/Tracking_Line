const canvas = document.getElementById("scoreChart");
const ctx = canvas.getContext("2d");
const roundNumber = document.getElementById("roundNumber");
const legend = document.getElementById("legend");
const toggleButton = document.getElementById("toggleButton");
const resetButton = document.getElementById("resetButton");
const speedRange = document.getElementById("speedRange");
const speedLabel = document.getElementById("speedLabel");
const statusText = document.getElementById("statusText");

const teams = [
  ["赤焰队", "#d74328"], ["深海队", "#176c8d"], ["金雀队", "#d29c19"], ["松林队", "#3f7554"], ["紫电队", "#76568c"],
  ["珊瑚队", "#e06e66"], ["钢铁队", "#657179"], ["青柠队", "#7d9439"], ["靛蓝队", "#334a84"], ["琥珀队", "#b76a25"]
].map(([name, color], index) => ({ name, color, index, values: [0], score: 0 }));

let running = true;
let interval = Number(speedRange.value);
let lastStep = performance.now();
let animationStart = lastStep;
let round = 0;
let yRange = 20;
let drawnRange = 20;

teams.forEach((team) => {
  const item = document.createElement("div");
  item.className = "legend-item";
  item.style.setProperty("--team", team.color);
  item.innerHTML = `<span class="swatch"></span><span class="team-name">${team.name}</span><strong class="team-score">0</strong>`;
  legend.appendChild(item);
  team.scoreElement = item.querySelector(".team-score");
});

function seededDelta(team, match) {
  const wave = Math.sin(match * 1.37 + team * 2.11) + Math.cos(match * .61 + team * .83);
  const noise = Math.sin(match * team * .47 + team * 13.1) * 1.6;
  return Math.round(wave * 2.2 + noise);
}

function nextRound() {
  round += 1;
  teams.forEach((team) => {
    const momentum = Math.sin(round / 6 + team.index) * .5;
    team.score += seededDelta(team.index + 1, round) + Math.round(momentum);
    team.values.push(team.score);
    team.scoreElement.textContent = `${team.score > 0 ? "+" : ""}${team.score}`;
  });
  roundNumber.textContent = String(round).padStart(2, "0");
  const visibleStart = Math.max(0, round - 11);
  const peak = Math.max(10, ...teams.flatMap(team => team.values.slice(visibleStart).map(Math.abs)));
  yRange = Math.ceil((peak + 5) / 10) * 10;
  animationStart = performance.now();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function smoothPath(points) {
  if (!points.length) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    ctx.bezierCurveTo(midX, prev.y, midX, curr.y, curr.x, curr.y);
  }
}

function draw(now) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);
  const margin = { left: width < 520 ? 43 : 62, right: 25, top: 24, bottom: 42 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const progress = Math.min(1, (now - animationStart) / Math.min(interval * .72, 600));
  const eased = 1 - Math.pow(1 - progress, 3);
  drawnRange += (yRange - drawnRange) * .055;

  // Keep early rounds moving right; after round six, pin the newest point near the middle and scroll history.
  const slots = 12;
  const xMax = round < 6 ? 6 : round + 6;
  const xMin = Math.max(0, xMax - slots);
  const fractionalRound = Math.max(0, round - 1 + eased);
  const viewShift = round < 6 ? 0 : 1 - eased;
  const viewMin = xMin - viewShift;
  const viewMax = xMax - viewShift;
  const xAt = value => margin.left + ((value - viewMin) / (viewMax - viewMin)) * plotW;
  const yAt = value => margin.top + plotH / 2 - (value / drawnRange) * (plotH / 2);

  ctx.font = `10px "Courier New", monospace`;
  ctx.lineWidth = 1;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = -4; i <= 4; i += 1) {
    const value = (drawnRange / 4) * i;
    const y = yAt(value);
    ctx.strokeStyle = i === 0 ? "rgba(32,36,31,.72)" : "rgba(32,36,31,.15)";
    ctx.lineWidth = i === 0 ? 1.6 : 1;
    ctx.setLineDash(i === 0 ? [] : [2, 4]);
    ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(width - margin.right, y); ctx.stroke();
    ctx.fillStyle = "rgba(32,36,31,.68)";
    ctx.fillText(Math.round(value), margin.left - 9, y);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let match = Math.ceil(viewMin); match <= Math.floor(viewMax); match += 2) {
    if (match < 0) continue;
    const x = xAt(match);
    ctx.strokeStyle = "rgba(32,36,31,.11)";
    ctx.setLineDash([2, 5]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, margin.top); ctx.lineTo(x, height - margin.bottom); ctx.stroke();
    ctx.fillStyle = "rgba(32,36,31,.68)"; ctx.fillText(String(match).padStart(2, "0"), x, height - margin.bottom + 11);
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(32,36,31,.75)";
  ctx.strokeRect(margin.left, margin.top, plotW, plotH);

  teams.forEach((team) => {
    const points = [];
    team.values.forEach((value, index) => {
      if (index < viewMin - 1 || index > fractionalRound) return;
      let animatedValue = value;
      if (index === round && round > 0) animatedValue = team.values[index - 1] + (value - team.values[index - 1]) * eased;
      points.push({ x: xAt(index), y: yAt(animatedValue) });
    });
    ctx.beginPath(); smoothPath(points);
    ctx.strokeStyle = team.color; ctx.lineWidth = 2.6; ctx.globalAlpha = .92; ctx.stroke();
    const point = points.at(-1);
    if (point) {
      ctx.fillStyle = team.color; ctx.beginPath(); ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#eee9d9"; ctx.lineWidth = 1; ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
  requestAnimationFrame(draw);
}

function reset() {
  round = 0; yRange = 20; drawnRange = 20;
  teams.forEach(team => { team.score = 0; team.values = [0]; team.scoreElement.textContent = "0"; });
  roundNumber.textContent = "00"; animationStart = performance.now(); lastStep = performance.now();
}

toggleButton.addEventListener("click", () => {
  running = !running;
  toggleButton.querySelector(".button-icon").textContent = running ? "Ⅱ" : "▶";
  toggleButton.querySelector(".button-text").textContent = running ? "暂停记录" : "继续记录";
  statusText.textContent = running ? "正在接收赛况数据" : "记录已暂停";
  document.body.classList.toggle("paused", !running);
  lastStep = performance.now();
});
resetButton.addEventListener("click", reset);
speedRange.addEventListener("input", () => {
  interval = Number(speedRange.value);
  const label = interval < 700 ? "快速" : interval > 1150 ? "慢速" : "标准";
  speedLabel.textContent = label; speedRange.setAttribute("aria-valuetext", label);
});
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
requestAnimationFrame(draw);
setInterval(() => {
  const now = performance.now();
  if (running && now - lastStep >= interval) { nextRound(); lastStep = now; }
}, 100);

