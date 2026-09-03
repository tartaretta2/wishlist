const SHEET_NAME = 'Wishlist';
const HEADERS = ['ID', 'Nome', 'Categoria', 'Note', 'Prezzo', 'LinkProdotti', 'Foto', 'Prenotato', 'PrenotatoDa'];

function doGet() {
  try {
    const sheet = getWishlistSheet_();
    const values = sheet.getDataRange().getValues();
    
    // Rimuove l'intestazione e righe vuote
    const gifts = values.length < 2 ? [] : values.slice(1)
      .filter(row => String(row[0]).trim() !== '')
      .map(row => rowToGift_(row, sheet));
      
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
    const position = headers.findIndex(value => String(value).trim().toLowerCase() === header.toLowerCase());
    if (position === -1) throw new Error('Intestazione mancante: ' + header);
    indexes[headerToKey_(header)] = position + 1;
  });
  return indexes;
}

function headerToKey_(header) {
  return {
    ID: 'id',
    Nome: 'name',
    Categoria: 'category',
    Note: 'note',
    Prezzo: 'price',
    LinkProdotti: 'links',
    Foto: 'photos',
    Prenotato: 'reserved',
    PrenotatoDa: 'reservedBy'
  }[header];
}

function rowToGift_(row, sheet) {
  const columns = getColumnIndexes_(sheet);
  return {
    id: String(row[columns.id - 1]).trim(),
    name: String(row[columns.name - 1] || '').trim(),
    categories: parseCategories_(row[columns.category - 1]),
    note: String(row[columns.note - 1] || '').trim(),
    price: parsePriceRange_(row[columns.price - 1]),
    links: parseLinks_(row[columns.links - 1]),
    photos: String(row[columns.photos - 1] || '').split(',').map(v => v.trim()).filter(Boolean),
    reserved: isTrue_(row[columns.reserved - 1]),
    reservedBy: String(row[columns.reservedBy - 1] || '').trim()
  };
}

function parseCategories_(value) {
  return String(value || '')
    .split(',')
    .map(cat => cat.trim())
    .filter(Boolean);
}

function parsePriceRange_(value) {
  const rawText = String(value || '').trim();
  const normalizedText = rawText.replace(/,/g, '.'); // Gestisce decimali con la virgola (es. 62,5)
  const numbers = normalizedText.match(/\d+(?:\.\d+)?/g);
  
  if (!numbers || numbers.length === 0) {
    return { min: 0, max: 0, label: rawText };
  }

  const parsed = numbers.map(Number).filter(n => !isNaN(n));
  const min = parsed[0] || 0;
  const max = parsed.length > 1 ? parsed[1] : min;
  
  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
    label: rawText
  };
}

function parseLinks_(value) {
  return String(value || '')
    .split(/[,\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const separatorIndex = item.indexOf('|');
      let label = '';
      let url = '';

      if (separatorIndex !== -1) {
        label = item.slice(0, separatorIndex).trim();
        url = item.slice(separatorIndex + 1).trim();
      } else {
        url = item;
        label = getLinkLabel_(url);
      }

      if (!/^https?:\/\/\S+$/i.test(url)) return null;
      return { label: label || getLinkLabel_(url), url: url };
    })
    .filter(Boolean);
}

function getLinkLabel_(url) {
  const match = url.match(/^https?:\/\/([^/]+)/i);
  if (!match) return 'Apri prodotto';
  
  // Estrae il nome del dominio principale pulendo prefissi come www.
  const host = match[1].replace(/^www\./i, '');
  const parts = host.split('.');
  
  if (parts.length >= 2) {
    const domainName = parts[parts.length - 2];
    return domainName.charAt(0).toUpperCase() + domainName.slice(1);
  }
  
  return host;
}

function isTrue_(value) {
  return value === true || String(value).toUpperCase().trim() === 'TRUE';
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}