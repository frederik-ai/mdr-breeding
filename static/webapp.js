const DISEASES = ["CA", "HERDA", "PSSM", "EMH", "ASD", "HYPP", "LFS", "SCID", "GBED", "JEB"];
const BODY_PARTS = [
  "Kopf", "Gebiss", "Hals", "Halsansatz", "Widerrist", "Schulter",
  "Brust", "Rückenlinie", "Rückenlänge", "Kruppe", "Beinwinkelung",
  "Beinstellung", "Fesseln", "Hufe",
];
const INTERIEUR_CATEGORIES = [
  "Temperament", "Gelehrigkeit", "Leistungsbereitschaft",
  "Aufmerksamkeit", "Gutmütigkeit", "Nervenstärke",
  "Intelligenz", "Siegeswille", "Furchtlosigkeit", "Sozialverhalten",
];

const STORAGE_KEY = "mdr-breeding-horses-v2";
const pageName = document.documentElement.dataset.page || document.body.dataset.page || "home";
const queryParams = new URLSearchParams(window.location.search);
const initialSelectedName = queryParams.get("name") || queryParams.get("edit") || null;

const state = {
  horses: [],
  editingName: null,
  selectedName: null,
};

const elements = {
  flash: document.getElementById("flash"),
  importForm: document.getElementById("importForm"),
  csvFile: document.getElementById("csvFile"),
  downloadButton: document.getElementById("downloadButton"),
  resetButton: document.getElementById("resetButton"),
  horseSelect: document.getElementById("horseSelect"),
  summaryText: document.getElementById("summaryText"),
  horseCount: document.getElementById("horseCount"),
  mateCount: document.getElementById("mateCount"),
  formTitle: document.getElementById("formTitle"),
  newHorseButton: document.getElementById("newHorseButton"),
  horseForm: document.getElementById("horseForm"),
  nameInput: document.getElementById("nameInput"),
  raceInput: document.getElementById("raceInput"),
  colorInput: document.getElementById("colorInput"),
  exterieurInput: document.getElementById("exterieurInput"),
  interieurInput: document.getElementById("interieurInput"),
  diseaseGrid: document.getElementById("diseaseGrid"),
  saveButton: document.getElementById("saveButton"),
  cancelEditButton: document.getElementById("cancelEditButton"),
  horseTableBody: document.getElementById("horseTableBody"),
  detailContent: document.getElementById("detailContent"),
  bestMateSelect: document.getElementById("bestMateSelect"),
  bestMateRaceFilter: document.getElementById("bestMateRaceFilter"),
  bestMateSexFilter: document.getElementById("bestMateSexFilter"),
  bestMateStats: document.getElementById("bestMateStats"),
  bestMateBody: document.getElementById("bestMateBody"),
};

function loadStoredHorses() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredHorses() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.horses));
}

function setInitialSelection() {
  if (initialSelectedName && horseByName(initialSelectedName)) {
    state.selectedName = initialSelectedName;
    return;
  }

  state.selectedName = state.horses[0]?.name ?? null;
}

state.horses = loadStoredHorses();
setInitialSelection();

function showFlash(message, type = "info") {
  elements.flash.textContent = message;
  elements.flash.classList.remove("hidden");
  elements.flash.dataset.type = type;
}

function hideFlash() {
  elements.flash.classList.add("hidden");
  elements.flash.textContent = "";
  delete elements.flash.dataset.type;
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function parseCsv(text) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      current.push(field);
      field = "";
    } else if (char === '\n') {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
    } else if (char === '\r') {
      continue;
    } else {
      field += char;
    }
  }

  current.push(field);
  rows.push(current);

  return rows.filter((row) => row.some((cell) => String(cell).trim() !== ""));
}

function toCsv(horses) {
  const headers = ["name", "sex", "race", "color", "diseases", "exterieur", "interieur", "tournament_ratings"];
  const rows = [headers.join(",")];
  for (const horse of horses) {
    rows.push(headers.map((header) => escapeCsv(horse[header] ?? "")).join(","));
  }
  return `${rows.join("\n")}\n`;
}

