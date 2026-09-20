const SPREADSHEET_ID = "1XRkOpePJ9lvdgEjHQmF_cqBsgLXAR5zaZOL7WSp9SU4";
const SYNC_KEY = "M0KTnXi7FLaIK6o28aOgYdwge5t2SWbh";

function doGet() {
  return jsonResponse({ ok: true, service: "SRT Google Sheets sync" });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    if (payload.syncKey !== SYNC_KEY) throw new Error("Invalid sync key");
    if (payload.action !== "syncSheet") throw new Error("Unsupported action");

    const sheetName = String(payload.sheetName || "").trim();
    if (!sheetName) throw new Error("Missing sheet name");

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet =
      spreadsheet.getSheetByName(sheetName) ||
      spreadsheet.insertSheet(sheetName);
    const headers = Array.isArray(payload.headers)
      ? payload.headers.map(String)
      : [];
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const values = [headers].concat(
      rows.map((row) => headers.map((header) => row[header] ?? "")),
    );

    sheet.clearContents();
    if (values.length && headers.length) {
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.autoResizeColumns(1, headers.length);
    }

    return jsonResponse({
      ok: true,
      spreadsheetId: SPREADSHEET_ID,
      sheetName,
      rowCount: rows.length,
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error.message || error) });
  }
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
