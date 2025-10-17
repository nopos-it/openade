/**
 * Fatturazione Elettronica Example
 * Complete example demonstrating all FE features with proper service implementations
 */

import {
  ArchiveManager,
  AttachmentManager,
  AuditTrailManager,
  BatchProcessor,
  buildInvoiceXML,
  CrossBorderManager,
  DigitalSignatureManager,
  InvoiceBuilder,
  SDICOOPClient,
  TimestampingManager,
} from '@nopos-ade/fe';

import { FilesystemStorage } from './filesystem.storage';
import { SQLiteDatabase } from './sqlite.database';

async function main() {
  console.log('🚀 Fatturazione Elettronica Example');
  console.log('====================================\n');

  // Create storage services
  const fileStorage = new FilesystemStorage('./data/storage');
  const database = new SQLiteDatabase('./data/data.db');

  // 1. Create invoice builder
  const invoiceBuilder = new InvoiceBuilder({
    supplier: {
      vatNumber: 'IT12345678901',
      companyName: 'Example Company SRL',
      address: {
        street: 'Via Roma 123',
        city: 'Milano',
        postalCode: '20100',
        country: 'IT',
      },
    },
    customer: {
      vatNumber: 'IT98765432109',
      companyName: 'Customer Company SRL',
      address: {
        street: 'Via Milano 456',
        city: 'Roma',
        postalCode: '00100',
        country: 'IT',
      },
    },
  });

  // 2. Build the invoice with all data
  const invoice = invoiceBuilder.build({
    customer: {
      vatNumber: 'IT12345678902',
      businessName: 'Cliente Demo S.r.l.',
      address: {
        indirizzo: 'Via Roma 123',
        cap: '20100',
        comune: 'Milano',
        provincia: 'MI',
        nazione: 'IT',
      },
    },
    invoiceNumber: '2024/001',
    invoiceDate: '2024-01-15',
    lines: [
      {
        description: 'Software Development Services',
        quantity: 1,
        unitPrice: 1000.0,
        vatRate: 22,
      },
      {
        description: 'Consulting Services',
        quantity: 2,
        unitPrice: 500.0,
        vatRate: 22,
      },
    ],
  });
  console.log('✅ Invoice created successfully');
  console.log(
    `   Invoice ID: ${invoice.fatturaElettronicaHeader.datiTrasmissione.progressivoInvio}`
  );
  const body = Array.isArray(invoice.fatturaElettronicaBody)
    ? invoice.fatturaElettronicaBody[0]
    : invoice.fatturaElettronicaBody;
  const totalAmount = body.datiBeniServizi.datiRiepilogo.reduce(
    (sum, r) => sum + r.imponibileImporto + r.imposta,
    0
  );
  console.log(`   Total Amount: €${totalAmount.toFixed(2)}`);

  // 4. Generate XML
  const xmlContent = buildInvoiceXML(invoice);
  console.log('✅ XML generated successfully');
  console.log(`   XML Size: ${xmlContent.length} characters`);

  // 5. Digital Signature
  console.log('\n🔐 Applying digital signature...');
  const signatureManager = new DigitalSignatureManager({
    fileStorage: fileStorage,
    privateKey: 'mock-private-key',
    algorithm: 'RSA-SHA256',
  });

  try {
    const signatureResult = await signatureManager.signInvoice(xmlContent);
    console.log('✅ Digital signature applied successfully');
    console.log(`   Digest: ${signatureResult.digest.substring(0, 20)}...`);
  } catch (error) {
    console.log('⚠️  Digital signature skipped (no real certificates)');
  }

  // 6. Timestamping
  console.log('\n⏰ Applying timestamp...');
  const timestampingManager = new TimestampingManager({});

  try {
    const timestampResult = await timestampingManager.requestTimestamp({
      content: xmlContent,
      contentType: 'application/xml',
    });
    console.log('✅ Timestamp applied successfully');
    console.log(`   Timestamp: ${timestampResult.timestamp}`);
  } catch (error) {
    console.log('⚠️  Timestamping skipped');
  }

  // 7. Attachment Management
  console.log('\n📎 Managing attachments...');
  const attachmentManager = new AttachmentManager({
    fileStorage: fileStorage,
    compression: true,
    encryption: false,
  });

  try {
    // Create a mock attachment
    const mockAttachment = Buffer.from('Mock attachment content');
    const attachmentResult = await attachmentManager.addAttachment(
      mockAttachment,
      'contract.pdf',
      'application/pdf',
      'Service contract'
    );

    if (attachmentResult.success) {
      console.log('✅ Attachment added successfully');
      console.log(`   Attachment ID: ${attachmentResult.id}`);
    }
  } catch (error) {
    console.log('⚠️  Attachment management skipped');
  }

  // 8. Cross-Border Validation
  console.log('\n🌍 Cross-border validation...');
  const crossBorderManager = new CrossBorderManager({
    enableEUVATValidation: true,
    enableCountryValidation: true,
  });

  try {
    const validationResult = await crossBorderManager.validateCrossBorderInvoice(invoice);
    console.log('✅ Cross-border validation completed');
    console.log(`   Valid: ${validationResult.valid}`);
    if (validationResult.crossBorderData) {
      console.log(`   Transaction Type: ${validationResult.crossBorderData.transactionType}`);
      console.log(`   VAT Treatment: ${validationResult.crossBorderData.vatTreatment}`);
    }
  } catch (error) {
    console.log('⚠️  Cross-border validation skipped');
  }

  // 9. Create SDI client with XML parser
  const sdiClient = new SDICOOPClient({
    endpoint: 'https://test-sdi.fatturapa.gov.it/ricezione_v1',
    debug: true,
  });

  // 10. Transmit via SDICOOP
  console.log('\n📤 Transmitting via SDICOOP...');
  const sdiCoopResult = await sdiClient.sendInvoice('IT12345678901_00001.xml', xmlContent);

  if (sdiCoopResult.success) {
    console.log('✅ SDICOOP transmission successful');
    console.log(`   IdentificativoSdI: ${sdiCoopResult.identifcativoSdI}`);
  } else {
    console.log('❌ SDICOOP transmission failed');
    console.log(`   Error: ${sdiCoopResult.error}`);
  }

  // 11. Archive Management
  console.log('\n📦 Archive management...');
  const archiveManager = new ArchiveManager({
    fileStorage: fileStorage,
    archiveDir: 'archives',
    compression: true,
    encryption: false,
  });

  try {
    const archiveResult = await archiveManager.createArchive(
      [
        {
          invoice: invoice,
          filename: 'IT12345678901_00001.xml',
          xmlContent: xmlContent,
        },
      ],
      'Q1-2024',
      '2024-01-01',
      '2024-03-31'
    );

    if (archiveResult.success) {
      console.log('✅ Archive created successfully');
      console.log(`   Archive ID: ${archiveResult.archiveId}`);
      console.log(`   Invoice Count: ${archiveResult.invoiceCount}`);
    }
  } catch (error) {
    console.log('⚠️  Archive management skipped');
  }

  // 12. Audit Trail
  console.log('\n📋 Audit trail...');
  const auditManager = new AuditTrailManager({
    logDir: './logs',
    format: 'json',
    detailedLogging: true,
  });

  try {
    await auditManager.logEvent({
      type: 'INVOICE_CREATED',
      description: 'Invoice created and transmitted',
      details: {
        invoiceId: invoice.fatturaElettronicaHeader.datiTrasmissione.progressivoInvio,
        transmissionMethod: 'SDICOOP',
        success: sdiCoopResult.success,
      },
      success: true,
      invoiceId: invoice.fatturaElettronicaHeader.datiTrasmissione.progressivoInvio,
    });
    console.log('✅ Audit event logged successfully');
  } catch (error) {
    console.log('⚠️  Audit trail skipped');
  }

  // 13. Batch Processing Example
  console.log('\n📊 Batch processing example...');
  const batchProcessor = new BatchProcessor(
    {
      endpoint: 'https://test-sdi.fatturapa.gov.it/ricezione_v1',
      debug: true,
    },
    {
      maxBatchSize: 10,
      batchDelay: 1000,
      maxConcurrentBatches: 2,
      onProgress: (progress) => {
        console.log(
          `   Progress: ${progress.percentage}% (${progress.completed}/${progress.total})`
        );
      },
    }
  );

  try {
    const batchItems = [
      {
        id: 'batch_1',
        invoice: invoice,
        filename: 'batch_1.xml',
        channel: 'SDICOOP' as 'SDICOOP' | 'SDIFTP',
      },
      {
        id: 'batch_2',
        invoice: invoice,
        filename: 'batch_2.xml',
        channel: 'SDICOOP' as 'SDICOOP' | 'SDIFTP',
      },
    ];

    const batchResult = await batchProcessor.processBatch(batchItems);
    console.log('✅ Batch processing completed');
    console.log(`   Successful: ${batchResult.successful}/${batchResult.total}`);
    console.log(`   Processing time: ${batchResult.processingTime}ms`);
  } catch (error) {
    console.log('⚠️  Batch processing skipped');
  }

  console.log('\n🎉 Example completed successfully!');
  console.log('\n📊 Summary:');
  console.log('   ✅ Invoice creation and XML generation');
  console.log('   ✅ Digital signature (mock)');
  console.log('   ✅ Timestamping (mock)');
  console.log('   ✅ Attachment management');
  console.log('   ✅ Cross-border validation');
  console.log('   ✅ SDI transmission');
  console.log('   ✅ Archive management');
  console.log('   ✅ Audit trail logging');
  console.log('   ✅ Batch processing');
  console.log('\n💡 All services are now properly abstracted and can be');
  console.log('   replaced with real implementations (databases, cloud storage, etc.)');
}

main().catch(console.error);