function parseDiseasesFromField(value) {
  const diseases = {};
  for (const disease of DISEASES) {
    diseases[disease] = false;
  }

  if (!value || !String(value).trim()) {
    return diseases;
  }

  const tokens = String(value)
    .replace(/^[\[{]/, "")
    .replace(/[\]}]$/, "")
    .split(/[;,]/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    if (token.includes(":") || token.includes("'")) {
      continue;
    }
    if (DISEASES.includes(token.toUpperCase())) {
      diseases[token.toUpperCase()] = true;
    }
  }

  return diseases;
}

function serializeDiseases(diseases) {
  return JSON.stringify(diseases);
}

function parseJsonField(value, fallback) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseTabBlock(text, validKeys) {
  const result = {};
  const lines = String(text || "").split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const [key, ...rest] = line.split("\t");
    if (!key || rest.length === 0) continue;
    const value = rest.join("\t").trim();
    const trimmedKey = key.trim();
    if (validKeys.includes(trimmedKey)) {
      result[trimmedKey] = value;
    }
  }
  return result;
}

function buildTabBlock(keys, values) {
  return keys.map((key) => `${key}\t${values[key] ?? ""}`).join("\n");
}

function horseUrl(page, name, param = "name") {
  const url = new URL(`${page}.html`, window.location.href);
  url.searchParams.set(param, name);
  return `${url.pathname}${url.search}`;
}

function normalizePair(token) {
  const trimmed = token.trim();
  if (trimmed.length !== 2) {
    return trimmed;
  }
  return trimmed === "hH" ? "Hh" : trimmed;
}

function countToNote(count) {
  if (count >= 4) return 1;
  if (count === 3) return 2;
  if (count === 2) return 3;
  if (count === 1) return 4;
  return 5;
}

function childGenotypeOptions(parentA, parentB) {
  const gametesA = [...parentA].filter((char) => char === "H" || char === "h");
  const gametesB = [...parentB].filter((char) => char === "H" || char === "h");
  if (gametesA.length !== 2 || gametesB.length !== 2) {
    return new Set();
  }

  const options = new Set();
  for (const a of gametesA) {
    for (const b of gametesB) {
      const pair = [a, b].sort((left, right) => {
        if ((left === left.toLowerCase()) !== (right === right.toLowerCase())) {
          return left === left.toLowerCase() ? 1 : -1;
        }
        return left.localeCompare(right);
      }).join("");
      options.add(normalizePair(pair));
    }
  }
  return options;
}

function compareExterieur(parent1, parent2) {
  const details = {};
  const bestNotes = [];
  const worstNotes = [];

  for (const part of BODY_PARTS) {
    const g1 = parent1[part] || "";
    const g2 = parent2[part] || "";

    try {
      const [left1, right1] = g1.split("|").map((piece) => piece.trim());
      const [left2, right2] = g2.split("|").map((piece) => piece.trim());
      const tokens1 = [...left1.split(/\s+/), ...right1.split(/\s+/)].map(normalizePair);
      const tokens2 = [...left2.split(/\s+/), ...right2.split(/\s+/)].map(normalizePair);

      if (tokens1.length !== 8 || tokens2.length !== 8) {
        throw new Error("bad gene code");
      }

      let bestFront = 0;
      let bestBack = 0;
      let worstFront = 0;
      let worstBack = 0;
      for (let index = 0; index < 8; index += 1) {
        const childOptions = childGenotypeOptions(tokens1[index], tokens2[index]);
        if (childOptions.size === 0) {
          continue;
        }

        if (index < 4) {
          const matchBest = [...childOptions].some((genotype) => genotype.includes("H"));
          const matchWorst = [...childOptions].every((genotype) => genotype.includes("H"));
          if (matchBest) bestFront += 1;
          if (matchWorst) worstFront += 1;
        } else {
          const matchBest = childOptions.has("hh");
          const matchWorst = childOptions.size === 1 && childOptions.has("hh");
          if (matchBest) bestBack += 1;
          if (matchWorst) worstBack += 1;
        }
      }

      const bestCount = Math.min(bestFront, bestBack);
      const worstCount = Math.min(worstFront, worstBack);

      const bestNote = countToNote(bestCount);
      const worstNote = countToNote(worstCount);
      bestNotes.push(bestNote);
      worstNotes.push(worstNote);
      details[part] = {
        best_front: bestFront,
        best_back: bestBack,
        worst_front: worstFront,
        worst_back: worstBack,
        best_count: bestCount,
        worst_count: worstCount,
        best_note: bestNote,
        worst_note: worstNote,
      };
    } catch {
      bestNotes.push(5);
      worstNotes.push(5);
      details[part] = { best_count: 0, worst_count: 0, best_note: 5, worst_note: 5 };
    }
  }

  const average = (values) => values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
  return { bestAvg: average(bestNotes), worstAvg: average(worstNotes), details };
}

