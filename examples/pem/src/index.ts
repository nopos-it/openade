/**
 * PEM Example Project
 * Demonstrates a complete Point of Sale using @nopos-ade/pem
 *
 * ARCHITECTURE:
 * PEM (Device) → sends documents in real-time → PEL (Server) → transmits to → ADE
 */

import { EmissionPointType } from '@nopos-ade/common';
import { PEMManager } from '@nopos-ade/pem';
import { MemoryStorage } from './memory.storage';

async function main() {
  console.log('🚀 PEM Example - Mobile Point of Sale\n');
  console.log('⚠️  Make sure PEL server is running first:');
  console.log('   cd examples/pel && npm start\n');

  // Initialize storage (in-memory for demo)
  const storage = new MemoryStorage();

  // Initialize PEM with PEL connection
  const pem = new PEMManager(
    {
      deviceType: EmissionPointType.SOFTWARE_SOLUTION,
      serialNumber: 'PEM-DEMO-001',
      vatNumber: 'IT12345678901',
      businessName: 'Demo Store S.r.l.',
      pelUrl: 'http://localhost:4000', // ✨ PEL server URL for real-time sync
    },
    storage
  );

  console.log('📡 PEM configured to sync with PEL at http://localhost:4000\n');

  // Open cash session (requests seed from PEL)
  await pem.openSession();

  console.log('\n📝 Emitting receipts...\n');

  // Emit receipts (each is sent to PEL in real-time)
  await pem.emitReceipt([
    { description: 'Coffee', quantity: 2, unitPrice: 2.5, vatRate: 10 },
    { description: 'Croissant', quantity: 1, unitPrice: 0.5, vatRate: 10 },
  ]);

  await pem.emitReceipt([
    { description: 'Sandwich', quantity: 1, unitPrice: 5.0, vatRate: 10 },
    { description: 'Water', quantity: 2, unitPrice: 1.0, vatRate: 10 },
    { description: 'Chips', quantity: 2, unitPrice: 3.0, vatRate: 10 },
  ]);

  await pem.emitReceipt([
    { description: 'Pizza', quantity: 1, unitPrice: 8.0, vatRate: 10 },
    { description: 'Cola', quantity: 2, unitPrice: 2.5, vatRate: 10 },
    { description: 'Ice Cream', quantity: 1, unitPrice: 4.0, vatRate: 10 },
  ]);

  // Close session (sends journal to PEL)
  const summary = await pem.closeSession();

  console.log('\n✅ Session Summary:');
  console.log(`   Total Documents: ${summary.totalDocuments}`);
  console.log(`   Total Amount: €${summary.totalAmount.toFixed(2)}`);
  console.log(`   Journal Synced to PEL: ${summary.journalSynced ? '✓' : '✗'}`);
  if (summary.unsyncedDocuments > 0) {
    console.log(`   ⚠️  Unsynced Documents: ${summary.unsyncedDocuments}`);
  }

  // Verify journal integrity
  const journal = pem.exportJournal();
  const isValid = pem.verifyJournal();

  console.log(`   Journal Integrity: ${isValid ? '✓ Valid' : '✗ Invalid'}`);

  console.log('\n📋 Journal Entries:');
  if (journal && journal.righe && Array.isArray(journal.righe)) {
    journal.righe.forEach((entry: unknown, index: number) => {
      const row = entry as { tipoRiga?: string; dataOra?: string; hash?: string };
      console.log(`   ${index + 1}. ${row.tipoRiga || 'N/A'} - ${row.dataOra || 'N/A'}`);
      console.log(`      Hash: ${row.hash?.substring(0, 32) || 'N/A'}...`);
    });
  } else {
    console.log('   No journal entries available');
  }

  console.log(`\n📤 Journal ready for PEL sync (${JSON.stringify(journal).length} bytes)`);

  console.log(`\n📄 Total documents stored: ${summary.totalDocuments}`);

  console.log('\n🎉 PEM Example Complete!');
  console.log('\n💡 Next Steps:');
  console.log('   1. PEL receives documents in real-time');
  console.log('   2. PEL aggregates into daily receipts (Corrispettivi Giornalieri)');
  console.log('   3. PEL transmits to ADE');
  console.log('   4. ADE can audit via PEL audit server');
}

main().catch(console.error);
