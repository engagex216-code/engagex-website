/**
 * EngageX Admin — Backend (Google Apps Script)
 * ================================================
 * Deploy this as a Web App (Deploy > New deployment > Web app,
 * execute as "Me", access "Anyone with the link"), then paste the
 * resulting /exec URL into GAS_WEB_APP_URL in the dashboard HTML.
 *
 * MATCHES THE "Tracker august" SPREADSHEET AS OF AUG 2026:
 *
 * 1) "Assignments" tab (titled "REVIEWS TRACKER" on-sheet)
 *    Header row 3, data starts row 5. Columns B→H:
 *      B Profile Name | C Order | D Status | E Currently increased |
 *      F Start date | G End Date | H Admin id
 *
 * 2) "Profiles" tab
 *    Header row 4, data starts row 6. Columns B→H:
 *      B Column 1 (=name) | C order | D Total charge. | E Daily Qty |
 *      F Admin cost | G Remaining | H ADMIN EARNINGS
 *    Only name (B) and Daily Qty (E) are used by the dashboard.
 *
 * 3) "Copy of Profiles" tab (titled "Client Data" on-sheet)
 *    Header row 3, data starts row 5, ends before the "Total" row.
 *    Columns B, D→H:
 *      B name | C (unused) | D order | E Phone Number |
 *      F Amount Paid | G Remaining | H Admin payment
 *
 * There's no dedicated admin-roster tab, so admin display names are
 * kept in ADMIN_NAMES below — edit these to match your real admins.
 * Admin IDs themselves still come from the "Admin id" column in
 * Assignments.
 *
 * If your sheet layout shifts (rows/columns move), update the ROW/COL
 * constants below — the rest of the script doesn't need to change.
 */

// ---------- Config ----------

const SHEET_TRACKER = "Assignments";     // REVIEWS TRACKER data
const SHEET_PROFILES = "Profiles";
const SHEET_CLIENTS = "Copy of Profiles"; // Client Data

const TRACKER_HEADER_ROW = 3;
const TRACKER_DATA_START = 5;

const PROFILES_HEADER_ROW = 4;
const PROFILES_DATA_START = 6;

const CLIENTS_HEADER_ROW = 3;
const CLIENTS_DATA_START = 5;

// Edit these to your real admin names — id must match the "Admin id"
// column values used in the Assignments tab.
const ADMIN_NAMES = {
  "1": "Admin 1",
  "2": "Admin 2",
  "3": "Admin 3"
};

// ---------- Entry points ----------

function doGet(e) {
  const action = e.parameter.action;
  if (action === "getDashboardData") {
    return jsonOut(getDashboardData_());
  }
  return jsonOut({ success: false, error: "Unknown action: " + action });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === "addClientProfile") {
      return jsonOut(addClientProfile_(body.payload));
    }
    return jsonOut({ success: false, error: "Unknown action: " + body.action });
  } catch (err) {
    return jsonOut({ success: false, error: err.message });
  }
}

// ---------- Read: getDashboardData ----------

function getDashboardData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Assignments (bookings)
  const trackerRows = readColumns_(ss.getSheetByName(SHEET_TRACKER), TRACKER_DATA_START, 2, 8); // B..H
  const bookings = trackerRows.map(function (r) {
    return {
      profileName: r[0],                          // B
      order: Number(r[1]) || 0,                    // C
      status: r[2] || "Not started",                // D
      currentlyIncreased: Number(r[3]) || 0,        // E
      startDate: formatDate_(r[4]),                 // F
      endDate: formatDate_(r[5]),                   // G
      adminId: r[6] ? String(r[6]) : ""             // H
    };
  });

  // Profiles (only name + dailyQty feed the dashboard)
  const profileRows = readColumns_(ss.getSheetByName(SHEET_PROFILES), PROFILES_DATA_START, 2, 8); // B..H
  const profiles = profileRows.map(function (r) {
    return {
      name: r[0],                          // B
      dailyQty: Number(r[3]) || 5           // E
    };
  });

  // Copy of Profiles (client billing) — B name, D order, E phone, F paid, G remaining, H admin payment
  const clientRows = readColumns_(ss.getSheetByName(SHEET_CLIENTS), CLIENTS_DATA_START, 2, 8); // B..H
  const clients = clientRows.map(function (r) {
    return {
      name: r[0],                          // B
      order: Number(r[2]) || 0,             // D
      phone: r[3] || "",                    // E
      amountPaid: Number(r[4]) || 0,        // F
      remaining: Number(r[5]) || 0,         // G
      adminPayment: Number(r[6]) || 0       // H
    };
  });

  // Admins: derive the roster from distinct Admin ids used in bookings
  const idsSeen = {};
  bookings.forEach(function (b) { if (b.adminId) idsSeen[b.adminId] = true; });
  const admins = Object.keys(idsSeen).sort().map(function (id) {
    const profileNames = bookings
      .filter(function (b) { return b.adminId === id; })
      .map(function (b) { return b.profileName; });
    const seen = {};
    const uniqueNames = profileNames.filter(function (n) {
      if (seen[n]) return false;
      seen[n] = true;
      return true;
    });
    return { id: id, name: ADMIN_NAMES[id] || ("Admin " + id), profileNames: uniqueNames };
  });

  return { profiles: profiles, bookings: bookings, admins: admins, clients: clients };
}

