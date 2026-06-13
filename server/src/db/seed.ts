import bcrypt from 'bcrypt';
import { db } from './index';
import dotenv from 'dotenv';

dotenv.config();

export async function seedAdmin() {
  const email = process.env.ADMIN_SEED_EMAIL || 'admin@whiteboard.app';
  const password = process.env.ADMIN_SEED_PASSWORD || 'AdminPassword123!';

  console.log(`Seeding admin user: ${email}...`);

  try {
    // Hash password
    const hash = await bcrypt.hash(password, 12);
    
    // Insert user
    const userRes = await db.query(
      `INSERT INTO users (email, password_hash, role, verified)
       VALUES ($1, $2, 'admin', true)
       ON CONFLICT (email) DO UPDATE 
       SET password_hash = EXCLUDED.password_hash, role = 'admin', verified = true
       RETURNING id`,
      [email, hash]
    );

    const userId = userRes.rows[0].id;
    console.log(`Admin user seeded successfully with ID ${userId}.`);

    // Ensure subscription exists
    await db.query(
      `INSERT INTO subscriptions (user_id, plan, status)
       VALUES ($1, 'team', 'active')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    console.log(`Admin subscription seeded successfully.`);

  } catch (err) {
    console.error('Seeding admin failed:', err);
    throw err;
  }
}

// Run if called directly
if (require.main === module) {
  seedAdmin().then(() => {
    console.log('Seeding process complete.');
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
