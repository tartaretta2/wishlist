# Wishlist di regali

## 1. Prepara Google Sheets

1. Crea un foglio Google e rinomina il foglio attivo in `Wishlist`.
2. Inserisci nella prima riga, esattamente, queste intestazioni:

   `ID | Nome | Prezzo | LinkProdotti | Foto | Note | Prenotato | PrenotatoDa`

3. Inserisci una riga per ogni regalo. In `Prezzo` puoi usare un numero (`45`) oppure un intervallo (`100 - 140`). In `LinkProdotti` puoi usare `Etichetta|URL, Etichetta|URL` oppure solo `URL, URL`. In `Foto` inserisci gli URL delle immagini separati da virgola. `Note` è facoltativa. Lascia `Prenotato` su `FALSE` e `PrenotatoDa` vuoto per i nuovi regali.

## 2. Pubblica l'API Apps Script

1. Dal foglio apri **Estensioni > Apps Script**.
2. Incolla il contenuto di `Code.gs` nell'editor e salva.
3. Scegli **Distribuisci > Nuova distribuzione**.
4. Tipo: **App web**.
5. Esegui come: **Me**.
6. Chi ha accesso: **Chiunque**.
7. Autorizza l'app quando Google lo richiede e copia l'URL che termina con `/exec`.

Il codice usa `LockService` per evitare che due persone prenotino contemporaneamente lo stesso regalo. Il `POST` del frontend usa `text/plain` apposta: evita il preflight CORS del browser, mentre Apps Script restituisce JSON tramite `ContentService`.

## 3. Collega GitHub Pages

1. Apri `script.js`.
2. Sostituisci `INCOLLA_QUI_URL_WEB_APP_APPS_SCRIPT` con l'URL `/exec` copiato al passo precedente.
3. Pubblica i quattro file `index.html`, `style.css`, `script.js` e `README.md` in un repository GitHub.
4. In **Settings > Pages**, scegli il branch e la cartella da pubblicare.

Il browser crea automaticamente un `sessionId` casuale e lo conserva in `localStorage`. Non vengono richiesti account o dati personali. Per una nuova sessione su quello stesso browser è sufficiente cancellare i dati del sito.

## Formato di esempio

| ID | Nome | Prezzo | LinkProdotti | Foto | Note | Prenotato | PrenotatoDa |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| regalo-001 | Cuffie | 45.00 | Amazon\|https://example.com | https://example.com/cuffie.jpg | Colore nero | FALSE | |

Per modificare la lista dopo la pubblicazione, aggiorna il foglio: la pagina ricarica i dati dal server ogni volta che viene aperta.