function createEmptyHorse() {
  const diseases = {};
  for (const disease of DISEASES) diseases[disease] = false;
  const exterieur = {};
  for (const part of BODY_PARTS) exterieur[part] = "";
  const interieur = {};
  for (const category of INTERIEUR_CATEGORIES) interieur[category] = "";
  return {
    name: "",
    sex: "Stallion",
    race: "",
    color: "/",
    diseases,
    exterieur,
    interieur,
    tournament_ratings: {},
  };
}

function importFromCsvText(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    state.horses = [];
    state.selectedName = null;
    saveStoredHorses();
    return;
  }

  const [headers, ...dataRows] = rows;
  const normalizedHeaders = headers.map((header) => String(header).trim());
  const horses = [];

  for (const row of dataRows) {
    const record = {};
    normalizedHeaders.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    const horse = {
      name: String(record.name ?? "").trim(),
      sex: String(record.sex ?? "").trim(),
      race: String(record.race ?? "").trim(),
      color: String(record.color ?? "/").trim() || "/",
      diseases: parseJsonField(record.diseases, {}),
      exterieur: parseJsonField(record.exterieur, {}),
      interieur: parseJsonField(record.interieur, {}),
      tournament_ratings: parseJsonField(record.tournament_ratings, {}),
    };

    for (const disease of DISEASES) {
      if (!(disease in horse.diseases)) {
        horse.diseases[disease] = false;
      }
    }
    for (const part of BODY_PARTS) {
      if (!(part in horse.exterieur)) {
        horse.exterieur[part] = "";
      }
    }
    for (const category of INTERIEUR_CATEGORIES) {
      if (!(category in horse.interieur)) {
        horse.interieur[category] = "";
      }
    }
    horses.push(horse);
  }

  state.horses = horses;
  state.selectedName = horses[0]?.name ?? null;
  saveStoredHorses();
}

function exportCsvText() {
  return toCsv(state.horses.map((horse) => ({
    name: horse.name,
    sex: horse.sex,
    race: horse.race,
    color: horse.color,
    diseases: serializeDiseases(horse.diseases),
    exterieur: JSON.stringify(horse.exterieur),
    interieur: JSON.stringify(horse.interieur),
    tournament_ratings: JSON.stringify(horse.tournament_ratings ?? {}),
  })));
}

function horseByName(name) {
  return state.horses.find((horse) => horse.name === name) || null;
}

function upsertHorse(horse) {
  const existingIndex = state.horses.findIndex((item) => item.name === horse.name);
  if (existingIndex >= 0) {
    state.horses[existingIndex] = horse;
  } else {
    state.horses.push(horse);
  }
  state.selectedName = horse.name;
  saveStoredHorses();
}

function replaceHorse(previousName, horse) {
  const existingIndex = state.horses.findIndex((item) => item.name === previousName);
  if (existingIndex >= 0) {
    state.horses.splice(existingIndex, 1, horse);
  } else {
    upsertHorse(horse);
    return;
  }
  state.selectedName = horse.name;
  saveStoredHorses();
}

function deleteHorse(name) {
  state.horses = state.horses.filter((horse) => horse.name !== name);
  if (state.selectedName === name) {
    state.selectedName = state.horses[0]?.name ?? null;
  }
  if (state.editingName === name) {
    cancelEdit();
  }
  saveStoredHorses();
}

