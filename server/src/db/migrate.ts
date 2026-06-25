import { db } from './index';

export async function runMigrations() {
  console.log('Running database migrations...');
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Enable pgcrypto extension for gen_random_uuid()
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // Helper to check and create Postgres enums
    const createEnumIfNotExists = async (typeName: string, values: string[]) => {
      const checkEnum = await client.query(
        "SELECT 1 FROM pg_type WHERE typname = $1",
        [typeName]
      );
      if (checkEnum.rowCount === 0) {
        const valString = values.map(v => `'${v}'`).join(', ');
        await client.query(`CREATE TYPE ${typeName} AS ENUM (${valString})`);
      }
    };

    await createEnumIfNotExists('user_role', ['user', 'admin']);
    await createEnumIfNotExists('board_visibility', ['private', 'public', 'link-only']);
    await createEnumIfNotExists('subscription_plan', ['free', 'pro', 'team']);
    await createEnumIfNotExists('subscription_status', ['active', 'past_due', 'canceled', 'unpaid', 'incomplete']);
    await createEnumIfNotExists('social_provider', ['linkedin', 'twitter']);
    await createEnumIfNotExists('report_status', ['open', 'resolved']);

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role user_role DEFAULT 'user' NOT NULL,
        verified BOOLEAN DEFAULT FALSE NOT NULL,
        suspended BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_login TIMESTAMP WITH TIME ZONE
      )
    `);

    // Create sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        refresh_token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        ip VARCHAR(45),
        user_agent VARCHAR(255)
      )
    `);

    // Create boards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS boards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        title VARCHAR(255) DEFAULT 'Untitled Board' NOT NULL,
        data JSONB DEFAULT '[]'::jsonb NOT NULL,
        thumbnail_url TEXT,
        visibility board_visibility DEFAULT 'private' NOT NULL,
        share_token UUID DEFAULT gen_random_uuid() NOT NULL,
        allow_comments BOOLEAN DEFAULT TRUE NOT NULL,
        allow_fork BOOLEAN DEFAULT TRUE NOT NULL,
        view_count INTEGER DEFAULT 0 NOT NULL,
        fork_count INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    // Create board_members table
    await client.query(`
      CREATE TABLE IF NOT EXISTS board_members (
        board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'editor' NOT NULL,
        PRIMARY KEY (board_id, user_id)
      )
    `);

    // Create password_resets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Create subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        plan subscription_plan DEFAULT 'free' NOT NULL,
        status subscription_status DEFAULT 'active' NOT NULL,
        current_period_end TIMESTAMP WITH TIME ZONE
      )
    `);

    // Create ai_usage table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        provider VARCHAR(50) NOT NULL,
        model VARCHAR(100) NOT NULL,
        input_tokens INTEGER DEFAULT 0 NOT NULL,
        output_tokens INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    // Create social_tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS social_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        provider social_provider NOT NULL,
        access_token_enc TEXT NOT NULL,
        refresh_token_enc TEXT,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT unique_user_provider UNIQUE(user_id, provider)
      )
    `);

    // Create reports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        board_id UUID REFERENCES boards(id) ON DELETE CASCADE NOT NULL,
        reason TEXT NOT NULL,
        status report_status DEFAULT 'open' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    // Create admin_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    // Alter tables for schema updates
    await client.query(`
      ALTER TABLE boards 
      ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '' NOT NULL
    `);

    await client.query('COMMIT');
    console.log('Database migrations completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}
