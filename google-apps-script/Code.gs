/**
 * Almacenamiento compartido para Eibar Femenino · Staff.
 * Este script debe estar vinculado a la hoja de cálculo de Google.
 */

// CAMBIA este valor antes de ejecutar inicializarEibar(). Mínimo 8 caracteres.
const EDITOR_PIN = "CAMBIA-ESTE-PIN";

const SHEET_NAMES = { TEAMS: "EQUIPOS", MATCHES: "PARTIDOS", CONFIG: "CONFIG" };
const TEAM_HEADERS = ["ID", "Equipo", "Código", "Puntos 2025/26", "Puntos 2024/25", "Ascendido", "Color"];
const MATCH_HEADERS = ["ID", "Jornada", "Local ID", "Visitante ID", "Goles local", "Goles visitante", "Nota técnica"];
const CONFIG_HEADERS = ["Clave", "Valor"];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Eibar Staff")
    .addItem("Inicializar o actualizar PIN", "inicializarEibar")
    .addToUi();
}

function inicializarEibar() {
  if (!EDITOR_PIN || EDITOR_PIN === "CAMBIA-ESTE-PIN" || EDITOR_PIN.length < 8) {
    throw new Error("Cambia EDITOR_PIN por un PIN de al menos 8 caracteres antes de ejecutar esta función.");
  }
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Abre este script desde Extensiones > Apps Script en la hoja de cálculo.");
  PropertiesService.getScriptProperties().setProperties({
    SPREADSHEET_ID: spreadsheet.getId(),
    PIN_HASH: hash_(EDITOR_PIN),
  });
  ensureSheets_(spreadsheet);
  SpreadsheetApp.getUi().alert(
    "Eibar Staff",
    "La hoja está preparada. El PIN se ha guardado de forma cifrada y los datos existentes no se han borrado.",
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || "load");
    const callback = validCallback_((e && e.parameter && e.parameter.callback) || "");
    if (action === "status") {
      const writeId = validWriteId_((e && e.parameter && e.parameter.writeId) || "");
      const cached = CacheService.getScriptCache().get("write:" + writeId);
      return javascript_(callback, cached ? JSON.parse(cached) : { pending: true, writeId: writeId });
    }
    if (action !== "load") throw new Error("Acción no permitida.");
    const spreadsheet = openSpreadsheet_();
    ensureSheets_(spreadsheet);
    return javascript_(callback, readSnapshot_(spreadsheet));
  } catch (error) {
    return javascript_(safeCallback_((e && e.parameter && e.parameter.callback) || ""), {
      error: publicError_(error),
    });
  }
}

function doPost(e) {
  let writeId = "";
  try {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 250000) {
      throw new Error("Petición vacía o demasiado grande.");
    }
    const request = JSON.parse(e.postData.contents);
    writeId = validWriteId_(request.writeId);
    if (request.action !== "save") throw new Error("Acción no permitida.");
    if (!pinMatches_(String(request.pin || ""))) throw new Error("PIN de edición incorrecto.");
    validateState_(request.state);
    if (!Number.isInteger(request.revision) || request.revision < 0) throw new Error("Revisión no válida.");

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const spreadsheet = openSpreadsheet_();
      ensureSheets_(spreadsheet);
      const current = readConfig_(spreadsheet);
      const currentRevision = Number(current.revision || 0);
      if (currentRevision !== request.revision) {
        throw new Error("Otra sesión ha actualizado los datos. Recarga antes de guardar.");
      }
      const updatedAt = new Date().toISOString();
      request.state.updatedAt = updatedAt;
      writeState_(spreadsheet, request.state, currentRevision + 1, updatedAt, writeId);
      cacheWrite_(writeId, { ok: true, writeId: writeId, revision: currentRevision + 1, updatedAt: updatedAt });
    } finally {
      lock.releaseLock();
    }
    return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    const message = publicError_(error);
    if (writeId) cacheWrite_(writeId, { ok: false, writeId: writeId, error: message });
    return ContentService.createTextOutput("error").setMimeType(ContentService.MimeType.TEXT);
  }
}

function openSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("La hoja no está inicializada. Ejecuta inicializarEibar().");
  return SpreadsheetApp.openById(id);
}

function ensureSheets_(spreadsheet) {
  ensureSheet_(spreadsheet, SHEET_NAMES.TEAMS, TEAM_HEADERS, "#14233e");
  ensureSheet_(spreadsheet, SHEET_NAMES.MATCHES, MATCH_HEADERS, "#941d48");
  ensureSheet_(spreadsheet, SHEET_NAMES.CONFIG, CONFIG_HEADERS, "#425879");
}