function setEditingHorse(name) {
  const horse = horseByName(name);
  if (!horse) return;
  state.editingName = name;
  elements.formTitle.textContent = `Edit Horse: ${horse.name}`;
  elements.saveButton.textContent = "Save horse";
  elements.cancelEditButton.classList.remove("hidden");
  elements.nameInput.value = horse.name;
  elements.raceInput.value = horse.race;
  elements.colorInput.value = horse.color;
  const sexRadio = document.querySelector(`input[name="sex"][value="${horse.sex}"]`);
  if (sexRadio) sexRadio.checked = true;
  for (const disease of DISEASES) {
    const checkbox = document.querySelector(`input[name="disease_${disease}"]`);
    if (checkbox) checkbox.checked = Boolean(horse.diseases?.[disease]);
  }
  elements.exterieurInput.value = buildTabBlock(BODY_PARTS, horse.exterieur);
  elements.interieurInput.value = buildTabBlock(INTERIEUR_CATEGORIES, horse.interieur);
  showFlash(`Editing ${horse.name}.`);
}

function cancelEdit() {
  state.editingName = null;
  elements.formTitle.textContent = "Add Horse";
  elements.saveButton.textContent = "Add horse";
  elements.cancelEditButton.classList.add("hidden");
  elements.horseForm.reset();
  fillEmptyForm();
}

function fillEmptyForm() {
  elements.nameInput.value = "";
  elements.raceInput.value = "";
  elements.colorInput.value = "/";
  const stallion = document.querySelector('input[name="sex"][value="Stallion"]');
  if (stallion) stallion.checked = true;
  for (const disease of DISEASES) {
    const checkbox = document.querySelector(`input[name="disease_${disease}"]`);
    if (checkbox) checkbox.checked = false;
  }
  elements.exterieurInput.value = "";
  elements.interieurInput.value = "";
}

function renderDiseaseGrid() {
  elements.diseaseGrid.innerHTML = DISEASES.map((disease) => `
    <label class="toggle-pill">
      <input type="checkbox" name="disease_${disease}">
      <span>${disease}</span>
    </label>
  `).join("");
}

function currentHorseFromForm() {
  const formData = new FormData(elements.horseForm);
  const name = String(formData.get("name") ?? "").trim();
  const sex = String(formData.get("sex") ?? "").trim();
  const race = String(formData.get("race") ?? "").trim();
  const color = String(formData.get("color") ?? "/").trim() || "/";
  const diseases = {};
  for (const disease of DISEASES) {
    diseases[disease] = formData.get(`disease_${disease}`) === "on";
  }
  const exterieur = parseTabBlock(elements.exterieurInput.value, BODY_PARTS);
  const interieur = parseTabBlock(elements.interieurInput.value, INTERIEUR_CATEGORIES);

  for (const part of BODY_PARTS) {
    if (!(part in exterieur)) {
      exterieur[part] = "";
    }
  }
  for (const category of INTERIEUR_CATEGORIES) {
    if (!(category in interieur)) {
      interieur[category] = "";
    }
  }

  return {
    name,
    sex,
    race,
    color,
    diseases,
    exterieur,
    interieur,
    tournament_ratings: horseByName(state.editingName)?.tournament_ratings ?? {},
  };
}

function validateHorse(horse) {
  if (!horse.name) {
    throw new Error("Horse name cannot be empty.");
  }
  if (!horse.sex) {
    throw new Error("Horse sex is required.");
  }
  if (!horse.race) {
    throw new Error("Horse race is required.");
  }
  for (const part of BODY_PARTS) {
    if (!(part in horse.exterieur)) {
      throw new Error(`Missing body part: ${part}`);
    }
  }
  for (const category of INTERIEUR_CATEGORIES) {
    if (!(category in horse.interieur)) {
      throw new Error(`Missing interieur category: ${category}`);
    }
  }
}

