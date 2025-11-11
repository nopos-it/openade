# Esempio FE - Fatturazione Elettronica

Questo esempio completo dimostra tutte le funzionalità del pacchetto `@openade/fe` per creare e gestire fatture elettroniche (FatturaPA) per il Sistema di Interscambio (SDI) dell'Agenzia delle Entrate italiana.

## Funzionalità Dimostrate

- **Creazione Fatture**: Costruisci fatture XML FatturaPA (formato FPR12) per B2B e B2C
- **Firme Digitali**: Applica firme digitali alle fatture
- **Marcatura Temporale**: Aggiungi timestamp certificati alle fatture
- **Gestione Allegati**: Gestisci allegati con compressione/cifratura
- **Supporto Transfrontaliero**: Validazione IVA UE e gestione fatture internazionali
- **Trasmissione SDI**: Invia fatture via canali SDICOOP e SDIFTP
- **Gestione Archivi**: Archiviazione a lungo termine con politiche di conservazione
- **Tracciamento Audit**: Logging completo e tracciamento conformità
- **Elaborazione Batch**: Elaborazione ad alto volume di fatture
- **Astrazione Storage**: Backend storage flessibili (file system, database, cache)

## Installazione

```bash
npm install
```

## Esegui Esempio

```bash
npm start
```

## Cosa Mostra l'Esempio

L'esempio dimostra un workflow completo:

1. **Creazione Fattura**: Costruisci una fattura FatturaPA con più righe
2. **Firma Digitale**: Applica firma digitale (implementazione mock)
3. **Marcatura Temporale**: Aggiungi timestamp certificato (servizio TSA mock)
4. **Gestione Allegati**: Gestisci allegati con compressione
5. **Validazione Transfrontaliera**: Valida partite IVA UE e fatture internazionali
6. **Trasmissione SDI**: Invia fatture via web service SDICOOP
7. **Gestione Archivi**: Archivia fatture con politiche di conservazione
8. **Tracciamento Audit**: Registra tutte le operazioni per conformità
9. **Elaborazione Batch**: Elabora più fatture efficientemente

## Astrazione Storage

L'esempio utilizza implementazioni storage in-memory che possono essere facilmente sostituite con:

- **File Storage**: Filesystem locale, S3, Azure Blob, Google Cloud Storage
- **Database**: MySQL, PostgreSQL, MongoDB, ecc.
- **Cache**: Redis, Memcached, in-memory

## Architettura Servizi

Tutti i servizi di elaborazione sono integrati nel pacchetto FE:

- **Compressione**: Compressione basata su zlib di Node.js
- **Cifratura**: Cifratura basata su crypto di Node.js
- **Client HTTP**: Richieste HTTP basate su fetch di Node.js
- **Elaborazione XML**: fast-xml-parser per operazioni XML
- **Firme Digitali**: Firme basate su crypto di Node.js
- **Marcatura Temporale**: Integrazione TSA con codifica ASN.1
- **Validazione IVA UE**: Integrazione servizio VIES

## Tipi Fattura

- **TD01**: Fattura standard
- **TD04**: Nota di credito
- **TD05**: Nota di debito
- **TD01-TD28**: Vari tipi documento secondo regolamenti fiscali italiani

## Canali di Trasmissione

- **SDICOOP**: Web service (SOAP) - Consigliato per la maggior parte dei casi
- **SDIFTP**: Trasmissione SFTP - Per scenari ad alto volume

## Tipi Ricevuta

- **RC**: Ricevuta di Consegna
- **NS**: Notifica di Scarto
- **MC**: Notifica di Mancata Consegna
- **NE**: Notifica Esito
- **MT**: Metadati Fattura
- **DT**: Attestazione trasmissione con mancata consegna

## Note Produzione

- **Credenziali SDI**: Ottieni credenziali e certificati SDI appropriati per la produzione
- **Ambiente Test**: Testa sempre prima con l'ambiente test SDI
- **Limite Dimensione File**: La dimensione massima del file è 5MB
- **Tempo Elaborazione**: Le fatture sono tipicamente elaborate entro 5 giorni da SDI
- **Storage**: Sostituisci storage in-memory con soluzioni storage di produzione
- **Certificati**: Usa certificati digitali reali per firme di produzione
- **Servizio TSA**: Configura servizio TSA reale per marcatura temporale di produzione
