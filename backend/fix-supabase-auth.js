const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseServiceRole = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSupabaseAuth() {
  console.log('🔧 Fixing Supabase Authentication Issues...\n');

  // Step 1: Check if auth trigger exists and works
  console.log('1. Checking auth trigger...');
  try {
    const { data, error } = await supabaseServiceRole.rpc('pg_get_functiondef', {
      funcid: 'public.handle_new_user'
    });

    if (error) {
      console.log('   ❌ Auth trigger function missing or broken');
      console.log('   📝 You need to recreate the trigger in Supabase SQL editor');
    } else {
      console.log('   ✅ Auth trigger function exists');
    }
  } catch (error) {
    console.log('   ❓ Cannot check trigger status');
  }

  // Step 2: Try to create a test auth user to see if the system works
  console.log('\n2. Testing auth user creation...');
  try {
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    const { data, error } = await supabaseServiceRole.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      user_metadata: {
        full_name: 'Test User'
      }
    });

    if (error) {
      console.log(`   ❌ Auth user creation failed: ${error.message}`);
    } else {
      console.log('   ✅ Auth user creation works');
      
      // Check if the trigger created the public.users entry
      const { data: publicUser, error: publicError } = await supabaseServiceRole
        .from('users')
        .select('*')
        .eq('id', data.user.id);

      if (publicError || !publicUser || publicUser.length === 0) {
        console.log('   ❌ Trigger did not create public.users entry');
        console.log('   📝 The auth trigger is broken and needs to be fixed');
        
        // Try to manually create the public user entry
        const { error: insertError } = await supabaseServiceRole
          .from('users')
          .insert([{
            id: data.user.id,
            email: data.user.email,
            full_name: 'Test User',
            role: 'citizen'
          }]);

        if (insertError) {
          console.log(`   ❌ Manual user creation also failed: ${insertError.message}`);
        } else {
          console.log('   ✅ Manually created public.users entry');
        }
      } else {
        console.log('   ✅ Trigger successfully created public.users entry');
      }

      // Clean up test user
      await supabaseServiceRole.auth.admin.deleteUser(data.user.id);
      console.log('   🧹 Test user cleaned up');
    }
  } catch (error) {
    console.log(`   ❌ Auth test error: ${error.message}`);
  }

  // Step 3: Check and fix RLS policies
  console.log('\n3. Checking RLS status...');
  try {
    const { data, error } = await supabaseServiceRole
      .from('pg_tables')
      .select('tablename, rowsecurity')
      .eq('schemaname', 'public')
      .in('tablename', ['users', 'reports']);

    if (error) {
      console.log('   ❓ Cannot check RLS status');
    } else {
      console.log('   RLS Status for tables:', data);
      
      // Check if RLS is properly enabled
      const tablesWithoutRLS = data.filter(table => !table.rowsecurity);
      if (tablesWithoutRLS.length > 0) {
        console.log('   ⚠️  These tables have RLS disabled:', tablesWithoutRLS.map(t => t.tablename));
        console.log('   📝 You need to re-enable RLS in Supabase SQL editor');
      } else {
        console.log('   ✅ RLS is enabled on all tables');
      }
    }
  } catch (error) {
    console.log(`   ❓ RLS check error: ${error.message}`);
  }

  // Step 4: Test creating a real user through the normal signup flow
  console.log('\n4. Testing normal signup flow...');
  try {
    const testEmail = `signup-test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    const { data, error } = await supabaseServiceRole.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          full_name: 'Signup Test User'
        }
      }
    });

    if (error) {
      console.log(`   ❌ Normal signup failed: ${error.message}`);
    } else {
      console.log('   ✅ Normal signup works');
      
      if (data.user) {
        // Clean up
        await supabaseServiceRole.auth.admin.deleteUser(data.user.id);
        console.log('   🧹 Signup test user cleaned up');
      }
    }
  } catch (error) {
    console.log(`   ❌ Signup test error: ${error.message}`);
  }

  console.log('\n📋 SUMMARY OF ISSUES FOUND:');
  console.log('════════════════════════════════════════');
  console.log('Based on the tests above, here\'s what you need to fix:');
  console.log('');
  console.log('🔧 IN SUPABASE DASHBOARD → SQL EDITOR:');
  console.log('');
  console.log('1. Re-create the auth trigger (if it\'s broken):');
  console.log('');
  console.log('   CREATE OR REPLACE FUNCTION public.handle_new_user()');
  console.log('   RETURNS TRIGGER AS $$');
  console.log('   BEGIN');
  console.log('       INSERT INTO public.users (id, email, full_name, role)');
  console.log('       VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>\'full_name\', \'citizen\');');
  console.log('       RETURN NEW;');
  console.log('   END;');
  console.log('   $$ LANGUAGE plpgsql SECURITY DEFINER;');
  console.log('');
  console.log('   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;');
  console.log('   CREATE TRIGGER on_auth_user_created');
  console.log('       AFTER INSERT ON auth.users');
  console.log('       FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();');
  console.log('');
  console.log('2. Re-enable RLS on all tables (if disabled):');
  console.log('');
  console.log('   ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;');
  console.log('   ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;');
  console.log('   ALTER TABLE public.report_votes ENABLE ROW LEVEL SECURITY;');
  console.log('   ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;');
  console.log('   ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;');
  console.log('');
  console.log('🔄 THEN: Restart your backend server');
  console.log('🧪 THEN: Run this test script again to verify fixes');
}

// Run the fix
fixSupabaseAuth().catch(console.error);
