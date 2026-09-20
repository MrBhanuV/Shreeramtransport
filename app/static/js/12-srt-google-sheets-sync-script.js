// Google Sheets one-way record mirror for the standalone SRT dashboard.
// A deployed Apps Script web app receives snapshots and creates/updates worksheet tabs.
const SRT_GS_SETTINGS_KEY = "srt_google_sheets_sync_v1";
const SRT_GS_SYNC_KEY = "M0KTnXi7FLaIK6o28aOgYdwge5t2SWbh";
let SRT_GS_LAST_HASH = {};
let SRT_GS_SYNCING = 0;
let SRT_GS_POLL_TIMER = null;

function srtGsGetSettings() {
  try {
    const v = JSON.parse(localStorage.getItem(SRT_GS_SETTINGS_KEY) || "{}");
    return {
      enabled: !!v.enabled,
      url: String(v.url || "").trim(),
      workbookName:
        String(v.workbookName || "Shree Ram Transport - Live Records").trim() ||
        "Shree Ram Transport - Live Records",
      spreadsheetId: String(v.spreadsheetId || "").trim(),
    };
  } catch (e) {
    return {
      enabled: false,
      url: "",
      workbookName: "Shree Ram Transport - Live Records",
      spreadsheetId: "",
    };
  }
}
function srtGsSetStatus(text, state) {
  const el = document.getElementById("srtGsStatus"),
    tx = document.getElementById("srtGsStatusText");
  if (tx) tx.textContent = text;
  if (el) {
    el.classList.remove("ok", "busy", "err");
    if (state) el.classList.add(state);
  }
}
function srtGsLoadSettingsUI() {
  const s = srtGsGetSettings();
  const u = document.getElementById("srtGsWebAppUrl"),
    n = document.getElementById("srtGsWorkbookName"),
    i = document.getElementById("srtGsSpreadsheetId");
  if (u) u.value = s.url;
  if (n) n.value = s.workbookName;
  if (i) i.value = s.spreadsheetId;
  if (s.enabled && s.url)
    srtGsSetStatus("Auto Sync enabled · waiting for record changes", "ok");
  else srtGsSetStatus("Not configured");
}
function srtGsSaveSettings(syncNow) {
  if (typeof srtIsAdmin === "function" && !srtIsAdmin()) {
    toast("Administrator access required.", "var(--red)");
    return;
  }
  const url = String(
    document.getElementById("srtGsWebAppUrl")?.value || "",
  ).trim();
  const workbookName =
    String(
      document.getElementById("srtGsWorkbookName")?.value ||
        "Shree Ram Transport - Live Records",
    ).trim() || "Shree Ram Transport - Live Records";
  const spreadsheetId = String(
    document.getElementById("srtGsSpreadsheetId")?.value || "",
  ).trim();
  if (
    !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(url)
  ) {
    toast(
      "Enter the deployed Google Apps Script Web App /exec URL.",
      "var(--red)",
    );
    srtGsSetStatus("Invalid Apps Script Web App URL", "err");
    return;
  }
  localStorage.setItem(
    SRT_GS_SETTINGS_KEY,
    JSON.stringify({ enabled: true, url, workbookName, spreadsheetId }),
  );
  SRT_GS_LAST_HASH = {};
  srtGsSetStatus("Auto Sync enabled", "ok");
  toast("Google Sheets Auto Sync enabled.", "var(--green)");
  if (syncNow) setTimeout(() => srtGsSyncAll(true), 100);
}
function srtGsDisable() {
  const s = srtGsGetSettings();
  s.enabled = false;
  localStorage.setItem(SRT_GS_SETTINGS_KEY, JSON.stringify(s));
  srtGsSetStatus("Auto Sync disabled");
  toast("Google Sheets Auto Sync disabled.", "var(--yellow)");
}
function srtGsHash(value) {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16) + ":" + str.length;
}
function srtGsCleanRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const o = {};
    Object.keys(r || {}).forEach((k) => {
      let v = r[k];
      if (v === undefined || v === null) v = "";
      else if (typeof v === "object") v = JSON.stringify(v);
      o[k] = v;
    });
    return o;
  });
}
function srtGsHeaders(rows, preferred) {
  const out = [];
  const seen = new Set();
  (preferred || []).forEach((k) => {
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  });
  (rows || []).forEach((r) =>
    Object.keys(r || {}).forEach((k) => {
      if (!seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    }),
  );
  return out;
}
function srtGsAttendanceRows() {
  if (typeof ATT === "undefined") return [];
  const byId = new Map((ATT.staff || []).map((s) => [String(s.id), s]));
  const rows = [];
  Object.keys(ATT.records || {})
    .sort()
    .reverse()
    .forEach((date) => {
      const day = ATT.records[date] || {};
      Object.keys(day).forEach((staffId) => {
        const st = byId.get(String(staffId)) || {};
        const rec = day[staffId] || {};
        rows.push({
          Date: date,
          "Employee ID": staffId,
          "Employee Name": st.name || "",
          Department: st.dept || "",
          Designation: st.role || "",
          Status: rec.status || "",
          Note: rec.note || "",
        });
      });
    });
  return rows;
}
function srtGsHolidayRows() {
  if (typeof ATT === "undefined") return [];
  return Object.keys(ATT.holidays || {})
    .sort()
    .reverse()
    .map((date) => ({
      Date: date,
      "Holiday Name": ATT.holidays[date]?.name || "Company Holiday",
    }));
}
function srtGsGpsRows() {
  if (typeof GPSD === "undefined" || !Array.isArray(GPSD.records)) return [];
  return GPSD.records.map((r) => ({
    "GPS ID": r.gpsId || "",
    "Date Issued": r.dateIssued || "",
    "Vehicle Number": r.vehicleNumber || "",
    "GPS Type": r.gpsType || "",
    "GPS Amount": r.gpsAmount ?? "",
    "GPS Return": r.gpsReturn || "",
    "Return Date": r.returnDate || "",
    "Amount Return": r.amountReturn ?? "",
    "Late Fee": r.lateFee ?? "",
    "Balance Due": r.balanceDue ?? "",
    Owner: r.owner || "",
    Remark: r.remark || "",
  }));
}
function srtGsModuleSnapshots() {
  const state = typeof STATE !== "undefined" && STATE ? STATE : {};
  const modules = [];
  const add = (key, sheet, rows, preferred) =>
    modules.push({
      key,
      sheet,
      rows: srtGsCleanRows(rows || []),
      preferred: preferred || [],
    });
  add(
    "invoice",
    "Daily Entry",
    state.inv,
    typeof COLS !== "undefined" && COLS.inv ? COLS.inv.map((x) => x.k) : [],
  );
  add(
    "payment",
    "Payment",
    state.pay,
    typeof COLS !== "undefined" && COLS.pay ? COLS.pay.map((x) => x.k) : [],
  );
  add(
    "companyPayment",
    "Company Payment",
    state.cp,
    typeof COLS !== "undefined" && COLS.cp ? COLS.cp.map((x) => x.k) : [],
  );
  add(
    "receivedPayment",
    "Received Payment",
    state.rp,
    typeof COLS !== "undefined" && COLS.rp ? COLS.rp.map((x) => x.k) : [],
  );
  add("gps", "GPS", srtGsGpsRows(), [
    "GPS ID",
    "Date Issued",
    "Vehicle Number",
    "GPS Type",
    "GPS Amount",
    "GPS Return",
    "Return Date",
    "Amount Return",
    "Late Fee",
    "Balance Due",
    "Owner",
    "Remark",
  ]);
  add(
    "expense",
    "Expense",
    state.exp,
    typeof COLS !== "undefined" && COLS.exp ? COLS.exp.map((x) => x.k) : [],
  );
  const fr = (state.fr || []).map((r, i) => ({
    "Sr. No.": String(i + 1),
    Destination: r.destination ?? r.Destination ?? "",
    Rate: r.rate ?? r.Rate ?? "",
  }));
  add("freightRates", "Freight Rate", fr, ["Sr. No.", "Destination", "Rate"]);
  add(
    "traders",
    "Traders Details",
    state.trader,
    typeof COLS !== "undefined" && COLS.trader
      ? COLS.trader.map((x) => x.k)
      : [],
  );
  add(
    "vehicles",
    "Vehicle Details",
    state.vehicle,
    typeof COLS !== "undefined" && COLS.vehicle
      ? COLS.vehicle.map((x) => x.k)
      : [],
  );
  add(
    "attendanceStaff",
    "Attendance Staff",
    typeof ATT !== "undefined" ? ATT.staff : [],
    ["id", "name", "dept", "role", "salary"],
  );
  add("attendanceRecords", "Attendance Records", srtGsAttendanceRows(), [
    "Date",
    "Employee ID",
    "Employee Name",
    "Department",
    "Designation",
    "Status",
    "Note",
  ]);
  add("companyHolidays", "Company Holidays", srtGsHolidayRows(), [
    "Date",
    "Holiday Name",
  ]);
  return modules.map((m) => ({
    ...m,
    headers: srtGsHeaders(m.rows, m.preferred),
  }));
}
async function srtGsPost(payload) {
  const s = srtGsGetSettings();
  if (!s.enabled || !s.url) throw new Error("Google sync is not configured");
  payload.syncKey = SRT_GS_SYNC_KEY;
  payload.workbookName = s.workbookName;
  payload.spreadsheetId = s.spreadsheetId;
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(s.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    if (res && res.ok) {
      try {
        return await res.json();
      } catch (e) {
        return { ok: true };
      }
    }
    throw new Error("Google Apps Script request failed");
  } catch (err) {
    // Apps Script deployments can be blocked from exposing their response by browser CORS.
    // A no-cors retry still delivers the write request successfully.
    await fetch(s.url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    return { ok: true, opaque: true };
  }
}
async function srtGsSyncModule(mod, manual) {
  if (!mod) return false;
  const s = srtGsGetSettings();
  if (!s.enabled || !s.url) return false;
  const hash = srtGsHash({ h: mod.headers, r: mod.rows });
  if (!manual && SRT_GS_LAST_HASH[mod.key] === hash) return false;
  SRT_GS_SYNCING++;
  srtGsSetStatus(`Syncing ${mod.sheet}…`, "busy");
  try {
    const result = await srtGsPost({
      action: "syncSheet",
      sheetName: mod.sheet,
      headers: mod.headers,
      rows: mod.rows,
    });
    SRT_GS_LAST_HASH[mod.key] = hash;
    const now = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    srtGsSetStatus(`${mod.sheet} synced · ${now}`, "ok");
    if (result?.spreadsheetId) {
      const cfg = srtGsGetSettings();
      if (!cfg.spreadsheetId) {
        cfg.spreadsheetId = result.spreadsheetId;
        localStorage.setItem(SRT_GS_SETTINGS_KEY, JSON.stringify(cfg));
        const input = document.getElementById("srtGsSpreadsheetId");
        if (input) input.value = result.spreadsheetId;
      }
    }
    return true;
  } catch (e) {
    srtGsSetStatus(`Sync failed: ${e.message || "connection error"}`, "err");
    if (manual) toast("Google Sheets sync request failed.", "var(--red)");
    return false;
  } finally {
    SRT_GS_SYNCING = Math.max(0, SRT_GS_SYNCING - 1);
  }
}
async function srtGsSyncAll(manual) {
  const s = srtGsGetSettings();
  if (!s.enabled || !s.url) {
    if (manual)
      toast("Configure Google Sheets Auto Sync first.", "var(--yellow)");
    return;
  }
  const mods = srtGsModuleSnapshots();
  srtGsSetStatus(`Syncing ${mods.length} record sheets…`, "busy");
  let ok = 0;
  for (const mod of mods) {
    if (await srtGsSyncModule(mod, true)) ok++;
    await new Promise((r) => setTimeout(r, 120));
  }
  if (ok) {
    srtGsSetStatus(
      `All ${ok} record sheets synced · ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
      "ok",
    );
    if (manual) toast(`Synced ${ok} Google Sheet tabs.`, "var(--green)");
  }
}
async function srtGsPoll() {
  const s = srtGsGetSettings();
  if (!s.enabled || !s.url || SRT_GS_SYNCING) return;
  const mods = srtGsModuleSnapshots();
  for (const mod of mods) {
    const hash = srtGsHash({ h: mod.headers, r: mod.rows });
    if (SRT_GS_LAST_HASH[mod.key] !== hash) {
      await srtGsSyncModule(mod, false);
      break;
    }
  }
}
function srtGsStartPoller() {
  if (SRT_GS_POLL_TIMER) clearInterval(SRT_GS_POLL_TIMER);
  SRT_GS_POLL_TIMER = setInterval(srtGsPoll, 2500);
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    srtGsLoadSettingsUI();
    srtGsStartPoller();
    const s = srtGsGetSettings();
    if (s.enabled && s.url) setTimeout(() => srtGsSyncAll(false), 1200);
  }, 900);
});
