# Prossimo passo: confronto in sola lettura

Obiettivo concordato: offrire a Sabrina e Angela una scrivania semplice. Posta e lavori sono visibili qui; i briefing programmati in ChatGPT servono per approfondire le priorità e la stessa chat offre assistenza vocale quando disponibile.

La prossima integrazione riguarda Fatture in Cloud, laboratorio e mail. Deve rispettare la richiesta di leggere le pagine aperte, senza API esterne, senza inviare mail e senza modificare fatture, ordini o calendari.

Prima di implementarla:

1. Verificare nel Chrome dell’ufficio che la lettura delle liste reali Gmail e laboratorio sia riconosciuta correttamente.
2. Esaminare la vista fatture realmente usata in Fatture in Cloud. Concordare quali colonne possono essere lette dalla schermata e aggiungere il suo dominio all’estensione soltanto per questa funzione.
3. Presentare possibili corrispondenze usando numero ordine/riferimento gestionale, cliente, data e numero fattura effettivamente visibili. Un nome simile da solo non prova una corrispondenza.
4. Mostrare «Da verificare» per risultati incerti o non visibili. Non dedurre «non fatturato», «non pagato» o assenza di comunicazioni da una lista filtrata, una pagina successiva non letta o un’anteprima mail.
5. Conservare i collegamenti alle viste sorgenti e l’ora della lettura. Rendere esplicito quando gli elenchi confrontati sono parziali.

Questa integrazione non è ancora implementata e non deve essere presentata come attiva.