function buildBestMateData(subject) {
  if (!subject) {
    return { stats: null, partners: [] };
  }

  const allOthers = state.horses.filter((horse) => horse.name !== subject.name);
  const excludedSex = allOthers.filter((horse) => horse.sex.trim().toLowerCase() === subject.sex.trim().toLowerCase());
  const remainingAfterSex = allOthers.filter((horse) => horse.sex.trim().toLowerCase() !== subject.sex.trim().toLowerCase());
  const excludedRace = remainingAfterSex.filter((horse) => horse.race.trim().toLowerCase() !== subject.race.trim().toLowerCase());
  const remainingAfterRace = remainingAfterSex.filter((horse) => horse.race.trim().toLowerCase() === subject.race.trim().toLowerCase());
  const excludedDisease = remainingAfterRace.filter((horse) => {
    const subjectDiseases = new Set(Object.entries(subject.diseases).filter(([, value]) => value).map(([key]) => key));
    const horseDiseases = new Set(Object.entries(horse.diseases).filter(([, value]) => value).map(([key]) => key));
    return [...subjectDiseases].some((disease) => horseDiseases.has(disease));
  });
  const remainingValid = remainingAfterRace.filter((horse) => {
    const subjectDiseases = new Set(Object.entries(subject.diseases).filter(([, value]) => value).map(([key]) => key));
    const horseDiseases = new Set(Object.entries(horse.diseases).filter(([, value]) => value).map(([key]) => key));
    return ![...subjectDiseases].some((disease) => horseDiseases.has(disease));
  });

  const partners = remainingValid.map((horse) => {
    const { bestAvg, worstAvg } = compareExterieur(subject.exterieur, horse.exterieur);
    const colorNote = subject.color !== "/" && horse.color !== "/" && subject.color.trim().toLowerCase() === horse.color.trim().toLowerCase()
      ? `(both horses are ${subject.color})`
      : "";
    return {
      name: horse.name,
      best_avg: bestAvg,
      worst_avg: worstAvg,
      color_note: colorNote,
    };
  }).sort((left, right) => left.best_avg - right.best_avg || left.worst_avg - right.worst_avg);

  return {
    stats: {
      total_others: allOthers.length,
      excluded_sex: excludedSex.length,
      excluded_race: excludedRace.length,
      excluded_disease: excludedDisease.length,
      remaining_valid: remainingValid.length,
    },
    partners,
  };
}

