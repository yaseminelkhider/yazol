/**
 * Ya Zol — role game for Sudanese students at BAU
 *   Game:     <web app URL>
 *   Results:  <web app URL>?page=admin   (password protected)
 *
 * Security:
 * - The sheet is private to the owner. Students never get Sheet access;
 *   the web app writes on the owner's behalf.
 * - Only two functions are callable from the pages: submit() and getRows().
 *   Everything else ends in "_" (private) or refuses anonymous callers.
 * - The results password is stored only as a SHA-256 hash.
 * - Wrong-password attempts are rate limited (10 per 15 min, then locked).
 * - Every field is validated server-side (type, length, allowed values),
 *   and anything that could run as a spreadsheet formula is neutralised.
 * - Submissions are rate limited per student number and overall.
 * - If a student number plays again, the previous row is copied to the
 *   "History" tab before being replaced, so nothing can be silently erased.
 */

const ADMIN_KEY_SHA256 = 'ZlUhihqCNlw3Y4I/bj58QkWZqmx4hvVWam3uGdmVY88=';
const SHEET_NAME = 'Responses';
const HISTORY_NAME = 'History';
const HEADERS = [
  'Timestamp', 'Name', 'Surname', 'Gender', 'Student No', 'Major', 'Year',
  'Primary role', 'Second role',
  'Editing %', 'Shooting %', 'Organizing %', 'Finance %', 'Flags %',
  'Organizer skill (0-7)', 'Finance check', 'Skills', 'Would pick', 'Hours/week',
  'Language', 'Answers'
];
const ROLES = ['Media · Editing', 'Media · Shooting', 'Organizers', 'Finance & Sponsors', 'Flags'];
const YEARS = ['Prep', '1', '2', '3', '4', '5+', 'Masters/PhD'];

function doGet(e) {
  const admin = e && e.parameter && e.parameter.page === 'admin';
  return HtmlService.createHtmlOutputFromFile(admin ? 'admin' : 'index')
    .setTitle(admin ? 'Ya Zol · Results' : 'Ya Zol: Which One Are You?')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

/* ------------------------------------------------------------------ */
/* Public: called by the game                                          */
/* ------------------------------------------------------------------ */
function submit(data) {
  let row;
  try { row = validate_(data); } catch (err) { return { ok: false, error: 'invalid' }; }

  const cache = CacheService.getScriptCache();
  if (!bump_(cache, 'sn:' + row[4], 5, 3600)) return { ok: false, error: 'too_many' };   // 5 per student / hour
  if (!bump_(cache, 'all', 400, 600)) return { ok: false, error: 'busy' };              // 400 per 10 min overall

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'busy' };
  try {
    const sheet = getSheet_(SHEET_NAME);
    const snCol = HEADERS.indexOf('Student No') + 1;
    const last = sheet.getLastRow();
    let target = 0;
    if (last > 1) {
      const ids = sheet.getRange(2, snCol, last - 1, 1).getDisplayValues();
      for (let i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === row[4]) { target = i + 2; break; }
    }
    if (target) {
      const old = sheet.getRange(target, 1, 1, HEADERS.length).getValues();
      getSheet_(HISTORY_NAME).appendRow(old[0]);
      sheet.getRange(target, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'server' };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Public: called by the results page                                  */
/* ------------------------------------------------------------------ */
function getRows(key) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('adminfail') || 0);
  if (fails >= 10) return { ok: false, error: 'locked' };
  if (!checkKey_(key)) {
    cache.put('adminfail', String(fails + 1), 900);
    Utilities.sleep(800);
    return { ok: false, error: 'wrong' };
  }
  const values = getSheet_(SHEET_NAME).getDataRange().getDisplayValues();
  const head = values.shift() || HEADERS;
  const rows = values.filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    const o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o;
  });
  return { ok: true, rows: rows, sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl() };
}