// ---------- Write: addClientProfile ----------

function addClientProfile_(payload) {
  if (!payload || !payload.profileName) {
    return { success: false, error: "profileName is required" };
  }
  const name = payload.profileName;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1) Assignments: B name, C order, D status, E currentlyIncreased(0),
  //    F startDate, G endDate(blank), H adminId
  writeRowAfterLastData_(
    ss.getSheetByName(SHEET_TRACKER), TRACKER_DATA_START, 2,
    [name, payload.order || 0, payload.status || "Not started", 0,
     payload.startDate || "", "", payload.adminId || ""]
  );

  // 2) Profiles: B name, C order, D totalCharge(blank), E dailyQty,
  //    F adminCost(blank), G remaining(blank), H adminEarnings(blank)
  writeRowAfterLastData_(
    ss.getSheetByName(SHEET_PROFILES), PROFILES_DATA_START, 2,
    [name, payload.order || 0, "", payload.dailyQty || 5, "", "", ""]
  );

  // 3) Copy of Profiles: B name, C (unused), D order, E phone,
  //    F amountPaid, G remaining, H adminPayment
  writeRowAfterLastData_(
    ss.getSheetByName(SHEET_CLIENTS), CLIENTS_DATA_START, 2,
    [name, "", payload.order || 0, payload.phone || "",
     payload.amountPaid || 0, payload.remaining || 0, payload.adminPayment || 0]
  );

  return { success: true, name: name };
}

// ---------- Sheet helpers ----------

// Reads `numCols` columns starting at `startCol` (1-indexed, e.g. 2 = B),
// from `dataStartRow` down to the last used row. Stops collecting a row
// once its first cell is blank or literally "Total" (footer row).
function readColumns_(sheet, dataStartRow, startCol, numCols) {
  if (!sheet) throw new Error("Sheet not found");
  const lastRow = sheet.getLastRow();
  if (lastRow < dataStartRow) return [];
  const values = sheet.getRange(dataStartRow, startCol, lastRow - dataStartRow + 1, numCols).getValues();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const first = row[0];
    if (first === "" || first === null) continue; // skip blank spacer rows
    if (String(first).trim().toLowerCase() === "total") break; // stop at footer
    out.push(row);
  }
  return out;
}

// Finds the last populated data row (by first column) at/after
// `dataStartRow`, ignoring a "Total" footer row, then inserts a new row
// right after it and writes `values` starting at `startCol`.
function writeRowAfterLastData_(sheet, dataStartRow, startCol, values) {
  if (!sheet) throw new Error("Sheet not found");
  const lastRow = sheet.getLastRow();
  let lastDataRow = dataStartRow - 1;
  if (lastRow >= dataStartRow) {
    const firstColVals = sheet.getRange(dataStartRow, startCol, lastRow - dataStartRow + 1, 1).getValues();
    for (let i = 0; i < firstColVals.length; i++) {
      const v = firstColVals[i][0];
      if (v === "" || v === null) continue;
      if (String(v).trim().toLowerCase() === "total") break;
      lastDataRow = dataStartRow + i;
    }
  }
  sheet.insertRowAfter(lastDataRow);
  sheet.getRange(lastDataRow + 1, startCol, 1, values.length).setValues([values]);
}

function formatDate_(val) {
  if (!val) return "";
  const d = (val instanceof Date) ? val : new Date(val);
  if (isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
