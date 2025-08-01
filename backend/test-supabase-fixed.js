const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSupabaseFixedIssues() {
  console.log('🔧 Testing Supabase with Proper UUID Format...\n');
  
  // Test 1: Insert with proper UUID
  console.log('1. Testing data insertion with proper UUID...');
  try {
    // Generate a proper UUID
    const testUuid = crypto.randomUUID();
    const testData = {
      id: testUuid,
      email: 'test@example.com',
      role: 'citizen',
      full_name: 'Test User',
      phone: '1234567890'
    };

    console.log(`   Using UUID: ${testUuid}`);

    const { data, error } = await supabaseServiceRole
      .from('users')
      .insert([testData])
      .select();

    if (error) {
      console.log(`   ❌ Insert still failed: ${error.message}`);
      console.log(`   Error code: ${error.code}`);
      console.log(`   Error details:`, error);
    } else {
      console.log('   ✅ Insert successful with proper UUID!');
      
      // Clean up test data
      await supabaseServiceRole
        .from('users')
        .delete()
        .eq('id', testUuid);
      console.log('   ✅ Test data cleaned up');
    }
  } catch (error) {
    console.log(`   ❌ Insert error: ${error.message}`);
  }

  // Test 2: Check RLS policies in detail
  console.log('\n2. Checking RLS policies in detail...');
  try {
    const { data, error } = await supabaseServiceRole.rpc('get_table_rls_status', {
      table_name: 'users'
    });

    if (error) {
      console.log('   ❓ Could not check RLS status via RPC');
      // Alternative check - try to get table info
      const { data: tableInfo, error: tableError } = await supabaseServiceRole
        .from('information_schema.tables')
        .select('*')
        .eq('table_name', 'users');
      
      if (tableError) {
        console.log('   ❓ Could not access table information');
      }
    } else {
      console.log('   RLS Status:', data);
    }
  } catch (error) {
    console.log(`   ❓ RLS check error: ${error.message}`);
  }

  // Test 3: Test reports table insertion
  console.log('\n3. Testing reports table insertion...');
  try {
    // First, let's see what the reports table structure looks like
    const { data: reportData, error: reportError } = await supabaseServiceRole
      .from('reports')
      .select('*')
      .limit(1);

    if (reportError) {
      console.log(`   ❌ Cannot access reports table: ${reportError.message}`);
    } else {
      console.log(`   ✅ Reports table accessible. Sample structure:`, 
        reportData.length > 0 ? Object.keys(reportData[0]) : 'No existing data');
    }
  } catch (error) {
    console.log(`   ❌ Reports test error: ${error.message}`);
  }

  console.log('\n📊 Enhanced diagnosis complete!');
}

// Run the enhanced test
testSupabaseFixedIssues().catch(console.error);
