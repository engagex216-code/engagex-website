/**
 * EngageX Admin — Backend (Google Apps Script)
 * ================================================
 * Deploy this as a Web App (Deploy > New deployment > Web app,
 * execute as "Me", access "Anyone with the link"), then paste the
 * resulting /exec URL into GAS_WEB_APP_URL in the dashboard HTML.
 *
 * EXPECTED SHEET LAYOUT (tab names must match exactly):
 *
 * 1) "Profiles"   — one row per Google Business Profile
 *    Columns (header row required, any order):
 *      Name | Daily Qty
 *
 * 2) "REVIEWS TRACKER"  — one row per booking/order against a profile
 *    Columns:
 *      Profile Name | Order | Status | Currently Increased |
 *      Start Date | End Date | Admin ID
 *    Status values used by the dashboard: "Done", "In progress", "Not started"
 *
 * 3) "Copy of Profiles"  — billing/client info, one row per client
 *    Columns:
 *      Name | Order | Phone | Amount Paid | Remaining | Admin Payment
 *
 * 4) "Admins"  — one row per admin
 *    Columns:
 *      ID | Name
 *
 * Adjust the COLUMN NAME CONSTANTS below if your actual headers differ —
 * you don't need to rename your sheet columns, just point the constants
 * at what you already have.
 */

// ---------- Sheet + column name config (edit to match your sheet) ----------
const SHEET_PROFILES = "Profiles";
const SHEET_BOOKINGS = "REVIEWS TRACKER";
const SHEET_CLIENTS = "Copy of Profiles";
const SHEET_ADMINS = "Admins";

const COL = {
  profiles: { name: "Name", dailyQty: "Daily Qty" },
  bookings: {
    profileName: "Profile Name",
    order: "Order",
    status: "Status",
    currentlyIncreased: "Currently Increased",
    startDate: "Start Date",
    endDate: "End Date",
    adminId: "Admin ID"
  },
  clients: {
    name: "Name",
    order: "Order",
    phone: "Phone",
    amountPaid: "Amount Paid",
    remaining: "Remaining",
    adminPayment: "Admin Payment"
  },
  admins: { id: "ID", name: "Name" }
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
  const profiles = readSheetAsObjects_(SHEET_PROFILES).map(function (r) {
    return {
      name: r[COL.profiles.name],
      dailyQty: Number(r[COL.profiles.dailyQty]) || 5
    };
  });

  const bookingRows = readSheetAsObjects_(SHEET_BOOKINGS);
  const bookings = bookingRows.map(function (r) {
    return {
      profileName: r[COL.bookings.profileName],
      order: Number(r[COL.bookings.order]) || 0,
      status: r[COL.bookings.status] || "Not started",
      currentlyIncreased: Number(r[COL.bookings.currentlyIncreased]) || 0,
      startDate: formatDate_(r[COL.bookings.startDate]),
      endDate: formatDate_(r[COL.bookings.endDate]),
      adminId: r[COL.bookings.adminId] ? String(r[COL.bookings.adminId]) : ""
    };
  });

  const clientRows = readSheetAsObjects_(SHEET_CLIENTS);
  const clients = clientRows.map(function (r) {
    return {
      name: r[COL.clients.name],
      order: Number(r[COL.clients.order]) || 0,
      phone: r[COL.clients.phone] || "",
      amountPaid: Number(r[COL.clients.amountPaid]) || 0,
      remaining: Number(r[COL.clients.remaining]) || 0,
      adminPayment: Number(r[COL.clients.adminPayment]) || 0
    };
  });

  const adminRows = readSheetAsObjects_(SHEET_ADMINS);
  const admins = adminRows.map(function (r) {
    const id = String(r[COL.admins.id]);
    const profileNames = bookings
      .filter(function (b) { return b.adminId === id; })
      .map(function (b) { return b.profileName; });
    // de-dupe while preserving order
    const seen = {};
    const uniqueNames = profileNames.filter(function (n) {
      if (seen[n]) return false;
      seen[n] = true;
      return true;
    });
    return { id: id, name: r[COL.admins.name], profileNames: uniqueNames };
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

  // 1) Profiles: name, dailyQty
  appendRowByHeader_(ss.getSheetByName(SHEET_PROFILES), {
    [COL.profiles.name]: name,
    [COL.profiles.dailyQty]: payload.dailyQty || 5
  });

  // 2) REVIEWS TRACKER: booking row
  appendRowByHeader_(ss.getSheetByName(SHEET_BOOKINGS), {
    [COL.bookings.profileName]: name,
    [COL.bookings.order]: payload.order || 0,
    [COL.bookings.status]: payload.status || "Not started",
    [COL.bookings.currentlyIncreased]: 0,
    [COL.bookings.startDate]: payload.startDate || "",
    [COL.bookings.endDate]: "",
    [COL.bookings.adminId]: payload.adminId || ""
  });

  // 3) Copy of Profiles: client billing row
  appendRowByHeader_(ss.getSheetByName(SHEET_CLIENTS), {
    [COL.clients.name]: name,
    [COL.clients.order]: payload.order || 0,
    [COL.clients.phone]: payload.phone || "",
    [COL.clients.amountPaid]: payload.amountPaid || 0,
    [COL.clients.remaining]: payload.remaining || 0,
    [COL.clients.adminPayment]: payload.adminPayment || 0
  });

  return { success: true, name: name };
}

// ---------- Sheet helpers ----------

// Reads a sheet into an array of { header: value } objects, keyed by the
// header row (row 1). Blank rows are skipped.
function readSheetAsObjects_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" not found');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const rows = values.slice(1);
  return rows
    .filter(function (row) { return row.some(function (c) { return c !== "" && c !== null; }); })
    .map(function (row) {
      const obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
}

// Appends a row to `sheet`, matching each key in `rowObj` to its column by
// header name (row 1). Columns not present in rowObj are left blank.
function appendRowByHeader_(sheet, rowObj) {
  if (!sheet) throw new Error("Target sheet not found");
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(function (h) {
    return Object.prototype.hasOwnProperty.call(rowObj, h) ? rowObj[h] : "";
  });
  sheet.appendRow(row);
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
