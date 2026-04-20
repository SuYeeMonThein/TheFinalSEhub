const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL || 'https://pkgqgvwkvcuigxbwrmkj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZ3FndndrdmN1aWd4YndybWtqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk1MTc3MywiZXhwIjoyMDc4NTI3NzczfQ.tp49IUSdREcl7PAbV6s70UREprmbbwuPPhQh62JySXQ';

const supabase = createClient(supabaseUrl, supabaseKey);

const migrationSQL = fs.readFileSync(
  path.join(__dirname, '../../database/migrations/20260218_add_project_comments.sql'),
  'utf8'
);

supabase.rpc('exec_sql', { sql_string: migrationSQL })
  .then(() => {
    console.log('✓ Migration executed successfully');
    process.exit(0);
  })
  .catch(async (error) => {
    console.log('RPC method not available, trying direct SQL...');
    const statements = migrationSQL.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          const { error } = await supabase.rpc('exec', { sql: statement });
          if (error) throw error;
        } catch (e) {
          console.log('Direct execution also not available. Run migration manually in Supabase SQL editor:');
          console.log(migrationSQL);
          process.exit(1);
        }
      }
    }
    console.log('✓ Migration executed successfully');
    process.exit(0);
  });