function renderHorseTable() {
  elements.horseTableBody.innerHTML = state.horses.map((horse) => `
    <tr>
      <td><a class="link-button" href="${horseUrl('view', horse.name)}">${horse.name}</a></td>
      <td>${horse.sex}</td>
      <td>${horse.race}</td>
      <td>${horse.color}</td>
      <td>
        <div class="row-actions">
          <a class="link-button" href="${horseUrl('view', horse.name)}">View</a>
          <a class="link-button" href="${horseUrl('add', horse.name, 'edit')}">Edit</a>
          <a class="link-button" href="${horseUrl('bestmates', horse.name)}">Best mates</a>
          <button class="link-button danger" data-action="delete" data-name="${horse.name}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="muted">No horses loaded yet.</td></tr>`;
}

function renderHorseSelect(selectElement, selectedName) {
  renderHorseSelectFrom(selectElement, state.horses, selectedName);
}

function renderHorseSelectFrom(selectElement, horses, selectedName) {
  if (!selectElement) {
    return;
  }

  const sortedHorses = [...horses].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  selectElement.innerHTML = sortedHorses.length
    ? sortedHorses.map((horse) => `<option value="${horse.name}" ${horse.name === selectedName ? "selected" : ""}>${horse.name}</option>`).join("")
    : `<option value="">No horses loaded</option>`;
}

function filterValues() {
  return {
    race: elements.bestMateRaceFilter?.value || "",
    sex: elements.bestMateSexFilter?.value || "",
  };
}

function filteredBestMateHorses() {
  const { race, sex } = filterValues();
  return state.horses.filter((horse) => {
    const raceMatches = !race || horse.race.trim().toLowerCase() === race.toLowerCase();
    const sexMatches = !sex || horse.sex.trim().toLowerCase() === sex.toLowerCase();
    return raceMatches && sexMatches;
  });
}

function renderBestMateFilters() {
  if (!elements.bestMateRaceFilter || !elements.bestMateSexFilter) {
    return;
  }

  const current = filterValues();
  const races = [...new Set(state.horses.map((horse) => horse.race.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  const sexes = [...new Set(state.horses.map((horse) => horse.sex.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));

  elements.bestMateRaceFilter.innerHTML = `<option value="">All races</option>${races.map((race) => `<option value="${race}">${race}</option>`).join("")}`;
  elements.bestMateSexFilter.innerHTML = `<option value="">All sexes</option>${sexes.map((sex) => `<option value="${sex}">${sex}</option>`).join("")}`;
  elements.bestMateRaceFilter.value = races.some((race) => race.toLowerCase() === current.race.toLowerCase()) ? current.race : "";
  elements.bestMateSexFilter.value = sexes.some((sex) => sex.toLowerCase() === current.sex.toLowerCase()) ? current.sex : "";
}

function renderDetails(name = state.selectedName) {
  const horse = horseByName(name);
  if (!horse) {
    elements.detailContent.innerHTML = '<div class="detail-empty muted">No horse selected.</div>';
    return;
  }

  const diseases = Object.entries(horse.diseases).filter(([, value]) => value).map(([key]) => key).join(", ") || "None";
  const exterieurRows = BODY_PARTS.map((part) => `<tr><td>${part}</td><td>${horse.exterieur?.[part] ?? ""}</td></tr>`).join("");
  const interieurRows = INTERIEUR_CATEGORIES.map((category) => `<tr><td>${category}</td><td>${horse.interieur?.[category] ?? ""}</td></tr>`).join("");

  elements.detailContent.innerHTML = `
    <div class="page-head compact">
      <div>
        <h3>${horse.name}</h3>
        <p class="muted"><strong>Sex:</strong> ${horse.sex} | <strong>Race:</strong> ${horse.race} | <strong>Color:</strong> ${horse.color}</p>
      </div>
    </div>
    <h4>Diseases</h4>
    <p>${diseases}</p>
    <h4>Exterieur</h4>
    <table><tbody><tr><th>Part</th><th>Genes</th></tr>${exterieurRows}</tbody></table>
    <h4>Interieur</h4>
    <table><tbody><tr><th>Category</th><th>Value</th></tr>${interieurRows}</tbody></table>
  `;
}

function renderBestMates(name = state.selectedName) {
  const subject = horseByName(name);
  const { stats, partners } = buildBestMateData(subject || null);
  if (!subject) {
    if (elements.bestMateStats) {
      elements.bestMateStats.textContent = "Select a horse to view mate ranking.";
    }
    if (elements.bestMateBody) {
      elements.bestMateBody.innerHTML = `<tr><td colspan="4" class="muted">No horse selected.</td></tr>`;
    }
    if (elements.bestMateSelect) {
      elements.bestMateSelect.innerHTML = `<option value="">No horses loaded</option>`;
    }
    if (elements.mateCount) {
      elements.mateCount.textContent = "0";
    }
    return;
  }

  if (elements.bestMateStats) {
    elements.bestMateStats.textContent = `Total other horses: ${stats.total_others} — excluded by sex: ${stats.excluded_sex}, excluded by race: ${stats.excluded_race}, excluded by shared disease: ${stats.excluded_disease}. Valid candidates: ${stats.remaining_valid}.`;
  }
  if (elements.bestMateBody) {
    elements.bestMateBody.innerHTML = partners.length
    ? partners.map((partner) => `
      <tr>
        <td>${partner.name}</td>
        <td>${partner.best_avg.toFixed(2)}</td>
        <td>${partner.worst_avg.toFixed(2)}</td>
        <td>${partner.color_note}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" class="muted">No partners found.</td></tr>`;
  }
  if (elements.mateCount) {
    elements.mateCount.textContent = String(stats.remaining_valid);
  }
  renderHorseSelectFrom(elements.bestMateSelect, filteredBestMateHorses(), subject.name);
}

function syncSummary() {
  if (elements.horseCount) {
    elements.horseCount.textContent = String(state.horses.length);
  }
  if (elements.summaryText) {
    elements.summaryText.textContent = state.horses.length
      ? `Loaded ${state.horses.length} horses. Select a horse to inspect details or rank best mates.`
      : "No file loaded yet.";
  }
}

function renderAll() {
  syncSummary();
  renderHorseTable();
  renderDetails();
  renderBestMates();
}

function resetSession() {
  state.horses = [];
  state.selectedName = null;
  state.editingName = null;
  saveStoredHorses();
}

function downloadCsv() {
  const csv = exportCsvText();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "horses.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function setupHomeEventHandlers() {
  elements.importForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = elements.csvFile.files?.[0];
    if (!file) {
      showFlash("Please choose a CSV file to upload.", "error");
      return;
    }

    const text = await file.text();
    try {
      importFromCsvText(text);
      state.editingName = null;
      showFlash(`Imported ${state.horses.length} horses from CSV.`);
      renderHomePage();
    } catch (error) {
      showFlash(`Error importing CSV: ${error.message}`, "error");
    }
  });

  elements.downloadButton?.addEventListener("click", downloadCsv);
  elements.resetButton?.addEventListener("click", () => {
    if (!window.confirm("Reset the current session? This clears all loaded horses.")) {
      return;
    }
    resetSession();
    renderHomePage();
    showFlash("Session cleared.");
  });
  elements.horseTableBody?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='delete']");
    if (!button) return;
    const { name } = button.dataset;
    if (window.confirm(`Delete ${name}?`)) {
      deleteHorse(name);
      renderHomePage();
      showFlash(`Deleted ${name}.`);
    }
  });
}

function setupAddEventHandlers() {
  elements.cancelEditButton?.addEventListener("click", cancelEdit);
  elements.horseForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const horse = currentHorseFromForm();
      validateHorse(horse);

      if (state.editingName && state.editingName !== horse.name && horseByName(horse.name)) {
        throw new Error(`Horse '${horse.name}' already exists.`);
      }
      if (state.editingName) {
        replaceHorse(state.editingName, horse);
      } else {
        upsertHorse(horse);
      }
      state.selectedName = horse.name;
      cancelEdit();
      renderAddPage();
      showFlash(`Horse '${horse.name}' saved.`);
    } catch (error) {
      showFlash(`Error: ${error.message}`, "error");
    }
  });
}

