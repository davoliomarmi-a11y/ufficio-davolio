# Leggere le schede aperte con Google Chrome

Questa estensione collega Ufficio Davolio alle pagine già aperte di Gmail e del laboratorio. Legge soltanto il testo delle righe visibili sullo schermo, su richiesta del pulsante di aggiornamento di Ufficio Davolio. Non chiama API, non esegue richieste di rete, non salva dati e non invia dati a un server. Non apre né attiva schede, non scorre gli elenchi, non apre messaggi, non invia mail e non modifica lo stato letto/non letto.

## Installazione manuale

1. Scaricare il repository completo da GitHub e decomprimerlo, conservando la cartella `browser-extension` sul computer.
2. In Chrome aprire `chrome://extensions`, attivare **Modalità sviluppatore**, scegliere **Carica estensione non pacchettizzata** e selezionare la cartella `browser-extension` (quella contenente `manifest.json`). Non selezionare lo ZIP o la cartella superiore.
3. Aprire o ricaricare tutte e tre le schede: [Ufficio Davolio](https://ufficio-davolio.boldox64.chatgpt.site/), [Gmail](https://mail.google.com/) e [laboratorio](https://laboratorio-davolio.roberto81.chatgpt.site/).
4. In Gmail selezionare **davoliomarmi@gmail.com** e mostrare l’elenco desiderato (posta in arrivo o una ricerca già eseguita). Il pulsante account in alto a destra deve indicare quell’indirizzo nel proprio nome accessibile: l’estensione rifiuta account diversi o non verificabili. Non è sufficiente che l’URL contenga `/u/0/`.
5. Nel laboratorio mostrare la tabella degli ordini con colonne **Stato**, **Numero/Ordine** e **Cliente**. Sono riconosciuti solo gli stati esatti **Completato**, **Completata** e **Completati**. “Non completato” e “Archiviato” non sono ordini completati.
6. In Ufficio Davolio premere il pulsante per leggere le schede. Controllare un messaggio visibile e un ordine completato confrontandoli con le schede originali. Questa verifica richiede il browser reale: un test su una pagina di esempio non prova che il DOM del servizio attuale sia riconosciuto.

È supportato anche l’Ufficio locale alle sole origini `http://127.0.0.1:5173/` e `http://127.0.0.1:8787/`. Il formato dei permessi Chrome per `127.0.0.1` non consente di limitare le porte; il bridge e il worker verificano comunque origine, porta e percorso esatti prima di accettare richieste. Le richieste da iframe e da altri siti vengono ignorate.

## Limiti della lettura

- L’estensione restituisce al massimo 100 messaggi e 500 ordini dalle righe attualmente visibili. Non sincronizza l’intera casella né tutti gli ordini. Il numero di righe lette non è il totale della casella o del laboratorio.
- Legge la vista Gmail attualmente aperta; non filtra automaticamente destinatari o alias come `info@davoliomarmi.com`. La dashboard riporta account, titolo e indirizzo della vista letta. Aprire manualmente una ricerca se si desidera leggere un sottoinsieme.
- Se il servizio cambia struttura, una conversazione è aperta al posto dell’elenco, le righe sono fuori dall’area visibile o l’account non si può verificare, la lettura segnala il limite. Una pagina non riconosciuta non viene presentata come una lista vuota verificata.
- Il laboratorio deve mostrare una tabella riconoscibile. Non vengono dedotti ordini da schede, statistiche o testi generici. Le date senza un orario ISO con fuso esplicito rimangono come testo, senza inventare un istante di completamento.
- Un collegamento diretto al messaggio viene usato soltanto se presente nel DOM. Altrimenti viene fornito il collegamento alla lista Gmail realmente aperta, indicato come tale. Gli identificativi interni delle righe non vengono trasformati in link.
- Quando ci sono più schede dello stesso servizio, viene preferita quella attiva/più recente con un elenco riconosciuto; per Gmail l’account deve essere quello atteso. Per evitare ambiguità, conservare una sola vista del servizio durante l’aggiornamento. La lettura esamina al massimo 12 schede per servizio.
- Dopo installazione, aggiornamento o ricaricamento dell’estensione, ricaricare anche le tre pagine per reinserire i content script.

Non servono token, password salvate o permessi per cookie. Le autorizzazioni riguardano Gmail, il laboratorio e le pagine Ufficio elencate nel manifest. Non sono richiesti `<all_urls>`, accesso alla cronologia o permessi per cambiare pagine. I dati letti passano in memoria alla sola pagina Ufficio autorizzata; non vengono scritti nello storage dell’estensione. Usare la dashboard solo in un browser e un profilo sotto il proprio controllo.

`dom-reader.js` espone `globalThis.DavolioDomReader` con `readMail(document, url)`, `readOrders(document, url)` e `visible(element)` per test locali con fixture DOM. Non richiede dipendenze o compilazione.

I test delle fixture DOM e dei confini del worker richiedono Node e JSDOM installato separatamente. Dalla radice del repository:

```sh
npm install --prefix /tmp/davolio-extension-tests --cache /tmp/davolio-npm-cache --no-package-lock --no-audit --no-fund jsdom@30.1.3
DAVOLIO_TEST_DEPS=/tmp/davolio-extension-tests node --test browser-extension/tests/reader.test.mjs
```

JSDOM non calcola la disposizione grafica: i test simulano le dimensioni delle righe per verificare esclusione di elementi nascosti e fuori dall’area visibile. Restano necessarie le verifiche manuali su Gmail e laboratorio reali, descritte sopra.
