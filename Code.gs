const SHEET_NAME = 'Wishlist';
const HEADERS = ['ID', 'Nome', 'Prezzo', 'LinkProdotti', 'Foto', 'Note', 'Prenotato', 'PrenotatoDa'];

function doGet() {
  try {
    const sheet = getWishlistSheet_();
    const values = sheet.getDataRange().getValues();
    const gifts = values.length < 2 ? [] : values.slice(1)
      .filter(row => String(row[0]).trim() !== '')
      .map(rowToGift_);
    return jsonResponse_({ success: true, gifts: gifts });
  } catch (error) {
    return jsonResponse_({ success: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '').toLowerCase();
    const giftId = String(body.regaloId || '').trim();
    const sessionId = String(body.sessionId || '').trim();
    if (!['prenota', 'sprenota'].includes(action) || !giftId || !sessionId) {
      return jsonResponse_({ success: false, error: 'Richiesta non valida.' });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = getWishlistSheet_();
      const columns = getColumnIndexes_(sheet);
      const rowCount = Math.max(sheet.getLastRow() - 1, 1);
      const ids = sheet.getRange(2, columns.id, rowCount, 1).getValues();
      const rowIndex = ids.findIndex(row => String(row[0]).trim() === giftId);
      if (rowIndex === -1) return jsonResponse_({ success: false, error: 'Regalo non trovato.' });

      const rowNumber = rowIndex + 2;
      const reserved = isTrue_(sheet.getRange(rowNumber, columns.reserved).getValue());
      const reservedBy = String(sheet.getRange(rowNumber, columns.reservedBy).getValue()).trim();
      if (action === 'prenota') {
        if (reserved) return jsonResponse_({ success: false, error: 'Questo regalo è già stato scelto da un’altra persona.', code: 'ALREADY_RESERVED' });
        sheet.getRange(rowNumber, columns.reserved, 1, 2).setValues([[true, sessionId]]);
      } else {
        if (!reserved || reservedBy !== sessionId) return jsonResponse_({ success: false, error: 'Puoi rimuovere solo i regali scelti da questo browser.', code: 'NOT_OWNER' });
        sheet.getRange(rowNumber, columns.reserved, 1, 2).setValues([[false, '']]);
      }
      return jsonResponse_({ success: true, action: action, regaloId: giftId });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonResponse_({ success: false, error: error.message });
  }
}

function getWishlistSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Foglio "' + SHEET_NAME + '" non trovato.');
  return sheet;
}

function getColumnIndexes_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const indexes = {};
  HEADERS.forEach(header => {
    const position = headers.findIndex(value => String(value).trim() === header);
    if (position === -1) throw new Error('Intestazione mancante: ' + header);
    indexes[headerToKey_(header)] = position + 1;
  });
  return indexes;
}

function headerToKey_(header) {
  return { ID: 'id', Nome: 'name', Prezzo: 'price', LinkProdotti: 'links', Foto: 'photos', Note: 'note', Prenotato: 'reserved', PrenotatoDa: 'reservedBy' }[header];
}

function rowToGift_(row) {
  const columns = getColumnIndexes_(getWishlistSheet_());
  return {
    id: String(row[columns.id - 1]).trim(),
    name: String(row[columns.name - 1] || '').trim(),
    price: Number(row[columns.price - 1]) || 0,
    links: parseLinks_(row[columns.links - 1]),
    photos: String(row[columns.photos - 1] || '').split(',').map(value => value.trim()).filter(Boolean),
    note: String(row[columns.note - 1] || '').trim(),
    reserved: isTrue_(row[columns.reserved - 1]),
    reservedBy: String(row[columns.reservedBy - 1] || '').trim()
  };
}

function parseLinks_(value) {
  return String(value || '').split(',').map(item => {
    const separator = item.indexOf('|');
    if (separator === -1) return null;
    return { label: item.slice(0, separator).trim(), url: item.slice(separator + 1).trim() };
  }).filter(link => link && link.label && link.url);
}

function isTrue_(value) {
  return value === true || String(value).toUpperCase().trim() === 'TRUE';
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
