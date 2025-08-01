const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create clients using the environment variables
const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...\n');
  
  // Test 1: Basic URL Connection
  console.log('1. Testing Supabase URL connection...');
  console.log(`   URL: ${process.env.SUPABASE_URL}`);
  
  try {
    const response = await fetch(process.env.SUPABASE_URL);
    console.log(`   ✅ URL accessible (Status: ${response.status})`);
  } catch (error) {
    console.log(`   ❌ URL not accessible: ${error.message}`);
    return;
  }

  // Test 2: Service Role Key Authentication
  console.log('\n2. Testing Service Role Key...');
  try {
    const { data, error } = await supabaseServiceRole
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log(`   ❌ Service Role Key failed: ${error.message}`);
    } else {
      console.log('   ✅ Service Role Key working');
    }
  } catch (error) {
    console.log(`   ❌ Service Role Key error: ${error.message}`);
  }

  // Test 3: Anonymous Key Authentication  
  console.log('\n3. Testing Anonymous Key...');
  try {
    const { data, error } = await supabaseAnon
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log(`   ❌ Anonymous Key failed: ${error.message}`);
    } else {
      console.log('   ✅ Anonymous Key working');
    }
  } catch (error) {
    console.log(`   ❌ Anonymous Key error: ${error.message}`);
  }

  // Test 4: Check if tables exist
  console.log('\n4. Checking database tables...');
  const tables = ['users', 'reports', 'push_tokens'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabaseServiceRole
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`   ❌ Table '${table}': ${error.message}`);
      } else {
        console.log(`   ✅ Table '${table}' exists and accessible`);
      }
    } catch (error) {
      console.log(`   ❌ Table '${table}' error: ${error.message}`);
    }
  }

  // Test 5: Try inserting test data
  console.log('\n5. Testing data insertion...');
  try {
    const testData = {
      id: 'test-' + Date.now(),
      email: 'test@example.com',
      role: 'citizen',
      full_name: 'Test User',
      phone: '1234567890'
    };

    const { data, error } = await supabaseServiceRole
      .from('users')
      .insert([testData])
      .select();

    if (error) {
      console.log(`   ❌ Insert failed: ${error.message}`);
      console.log(`   Error details:`, error);
    } else {
      console.log('   ✅ Insert successful');
      
      // Clean up test data
      await supabaseServiceRole
        .from('users')
        .delete()
        .eq('id', testData.id);
      console.log('   ✅ Test data cleaned up');
    }
  } catch (error) {
    console.log(`   ❌ Insert error: ${error.message}`);
  }

  // Test 6: Check RLS policies
  console.log('\n6. Testing Row Level Security...');
  try {
    // Try to access data with anon client (should be restricted by RLS)
    const { data, error } = await supabaseAnon
      .from('users')
      .select('*')
      .limit(1);

    if (error && error.message.includes('permission')) {
      console.log('   ✅ RLS is active (anon access properly restricted)');
    } else if (!error) {
      console.log('   ⚠️  RLS might be disabled (anon access allowed)');
    } else {
      console.log(`   ❓ RLS status unclear: ${error.message}`);
    }
  } catch (error) {
    console.log(`   ❌ RLS test error: ${error.message}`);
  }

  console.log('\n📊 Diagnosis complete!');
}

// Run the test
testSupabaseConnection().catch(console.error);