function ensureSheet_(spreadsheet, name, headers, color) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  const existing = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  if (existing.join("|") !== headers.join("|")) {
    if (sheet.getLastRow() > 0 && existing.some(String)) {
      throw new Error("La pestaña " + name + " existe pero sus columnas no son compatibles.");
    }
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  sheet.setTabColor(color);
  sheet.getRange(1, 1, 1, headers.length).setBackground(color).setFontColor("#ffffff").setFontWeight("bold");
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), headers.length).setVerticalAlignment("middle");
  if (name === SHEET_NAMES.MATCHES) {
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 75);
    sheet.setColumnWidths(3, 4, 105);
    sheet.setColumnWidth(7, 320);
  } else if (name === SHEET_NAMES.TEAMS) {
    sheet.setColumnWidth(2, 190);
    sheet.setColumnWidths(3, 5, 110);
  } else {
    sheet.setColumnWidth(1, 170);
    sheet.setColumnWidth(2, 220);
  }
  return sheet;
}

function readSnapshot_(spreadsheet) {
  const config = readConfig_(spreadsheet);
  const revision = Number(config.revision || 0);
  const teamsSheet = spreadsheet.getSheetByName(SHEET_NAMES.TEAMS);
  const matchesSheet = spreadsheet.getSheetByName(SHEET_NAMES.MATCHES);
  if (!revision || teamsSheet.getLastRow() < 2 || matchesSheet.getLastRow() < 2) {
    return { state: null, revision: 0, updatedAt: "", lastWriteId: "" };
  }
  const teamRows = teamsSheet.getRange(2, 1, teamsSheet.getLastRow() - 1, TEAM_HEADERS.length).getValues();
  const matchRows = matchesSheet.getRange(2, 1, matchesSheet.getLastRow() - 1, MATCH_HEADERS.length).getValues();
  const state = {
    version: 1,
    season: String(config.season || "2026/27"),
    teams: teamRows.map(function (row) {
      return {
        id: Number(row[0]), name: String(row[1]), short: String(row[2]),
        prev: blankNumber_(row[3]), older: blankNumber_(row[4]),
        promoted: row[5] === true || String(row[5]).toLowerCase() === "true", color: String(row[6]),
      };
    }),
    matches: matchRows.map(function (row) {
      return {
        id: String(row[0]), round: Number(row[1]), home: Number(row[2]), away: Number(row[3]),
        hg: blankNumber_(row[4]), ag: blankNumber_(row[5]), note: String(row[6] || ""),
      };
    }),
    settings: {
      target: Number(config.target), home: Number(config.home), draw: Number(config.draw),
      learning: Number(config.learning), uncertainty: Number(config.uncertainty), weight: Number(config.weight),
    },
    updatedAt: String(config.updatedAt || ""),
  };
  validateState_(state);
  return { state: state, revision: revision, updatedAt: state.updatedAt, lastWriteId: String(config.lastWriteId || "") };
}

function writeState_(spreadsheet, state, revision, updatedAt, writeId) {
  const teamsSheet = spreadsheet.getSheetByName(SHEET_NAMES.TEAMS);
  const matchesSheet = spreadsheet.getSheetByName(SHEET_NAMES.MATCHES);
  clearData_(teamsSheet, TEAM_HEADERS.length);
  clearData_(matchesSheet, MATCH_HEADERS.length);
  const teamRows = state.teams.map(function (team) {
    return [team.id, safeText_(team.name), safeText_(team.short), blankCell_(team.prev), blankCell_(team.older), team.promoted, team.color];
  });
  const matchRows = state.matches.map(function (match) {
    return [match.id, match.round, match.home, match.away, blankCell_(match.hg), blankCell_(match.ag), safeText_(match.note)];
  });
  teamsSheet.getRange(2, 2, teamRows.length, 2).setNumberFormat("@");
  matchesSheet.getRange(2, 1, matchRows.length, 1).setNumberFormat("@");
  matchesSheet.getRange(2, 7, matchRows.length, 1).setNumberFormat("@");
  teamsSheet.getRange(2, 1, teamRows.length, TEAM_HEADERS.length).setValues(teamRows);
  matchesSheet.getRange(2, 1, matchRows.length, MATCH_HEADERS.length).setValues(matchRows);
  writeConfig_(spreadsheet, {
    revision: revision, season: state.season, target: state.settings.target,
    home: state.settings.home, draw: state.settings.draw, learning: state.settings.learning,
    uncertainty: state.settings.uncertainty, weight: state.settings.weight,
    updatedAt: updatedAt, lastWriteId: writeId,
  });
  SpreadsheetApp.flush();
}

function clearData_(sheet, columns) {
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, columns).clearContent();
}

function readConfig_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(SHEET_NAMES.CONFIG);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  return rows.reduce(function (result, row) {
    if (row[0] !== "") result[String(row[0])] = row[1];
    return result;
  }, {});
}

