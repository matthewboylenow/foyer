import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from './client';
import { tenants, displays, settings, slides } from './schema';

async function seed() {
  console.log('🌱 Seeding database…');

  // 1. Tenant
  const [tenant] = await db
    .insert(tenants)
    .values({ name: 'Saint Helen Parish', slug: 'saint-helen' })
    .onConflictDoNothing()
    .returning();

  if (!tenant) {
    const existing = await db.query.tenants.findFirst();
    if (!existing) throw new Error('Could not create or find tenant');
    console.log('  tenant already exists, skipping');
    return;
  }

  console.log(`  ✓ tenant: ${tenant.name} (${tenant.id})`);

  // 2. Displays
  const [lobby, hallway] = await db
    .insert(displays)
    .values([
      { tenantId: tenant.id, name: 'Lobby', location: 'Main entrance' },
      { tenantId: tenant.id, name: 'Hallway', location: 'East hallway near gym' },
    ])
    .returning();

  console.log(`  ✓ displays: ${lobby.name} (${lobby.id}), ${hallway.name} (${hallway.id})`);

  // 3. Settings
  await db.insert(settings).values({
    tenantId: tenant.id,
    globalDurationSec: 15,
    videoEnabled: false,
    primaryColor: '#1F346D',
    accentColor: '#CD5334',
    creamColor: '#FAF9F7',
    goldColor: '#D4AF37',
  });

  console.log('  ✓ settings');

  // 4. Sample slides
  await db.insert(slides).values([
    {
      tenantId: tenant.id,
      templateType: 'parish_identity',
      title: 'Parish Identity',
      content: {
        templateType: 'parish_identity',
        headline: 'Saint Helen Parish',
        subline: 'A Community of Faith in Westfield, NJ',
      },
      scheduleType: 'evergreen',
      active: true,
      weight: 1,
    },
    {
      tenantId: tenant.id,
      templateType: 'general',
      title: 'Sample Announcement',
      content: {
        templateType: 'general',
        headline: 'Welcome to Saint Helen',
        body: 'We are glad you are here. Join us for Mass, faith formation, and community.',
        meta: 'Masses: Sat 5 PM · Sun 7, 9, 10:30 AM, 12 PM',
      },
      scheduleType: 'evergreen',
      active: true,
      weight: 1,
    },
    {
      tenantId: tenant.id,
      templateType: 'welcome_quote',
      title: 'Welcome Quote',
      content: {
        templateType: 'welcome_quote',
        quote: 'Come to me, all you who are weary and burdened, and I will give you rest.',
        attribution: 'Matthew 11:28',
      },
      scheduleType: 'evergreen',
      active: true,
      weight: 1,
    },
  ]);

  console.log('  ✓ sample slides (3)');
  console.log('\n✅ Seed complete');
  console.log('\nDisplay URLs:');
  console.log(`  Lobby:   /display/${lobby.id}`);
  console.log(`  Hallway: /display/${hallway.id}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
