# FE Example - Fatturazione Elettronica (Electronic Invoicing)

This comprehensive example demonstrates all features of the `@openade/fe` package for creating and managing electronic invoices (FatturaPA) for the Italian tax authority's Sistema di Interscambio (SDI).

## Features Demonstrated

- **Invoice Creation**: Build FatturaPA XML invoices (FPR12 format) for B2B and B2C
- **Digital Signatures**: Apply digital signatures to invoices
- **Timestamping**: Add trusted timestamps to invoices
- **Attachment Management**: Handle file attachments with compression/encryption
- **Cross-Border Support**: EU VAT validation and international invoice handling
- **SDI Transmission**: Send invoices via SDICOOP and SDIFTP channels
- **Archive Management**: Long-term storage with retention policies
- **Audit Trails**: Comprehensive logging and compliance tracking
- **Batch Processing**: High-volume invoice processing
- **Storage Abstraction**: Flexible storage backends (file system, database, cache)

## Installation

```bash
npm install
```

## Run Example

```bash
npm start
```

## What the Example Shows

The example demonstrates a complete workflow:

1. **Invoice Creation**: Build a FatturaPA invoice with multiple line items
2. **Digital Signature**: Apply digital signature (mock implementation)
3. **Timestamping**: Add trusted timestamp (mock TSA service)
4. **Attachment Management**: Handle file attachments with compression
5. **Cross-Border Validation**: Validate EU VAT numbers and international invoices
6. **SDI Transmission**: Send invoices via SDICOOP web service
7. **Archive Management**: Store invoices with retention policies
8. **Audit Trails**: Log all operations for compliance
9. **Batch Processing**: Process multiple invoices efficiently

## Storage Abstraction

The example uses in-memory storage implementations that can be easily replaced with:

- **File Storage**: Local filesystem, S3, Azure Blob, Google Cloud Storage
- **Database**: MySQL, PostgreSQL, MongoDB, etc.
- **Cache**: Redis, Memcached, in-memory

## Service Architecture

All processing services are built into the FE package:

- **Compression**: Node.js zlib-based compression
- **Encryption**: Node.js crypto-based encryption
- **HTTP Client**: Node.js fetch-based HTTP requests
- **XML Processing**: fast-xml-parser for XML operations
- **Digital Signatures**: Node.js crypto-based signatures
- **Timestamping**: TSA integration with ASN.1 encoding
- **EU VAT Validation**: VIES service integration

## Invoice Types

- **TD01**: Standard invoice
- **TD04**: Credit note
- **TD05**: Debit note
- **TD01-TD28**: Various document types per Italian tax regulations

## Transmission Channels

- **SDICOOP**: Web service (SOAP) - Recommended for most cases
- **SDIFTP**: SFTP transmission - For high-volume scenarios

## Receipt Types

- **RC**: Delivery receipt (Ricevuta di Consegna)
- **NS**: Rejection notice (Notifica di Scarto)
- **MC**: Undelivered notice (Notifica di Mancata Consegna)
- **NE**: Outcome notice (Notifica Esito)
- **MT**: Invoice metadata (Metadati Fattura)
- **DT**: Transmission attestation with delivery failure

## Production Notes

- **SDI Credentials**: Obtain proper SDI credentials and certificates for production
- **Test Environment**: Always test with SDI test environment first
- **File Size Limit**: Maximum file size is 5MB
- **Processing Time**: Invoices are typically processed within 5 days by SDI
- **Storage**: Replace in-memory storage with production storage solutions
- **Certificates**: Use real digital certificates for production signatures
- **TSA Service**: Configure real TSA service for production timestamping