function writeConfig_(spreadsheet, config) {
  const sheet = spreadsheet.getSheetByName(SHEET_NAMES.CONFIG);
  clearData_(sheet, 2);
  const order = ["revision", "season", "target", "home", "draw", "learning", "uncertainty", "weight", "updatedAt", "lastWriteId"];
  const rows = order.map(function (key) { return [key, typeof config[key] === "string" ? safeText_(config[key]) : config[key]]; });
  sheet.getRange(2, 1, rows.length, 2).setNumberFormat("@");
  sheet.getRange(2, 1, rows.length, 2).setValues(rows);
}

function validateState_(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.teams) || state.teams.length !== 16 ||
      !Array.isArray(state.matches) || state.matches.length !== 240 || typeof state.season !== "string" ||
      !/^\d{4}\/\d{2}$/.test(state.season)) {
    throw new Error("Los datos no corresponden a una temporada compatible.");
  }
  const ids = {};
  const pairs = {};
  const rounds = Array.from({ length: 30 }, function () { return {}; });
  state.teams.forEach(function (team, index) {
    if (!team || team.id !== index || typeof team.name !== "string" || !team.name.trim() || team.name.length > 60 ||
        typeof team.short !== "string" || team.short.length > 6 || !/^#[0-9a-fA-F]{6}$/.test(team.color) ||
        typeof team.promoted !== "boolean") throw new Error("Equipo o histórico no válido.");
    [team.prev, team.older].forEach(function (value) {
      if (value !== null && (!Number.isFinite(value) || value < 0 || value > 90)) throw new Error("Histórico no válido.");
    });
  });
  state.matches.forEach(function (match) {
    if (!match || typeof match.id !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(match.id) || !Number.isInteger(match.round) || match.round < 1 || match.round > 30 ||
        !Number.isInteger(match.home) || !Number.isInteger(match.away) || match.home < 0 || match.home > 15 ||
        match.away < 0 || match.away > 15 || match.home === match.away || typeof match.note !== "string" || match.note.length > 1000) {
      throw new Error("Partido no válido.");
    }
    if ((match.hg === null) !== (match.ag === null)) throw new Error("Introduce ambos marcadores o deja ambos vacíos.");
    [match.hg, match.ag].forEach(function (goal) {
      if (goal !== null && (!Number.isInteger(goal) || goal < 0 || goal > 50)) throw new Error("Marcador no válido.");
    });
    const pair = match.home + "-" + match.away;
    if (ids[match.id] || pairs[pair] || rounds[match.round - 1][match.home] || rounds[match.round - 1][match.away]) {
      throw new Error("Calendario duplicado o incompatible.");
    }
    ids[match.id] = true; pairs[pair] = true;
    rounds[match.round - 1][match.home] = true; rounds[match.round - 1][match.away] = true;
  });
  if (rounds.some(function (round) { return Object.keys(round).length !== 16; })) throw new Error("Jornada incompleta.");
  const settings = state.settings || {};
  const ranges = { target: [1, 90], home: [0, 1], draw: [0.1, 2], learning: [0, 0.5], uncertainty: [0, 1], weight: [0, 1] };
  Object.keys(ranges).forEach(function (key) {
    const value = settings[key], range = ranges[key];
    if (!Number.isFinite(value) || value < range[0] || value > range[1]) throw new Error("Parámetro del modelo no válido.");
  });
  if (!Number.isInteger(settings.target)) throw new Error("La meta debe ser entera.");
}

function pinMatches_(pin) {
  const expected = PropertiesService.getScriptProperties().getProperty("PIN_HASH");
  return Boolean(expected) && hash_(pin.trim()) === expected;
}

function hash_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes);
}

function cacheWrite_(writeId, result) {
  CacheService.getScriptCache().put("write:" + writeId, JSON.stringify(result), 300);
}

function javascript_(callback, value) {
  return ContentService.createTextOutput(callback + "(" + JSON.stringify(value) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function validCallback_(value) {
  const callback = String(value || "");
  if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(callback)) throw new Error("Callback no válido.");
  return callback;
}

function safeCallback_(value) {
  const callback = String(value || "");
  return /^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(callback) ? callback : "console.warn";
}

function validWriteId_(value) {
  const id = String(value || "");
  if (!/^[A-Za-z0-9-]{20,80}$/.test(id)) throw new Error("Identificador de guardado no válido.");
  return id;
}

function blankNumber_(value) { return value === "" || value === null ? null : Number(value); }
function blankCell_(value) { return value === null || value === undefined ? "" : value; }
function safeText_(value) {
  const text = String(value || "");
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}
function publicError_(error) {
  const message = error && error.message ? String(error.message) : "Error de Google Sheets.";
  return message.length > 180 ? "No se pudo procesar la petición." : message;
}
