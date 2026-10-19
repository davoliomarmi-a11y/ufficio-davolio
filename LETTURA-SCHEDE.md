# Lettura locale delle schede aperte

Questa versione sostituisce la chiamata API degli ordini con la lettura delle liste già aperte in Google Chrome. I messaggi e gli ordini non passano dal server Ufficio e non vengono salvati in file, GitHub o localStorage. Restano in memoria nella scrivania fino alla ricarica della pagina.

## Primo utilizzo in Chrome

1. Scaricare `public/estensione-ufficio.zip` dal repository o il collegamento «Scaricate l’estensione Ufficio» nella scrivania aggiornata. Estrarlo in una cartella da conservare.
2. Aprire `chrome://extensions`, attivare **Modalità sviluppatore**, scegliere **Carica estensione non pacchettizzata** e selezionare la cartella con `manifest.json`.
3. Ricaricare la scrivania, Gmail e il laboratorio dopo l’installazione.
4. In Gmail usare `davoliomarmi@gmail.com`. Per leggere solo i messaggi aziendali, aprire la ricerca `to:info@davoliomarmi.com`. Verificare che il pulsante dell’account in alto a destra indichi l’indirizzo corretto.
5. Nel laboratorio mostrare la tabella degli ordini con le colonne Stato, Numero/Ordine e Cliente visibili.
6. Tornare a Ufficio e premere **Leggi le schede aperte** in uno dei due pannelli.

L’estensione funziona sulla scrivania `https://ufficio-davolio.boldox64.chatgpt.site/` e nelle anteprime locali `http://127.0.0.1:5173/` e `http://127.0.0.1:8787/`. La versione pubblicata del sito deve contenere questi nuovi file per offrire i pulsanti: un push su GitHub non aggiorna automaticamente ChatGPT Sites.

## Cosa viene letto

- Gmail: mittente, oggetto, anteprima e data delle righe già visibili, senza aprire conversazioni o cambiare lo stato letto. Il corpo completo non viene acquisito. L’account attivo deve essere riconosciuto come quello dell’ufficio.
- Laboratorio: righe visibili di una tabella riconosciuta, con stato Completato. Gli archiviati identificabili vengono esclusi. Gli altri filtri, le altre pagine e le righe fuori vista non sono inclusi.
- In presenza di più schede, viene preferita la scheda attiva o usata più di recente che presenti una vista riconosciuta.

L’ora mostrata è quella della lettura della pagina già caricata: non prova che Gmail o il laboratorio abbiano scaricato nuove informazioni. Per acquisire novità, aggiornare prima la pagina sorgente. Se una nuova lettura fallisce, i dati precedenti restano contrassegnati come non aggiornati. Ricaricando Ufficio, i dati letti vengono eliminati.

Il riepilogo del 17 ottobre 2026 rimane storico: la sua data non viene sostituita con quella di oggi senza verificare realmente posta e calendario. La lettura delle schede non modifica attività programmate, calendari o fatture e non ne realizza una sincronizzazione automatica.

## Verifiche di sviluppo

Da `/workspace/ufficio-davolio`:

```sh
node --experimental-vm-modules --test tests/open-tabs.test.mjs
pnpm lint
pnpm exec tsc --noEmit --incremental false --types node,@cloudflare/workers-types,vite/client
python scripts/package-extension.py
pnpm build
```

I test DOM dell’estensione sono documentati in `browser-extension/README.md`. Dopo aver installato JSDOM nella cartella temporanea indicata, l’intera verifica di parser, comunicazione e scrivania si esegue con:

```sh
DAVOLIO_TEST_DEPS=/tmp/davolio-extension-tests node --experimental-vm-modules --test tests/*.test.mjs browser-extension/tests/*.test.mjs
```

Le fixture sono dati di prova e non verificano le mail reali. L’ultima verifica richiede l’installazione dell’estensione nel browser dell’ufficio e le liste reali aperte: questa macchina cloud non vede le schede del PC dell’utente.
