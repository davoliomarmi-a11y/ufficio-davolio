# Trasferimento Ufficio Davolio su GitHub

Destinazione: https://github.com/davoliomarmi-a11y/ufficio-davolio
Sito originale: https://ufficio-davolio.boldox64.chatgpt.site
Data esportazione: 19 ottobre 2026
Commit sorgente: 38de461dd08f6fe48a7de4e04e52c65fa20fba3a

## Contenuto
Tutti i 125 file tracciati nel repository sorgente sono conservati senza modifiche, inclusi frontend, API server, immagini, configurazioni, lockfile, script e licenze. EXPORT-MANIFEST.json contiene gli hash SHA-256 dei file originali.
Non sono inclusi cronologia Git, node_modules, cache, output di build, credenziali di accesso o configurazioni runtime esterne. Questo è un archivio dei sorgenti, non un backup dei servizi e dei dati esterni.

## Importazione
Estrarre lo ZIP e aprire un terminale nella cartella ufficio-davolio. Se il repository GitHub è vuoto:

```sh
git init -b main
git add .
git commit -m "Importazione sorgenti Ufficio Davolio"
git remote add origin https://github.com/davoliomarmi-a11y/ufficio-davolio.git
git push -u origin main
```

Se il repository contiene già file, clonarlo prima e copiare al suo interno il contenuto estratto, incluse le cartelle e i file nascosti. Esaminare le differenze e creare un normale commit; non usare push forzati.
L'importazione non è stata eseguita da questa esportazione.

## Avvio locale
Prerequisiti dichiarati: Node.js >=22.13.0 e pnpm 11.25.0 (versione fissata in package.json).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Per compilare: `pnpm build`. Per provare il Worker compilato: `pnpm start`.
Il README originale contiene la documentazione del framework Vinext e dei servizi Sites. L'installazione e la build non sono state eseguite durante questa esportazione; è stata verificata l'integrità dell'archivio e la corrispondenza byte per byte dei sorgenti.

## Dipendenze dal servizio originale
- `.openai/hosting.json` conserva l'identità del sito esistente. Il trasferimento su GitHub non trasferisce hosting o permessi di accesso.
- Autenticazione e protezione privata dipendono da ChatGPT Sites. Prima di pubblicare su un altro hosting occorre implementare e verificare una protezione equivalente, anche per le API.
- `app/api/completed-orders/route.ts` consulta il gestionale laboratorio su un altro sito. L'accesso deve essere verificato dal nuovo ambiente; non sono esportate credenziali.
- Connettori, autorizzazioni Gmail/Calendar, eventuali segreti runtime e attività programmate non si trasferiscono con lo ZIP.
- `public/report-giornata.json` è uno snapshot salvato del 17 ottobre 2026, non una sincronizzazione in tempo reale.
- GitHub Pages da solo non esegue questo backend Worker/Vinext.
- Per conservare la riservatezza dei contenuti aziendali, utilizzare un repository privato.
