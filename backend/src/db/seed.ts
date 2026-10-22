import { Database as DatabaseType } from 'better-sqlite3';
import db from './database';

function isSeedCompleted(activeDb: DatabaseType): boolean {
  const row = activeDb.prepare(
    "SELECT COUNT(*) as count FROM appliances WHERE id LIKE 'demo-%'"
  ).get() as { count: number };
  return row.count > 0;
}

function seedWarrantyDocsIfMissing(activeDb: DatabaseType): void {
  const count = (activeDb.prepare("SELECT COUNT(*) as count FROM warranty_documents WHERE id LIKE 'demo-%'").get() as { count: number }).count;
  if (count === 0) {
    const insertDoc = activeDb.prepare(`
      INSERT INTO warranty_documents (id, appliance_id, filename, original_name, mime_type, file_size, storage_path, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertDoc.run('demo-doc-001', 'demo-app-001', 'samsung_rf28_warranty_certificate.pdf', 'Samsung French Door Refrigerator Warranty Certificate.pdf', 'application/pdf', 1425800, 'safe://documents/demo-doc-001.pdf', '2023-04-15 10:00:00');
    insertDoc.run('demo-doc-002', 'demo-app-003', 'carrier_ac_extended_warranty_guide.pdf', 'Carrier 16 SEER Extended Warranty Guide.pdf', 'application/pdf', 2891200, 'safe://documents/demo-doc-002.pdf', '2022-08-15 14:30:00');
    insertDoc.run('demo-doc-003', 'demo-app-004', 'bosch_dishwasher_user_manual.pdf', 'Bosch 800 Series User Manual & Warranty.pdf', 'application/pdf', 3145728, 'safe://documents/demo-doc-003.pdf', '2024-01-10 11:15:00');
  }
}

export function seedDatabase(targetDb?: DatabaseType): boolean {
  const activeDb = targetDb || db;

  if (isSeedCompleted(activeDb)) {
    seedWarrantyDocsIfMissing(activeDb);
    console.log('[seed] Demo data already exists, skipping seed.');
    return false;
  }

  console.log('[seed] Inserting demo data...');

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const appliances = [
    {
      id: 'demo-app-001',
      name: 'Kitchen Refrigerator',
      category: 'Kitchen',
      brand: 'Samsung',
      model: 'RF28R7551SR',
      serial_number: 'SN-RF28-20230415',
      purchase_date: '2023-04-15',
      warranty_expiration: '2026-04-15',
      location: 'Kitchen',
      notes: 'French door, stainless steel finish',
    },
    {
      id: 'demo-app-002',
      name: 'Front Load Washer',
      category: 'Laundry',
      brand: 'LG',
      model: 'WM4500HBA',
      serial_number: 'SN-WM45-20230601',
      purchase_date: '2023-06-01',
      warranty_expiration: '2025-06-01',
      location: 'Laundry Room',
      notes: 'TurboWash 360, black steel',
    },
    {
      id: 'demo-app-003',
      name: 'Central AC Unit',
      category: 'HVAC',
      brand: 'Carrier',
      model: '24ACC636A003',
      serial_number: 'SN-AC24-20220815',
      purchase_date: '2022-08-15',
      warranty_expiration: '2027-08-15',
      location: 'Backyard',
      notes: '3-ton, 16 SEER',
    },
    {
      id: 'demo-app-004',
      name: 'Dishwasher',
      category: 'Kitchen',
      brand: 'Bosch',
      model: 'SHPM88Z75N',
      serial_number: 'SN-DW88-20240110',
      purchase_date: '2024-01-10',
      warranty_expiration: '2026-01-10',
      location: 'Kitchen',
      notes: '800 Series, pocket handle',
    },
    {
      id: 'demo-app-005',
      name: 'Water Heater',
      category: 'Plumbing',
      brand: 'Rheem',
      model: 'PROG50-38N',
      serial_number: 'SN-WH50-20210320',
      purchase_date: '2021-03-20',
      warranty_expiration: '2027-03-20',
      location: 'Garage',
      notes: '50-gallon, natural gas',
    },
  ];

  const insertAppliance = activeDb.prepare(`
    INSERT INTO appliances (id, name, category, brand, model, serial_number, purchase_date, warranty_expiration, location, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCase = activeDb.prepare(`
    INSERT INTO repair_cases (id, appliance_id, issue_description, priority, status, appointment_date, appointment_notes, resolution_notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvent = activeDb.prepare(`
    INSERT INTO repair_events (id, case_id, event_type, description, old_value, new_value, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const seedAll = activeDb.transaction(() => {
    // Insert appliances
    for (const a of appliances) {
      insertAppliance.run(
        a.id, a.name, a.category, a.brand, a.model, a.serial_number,
        a.purchase_date, a.warranty_expiration, a.location, a.notes, now, now
      );
    }

    // Repair case 1: Refrigerator - open
    insertCase.run(
      'demo-case-001', 'demo-app-001',
      'Refrigerator is making a loud buzzing noise intermittently. Temperature seems stable but the noise is concerning.',
      'medium', 'diagnosed',
      null, null, null,
      '2026-10-18 09:30:00', '2026-10-19 14:00:00'
    );
    insertEvent.run('demo-evt-001', 'demo-case-001', 'created', 'Case opened: loud buzzing noise from refrigerator', null, null, '2026-10-18 09:30:00');
    insertEvent.run('demo-evt-002', 'demo-case-001', 'status_change', 'Diagnosed as potential condenser fan issue. Recommend scheduling a technician visit.', 'open', 'diagnosed', '2026-10-19 14:00:00');

    // Repair case 2: Washer - scheduled
    insertCase.run(
      'demo-case-002', 'demo-app-002',
      'Washer leaks water from the bottom during the spin cycle.',
      'high', 'scheduled',
      '2026-10-25 10:00:00', 'Technician visit scheduled with HomeServe', null,
      '2026-10-15 11:00:00', '2026-10-17 16:30:00'
    );
    insertEvent.run('demo-evt-003', 'demo-case-002', 'created', 'Case opened: water leak during spin cycle', null, null, '2026-10-15 11:00:00');
    insertEvent.run('demo-evt-004', 'demo-case-002', 'status_change', 'Diagnosed as worn door gasket', 'open', 'diagnosed', '2026-10-16 10:00:00');
    insertEvent.run('demo-evt-005', 'demo-case-002', 'appointment_set', 'Technician visit scheduled for Oct 25, 2026 at 10:00 AM', null, null, '2026-10-17 16:30:00');
    insertEvent.run('demo-evt-006', 'demo-case-002', 'status_change', 'Status updated to scheduled', 'diagnosed', 'scheduled', '2026-10-17 16:30:00');

    // Repair case 3: AC - resolved
    insertCase.run(
      'demo-case-003', 'demo-app-003',
      'AC not cooling effectively. Thermostat set to 72°F but house stays at 80°F.',
      'urgent', 'resolved',
      null, null, 'Refrigerant was low. Recharged system and tested. Cooling normally now.',
      '2026-10-01 08:00:00', '2026-10-05 17:00:00'
    );
    insertEvent.run('demo-evt-007', 'demo-case-003', 'created', 'Case opened: AC not cooling effectively', null, null, '2026-10-01 08:00:00');
    insertEvent.run('demo-evt-008', 'demo-case-003', 'status_change', 'Emergency technician dispatched', 'open', 'in_progress', '2026-10-02 09:00:00');
    insertEvent.run('demo-evt-009', 'demo-case-003', 'resolved', 'Refrigerant recharged. System tested and cooling normally.', 'in_progress', 'resolved', '2026-10-05 17:00:00');

    // Demo warranty documents (safe metadata storage)
    const insertDoc = activeDb.prepare(`
      INSERT INTO warranty_documents (id, appliance_id, filename, original_name, mime_type, file_size, storage_path, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertDoc.run('demo-doc-001', 'demo-app-001', 'samsung_rf28_warranty_certificate.pdf', 'Samsung French Door Refrigerator Warranty Certificate.pdf', 'application/pdf', 1425800, 'safe://documents/demo-doc-001.pdf', '2023-04-15 10:00:00');
    insertDoc.run('demo-doc-002', 'demo-app-003', 'carrier_ac_extended_warranty_guide.pdf', 'Carrier 16 SEER Extended Warranty Guide.pdf', 'application/pdf', 2891200, 'safe://documents/demo-doc-002.pdf', '2022-08-15 14:30:00');
    insertDoc.run('demo-doc-003', 'demo-app-004', 'bosch_dishwasher_user_manual.pdf', 'Bosch 800 Series User Manual & Warranty.pdf', 'application/pdf', 3145728, 'safe://documents/demo-doc-003.pdf', '2024-01-10 11:15:00');
  });

  seedAll();
  console.log('[seed] Demo data inserted successfully.');
  return true;
}