function setupViewEventHandlers() {
  elements.horseSelect?.addEventListener("change", (event) => {
    state.selectedName = event.target.value || null;
    renderDetails();
  });
}

function setupBestMatesEventHandlers() {
  elements.bestMateSelect?.addEventListener("change", (event) => {
    state.selectedName = event.target.value || null;
    renderBestMates();
  });
  const applyBestMateFilter = () => {
    const visibleHorses = filteredBestMateHorses();
    if (!visibleHorses.some((horse) => horse.name === state.selectedName)) {
      state.selectedName = visibleHorses[0]?.name ?? null;
    }
    renderBestMates();
  };
  elements.bestMateRaceFilter?.addEventListener("change", applyBestMateFilter);
  elements.bestMateSexFilter?.addEventListener("change", applyBestMateFilter);
}

function renderHomePage() {
  syncSummary();
  renderHorseTable();
}

function renderAddPage() {
  renderDiseaseGrid();
  if (state.editingName) {
    setEditingHorse(state.editingName);
  } else {
    cancelEdit();
  }
}

function renderViewPage() {
  const selected = state.selectedName || state.horses[0]?.name || null;
  state.selectedName = selected;
  renderHorseSelect(elements.horseSelect, selected);
  renderDetails(selected);
}

function renderBestMatesPage() {
  const selected = state.selectedName || state.horses[0]?.name || null;
  state.selectedName = selected;
  renderBestMateFilters();
  const visibleHorses = filteredBestMateHorses();
  if (!visibleHorses.some((horse) => horse.name === state.selectedName)) {
    state.selectedName = visibleHorses[0]?.name ?? null;
  }
  renderHorseSelectFrom(elements.bestMateSelect, visibleHorses, state.selectedName);
  renderBestMates(state.selectedName);
}

function initializePage() {
  if (pageName === "home") {
    setupHomeEventHandlers();
    renderHomePage();
    if (state.horses.length === 0) {
      showFlash("Start by uploading a CSV file.");
    }
    return;
  }

  if (pageName === "add") {
    renderDiseaseGrid();
    setupAddEventHandlers();
    if (initialSelectedName) {
      state.editingName = initialSelectedName;
    }
    if (state.editingName) {
      setEditingHorse(state.editingName);
    } else {
      cancelEdit();
    }
    return;
  }

  if (pageName === "view") {
    setupViewEventHandlers();
    renderViewPage();
    return;
  }

  if (pageName === "bestmates") {
    setupBestMatesEventHandlers();
    renderBestMatesPage();
    return;
  }

  renderHomePage();
}

initializePage();