/* ------------------------------------------------------------------ */
/* Owner only: run once from the editor                                */
/* ------------------------------------------------------------------ */
function setup() {
  if (!isOwner_()) throw new Error('Owner only');
  getSheet_(SHEET_NAME);
  getSheet_(HISTORY_NAME);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sum = ss.getSheetByName('Summary') || ss.insertSheet('Summary');
  sum.clear();
  sum.getRange('A1:E1').setValues([['Team', 'Men', 'Women', 'Total', 'Strong organizers (skill ≥ 5)']]).setFontWeight('bold');
  ROLES.forEach(function (r, i) {
    const n = i + 2;
    sum.getRange(n, 1).setValue(r);
    sum.getRange(n, 2).setFormula('=COUNTIFS(Responses!H:H,A' + n + ',Responses!D:D,"Male")');
    sum.getRange(n, 3).setFormula('=COUNTIFS(Responses!H:H,A' + n + ',Responses!D:D,"Female")');
    sum.getRange(n, 4).setFormula('=COUNTIF(Responses!H:H,A' + n + ')');
    sum.getRange(n, 5).setFormula('=COUNTIFS(Responses!H:H,A' + n + ',Responses!O:O,">=5")');
  });
  sum.getRange('A8').setValue('Total players');
  sum.getRange('D8').setFormula('=MAX(0,COUNTA(Responses!E:E)-1)');
  sum.setColumnWidth(1, 180); sum.setColumnWidth(5, 220);
}

/* ------------------------------------------------------------------ */
/* Private helpers (names ending in _ cannot be called from the pages) */
/* ------------------------------------------------------------------ */
function validate_(d) {
  if (!d || typeof d !== 'object') throw new Error('bad');
  const str = function (v, max, re) {
    const s = String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
    if (!s || s.length > max || (re && !re.test(s))) throw new Error('bad');
    return safe_(s);
  };
  const opt = function (v, max) { const s = String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max); return safe_(s); };
  const pct = function (v) { const n = Number(v); if (!isFinite(n) || n < 0 || n > 100) throw new Error('bad'); return Math.round(n); };
  const oneOf = function (v, list) { if (list.indexOf(v) < 0) throw new Error('bad'); return v; };

  const sn = String(d['Student No'] || '').replace(/\s/g, '');
  if (!/^\d{5,12}$/.test(sn)) throw new Error('bad');
  const skill = Number(d['Organizer skill (0-7)']);
  if (!(skill >= 0 && skill <= 7)) throw new Error('bad');

  return [
    new Date(),
    str(d['Name'], 60),
    str(d['Surname'], 60),
    oneOf(d['Gender'], ['Male', 'Female']),
    sn,
    str(d['Major'], 100),
    oneOf(String(d['Year']), YEARS),
    oneOf(d['Primary role'], ROLES),
    oneOf(d['Second role'], ROLES),
    pct(d['Editing %']), pct(d['Shooting %']), pct(d['Organizing %']), pct(d['Finance %']), pct(d['Flags %']),
    Math.round(skill),
    oneOf(d['Finance check'], ['Correct', 'Wrong']),
    opt(d['Skills'], 600),
    oneOf(d['Would pick'] || '', ROLES.concat(['Not sure', ''])),
    oneOf(d['Hours/week'] || '', ['1-2', '3-5', '6+', '']),
    oneOf(d['Language'], ['en', 'ar']),
    opt(d['Answers'], 3000)
  ];
}

function checkKey_(key) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(key || '').trim(), Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes) === ADMIN_KEY_SHA256;
}

function bump_(cache, k, max, ttl) {
  const n = Number(cache.get(k) || 0);
  if (n >= max) return false;
  cache.put(k, String(n + 1), ttl);
  return true;
}

function isOwner_() {
  const active = Session.getActiveUser().getEmail();
  return !!active && active === Session.getEffectiveUser().getEmail();
}

function getSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name, name === SHEET_NAME ? 0 : ss.getSheets().length);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0E0E0C').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.getRange('E:E').setNumberFormat('@');
  }
  return sheet;
}

// A cell that starts with = + - @ would run as a formula; prefix it so it stays text.
function safe_(s) { return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }
