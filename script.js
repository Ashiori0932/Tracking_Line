const canvas = document.getElementById("scoreChart");
const ctx = canvas.getContext("2d");

const MATCH_DURATION = 1150;
const WINDOW_SIZE = 12;
const CENTER_MATCH = WINDOW_SIZE / 2;
const COLORS = [
  "#cf3f27", "#126783", "#ce9215", "#39714e", "#745087",
  "#db655d", "#59666e", "#718a31", "#30467d", "#ae6220"
];
const teams = COLORS.map((color, index) => ({ color, index, values: [0] }));

let startTime = performance.now();
let lastFrame = startTime;
let displayedRange = 60;


function scoreForMatch(team, match, previous) {
  const direction = team % 2 === 0 ? 1 : -1;
  const volatility = 10 + 34 * (0.5 + 0.5 * Math.sin(match * 0.14 - 1.2));
  const swing = Math.sin(match * 0.82 + team * 1.73) * volatility;
  const shock = Math.sin(match * 2.37 + team * 4.11) * volatility * 0.45;
  const pullToZero = -previous * 0.13;
  return Math.round(previous + direction * 5 + swing + shock + pullToZero);
}

function ensureData(lastMatch) {
  teams.forEach((team) => {
    while (team.values.length <= lastMatch + 1) {
      const match = team.values.length;
      team.values.push(scoreForMatch(team.index, match, team.values.at(-1)));
    }
  });
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function valueAt(team, time) {
  const match = Math.floor(time);
  const fraction = time - match;
  const from = team.values[match];
  const to = team.values[match + 1];
  const eased = fraction * fraction * (3 - 2 * fraction);
  return from + (to - from) * eased;
}

function appendSmoothCurve(points) {
  if (points.length === 0) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const controlX = (previous.x + current.x) / 2;
    ctx.bezierCurveTo(controlX, previous.y, controlX, current.y, current.x, current.y);
  }
}


function niceStep(rawStep) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rawStep, 1)));
  const fraction = rawStep / magnitude;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * magnitude;
}

function scaleForPeak(peak) {
  const majorStep = niceStep((peak * 2.3) / 8);
  return {
    majorStep,
    range: Math.max(majorStep * 2, Math.ceil((peak * 1.12) / majorStep) * majorStep)
  };

}

function draw(now) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const margin = {
    left: Math.max(48, Math.min(78, width * 0.065)),
    right: Math.max(18, width * 0.025),
    top: Math.max(18, height * 0.035),
    bottom: Math.max(42, height * 0.075)
  };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const playhead = Math.max(0, (now - startTime) / MATCH_DURATION);
  const completedMatch = Math.floor(playhead);
  ensureData(completedMatch + 1);

  // The viewport starts still, then follows the playhead continuously once it reaches center.
  const viewStart = Math.max(0, playhead - CENTER_MATCH);
  const viewEnd = viewStart + WINDOW_SIZE;
  const xAt = match => margin.left + ((match - viewStart) / WINDOW_SIZE) * plotWidth;

  const visibleValues = teams.flatMap((team) => {
    const first = Math.ceil(viewStart);
    const values = team.values.slice(first, completedMatch + 1);
    values.push(valueAt(team, viewStart), valueAt(team, playhead));
    return values;
  });
  const peak = Math.max(8, ...visibleValues.map(Math.abs));
  const scale = scaleForPeak(peak);
  const targetRange = scale.range;
  const frameSeconds = Math.min(0.05, (now - lastFrame) / 1000);
  const scaleRate = targetRange > displayedRange ? 6 : 1.8;
  displayedRange += (targetRange - displayedRange) * (1 - Math.exp(-scaleRate * frameSeconds));

  lastFrame = now;

  const yAt = score => margin.top + plotHeight / 2 - (score / displayedRange) * (plotHeight / 2);
  ctx.clearRect(0, 0, width, height);

  ctx.font = `${width < 520 ? 9 : 11}px "Courier New", monospace`;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";


  // Minor and major elevation contours make the current Y-axis scale explicit.
  const contourStep = niceStep((displayedRange * 2) / 8);
  const minorStep = contourStep / 2;
  const firstContour = Math.ceil(-displayedRange / minorStep) * minorStep;
  for (let score = firstContour; score <= displayedRange; score += minorStep) {
    const isZero = Math.abs(score) < minorStep / 10;
    const isMajor = Math.abs(score / contourStep - Math.round(score / contourStep)) < 0.01;
    const y = yAt(score);
    ctx.strokeStyle = isZero
      ? "rgba(28,30,25,.8)"
      : isMajor ? "rgba(28,30,25,.22)" : "rgba(28,30,25,.1)";
    ctx.lineWidth = isZero ? 1.6 : isMajor ? 1 : 0.7;
    ctx.setLineDash(isZero ? [] : isMajor ? [3, 5] : [1, 6]);
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();

    if (isMajor) {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(margin.left - 5, y);
      ctx.lineTo(margin.left, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(28,30,25,.72)";
      ctx.fillText(Math.round(score), margin.left - 10, y);
    }
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let match = Math.ceil(viewStart); match <= Math.floor(viewEnd); match += 1) {
    const x = xAt(match);
    ctx.strokeStyle = "rgba(28,30,25,.1)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, height - margin.bottom);
    ctx.stroke();
    ctx.fillStyle = "rgba(28,30,25,.68)";
    ctx.fillText(String(match), x, height - margin.bottom + 12);
  }

  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(28,30,25,.72)";
  ctx.lineWidth = 1;
  ctx.strokeRect(margin.left, margin.top, plotWidth, plotHeight);

  teams.forEach((team) => {
    const points = [];
    const firstMatch = Math.max(0, Math.floor(viewStart) - 1);
    for (let match = firstMatch; match <= completedMatch; match += 1) {
      points.push({ x: xAt(match), y: yAt(team.values[match]) });
    }
    if (playhead > 0) {
      points.push({ x: xAt(playhead), y: yAt(valueAt(team, playhead)) });
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(margin.left, margin.top, plotWidth, plotHeight);
    ctx.clip();
    ctx.beginPath();
    appendSmoothCurve(points);
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = team.color;
    ctx.lineWidth = width < 520 ? 2 : 2.7;
    ctx.stroke();
    const tip = points.at(-1);
    if (tip) {
      ctx.fillStyle = team.color;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, width < 520 ? 2.5 : 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  requestAnimationFrame(draw);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

requestAnimationFrame(draw);
