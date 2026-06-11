const BASE_URL = 'http://localhost:5000/api';

const runTests = async () => {
  console.log('=== STARTING LEADS MAINTENANCE SYSTEM INTEGRATION TESTS ===\n');
  
  let accessToken = null;
  let headers = { 'Content-Type': 'application/json' };
  let cookies = '';

  // Helper to parse cookies from response
  const getCookies = (res) => {
    if (typeof res.headers.getSetCookie === 'function') {
      return res.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
    }
    const cookieHeader = res.headers.get('set-cookie');
    return cookieHeader ? cookieHeader.split(';')[0] : '';
  };

  // 1. LOGIN TEST
  console.log('1. Testing Login...');
  try {
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: 'admin@gmail.com',
        password: 'admin123'
      })
    });

    if (!loginRes.ok) {
      const err = await loginRes.json();
      throw new Error(`Login failed: ${err.message}`);
    }

    const loginData = await loginRes.json();
    accessToken = loginData.accessToken;
    cookies = getCookies(loginRes);
    
    // Update headers with token
    headers['Authorization'] = `Bearer ${accessToken}`;
    if (cookies) {
      headers['Cookie'] = cookies;
    }

    console.log(`✔ Login Succeeded! User: ${loginData.user.name} (Role: ${loginData.user.role})\n`);
  } catch (err) {
    console.error('❌ Login Test Failed:', err.message);
    process.exit(1);
  }

  // 2. PROFILE TEST (/auth/me)
  console.log('2. Testing Profile Fetch...');
  try {
    const profileRes = await fetch(`${BASE_URL}/auth/me`, { headers });
    if (!profileRes.ok) throw new Error(`Me API failed: ${profileRes.statusText}`);
    const profile = await profileRes.json();
    console.log(`✔ Me API Succeeded! Name: ${profile.name}, Permissions: ${profile.permissions.join(', ')}\n`);
  } catch (err) {
    console.error('❌ Profile Test Failed:', err.message);
    process.exit(1);
  }

  // 3. CREATE VERTICAL TEST
  console.log('3. Creating a Vertical...');
  let verticalId = null;
  const uniqueSuffix = Date.now();
  try {
    const vertRes = await fetch(`${BASE_URL}/verticals`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Real Estate USA ${uniqueSuffix}`,
        description: 'Primary real estate vertical for US leads'
      })
    });

    if (!vertRes.ok) {
      const err = await vertRes.json();
      throw new Error(err.message);
    }

    const vertical = await vertRes.json();
    verticalId = vertical._id;
    console.log(`✔ Vertical Created Succeeded! Name: ${vertical.name}, Slug: ${vertical.slug}, ID: ${verticalId}\n`);
  } catch (err) {
    console.error('❌ Vertical Creation Failed:', err.message);
    process.exit(1);
  }

  // 4. CREATE SUB-VERTICAL TEST
  console.log('4. Creating a Sub-Vertical...');
  let subVerticalId = null;
  try {
    const subRes = await fetch(`${BASE_URL}/verticals/${verticalId}/subverticals`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Residential Homes'
      })
    });

    if (!subRes.ok) {
      const err = await subRes.json();
      throw new Error(err.message);
    }

    const sub = await subRes.json();
    subVerticalId = sub._id;
    console.log(`✔ Sub-Vertical Created! Name: ${sub.name}, Slug: ${sub.slug}, ID: ${subVerticalId}\n`);
  } catch (err) {
    console.error('❌ Sub-Vertical Creation Failed:', err.message);
    process.exit(1);
  }

  // 5. CREATE CUSTOM FIELD CONFIGURATION TEST
  console.log('5. Configuring Dynamic Fields...');
  try {
    // Add budget field (Number, Required)
    const budgetRes = await fetch(`${BASE_URL}/configs/verticals/${verticalId}/configs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fieldKey: 'budget',
        label: 'Purchase Budget',
        fieldType: 'number',
        isRequired: true,
        isCsvMapped: true,
        displayOrder: 1
      })
    });

    if (!budgetRes.ok) {
      const err = await budgetRes.json();
      throw new Error(`Budget config error: ${err.message}`);
    }

    // Add city field (Select, Optional)
    const cityRes = await fetch(`${BASE_URL}/configs/verticals/${verticalId}/configs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fieldKey: 'city',
        label: 'City Select',
        fieldType: 'select',
        options: ['Seattle', 'Miami', 'Dallas'],
        isRequired: false,
        isCsvMapped: true,
        displayOrder: 2
      })
    });

    if (!cityRes.ok) {
      const err = await cityRes.json();
      throw new Error(`City config error: ${err.message}`);
    }

    console.log('✔ Custom Fields Configured Successfully!\n');
  } catch (err) {
    console.error('❌ Fields Configuration Failed:', err.message);
    process.exit(1);
  }

  // 6. CREATE MANUAL LEAD TEST (VALIDATION CHECKS)
  console.log('6. Testing Lead Custom field validation...');
  
  // Test 6a: Missing required dynamic field 'budget' (Should fail)
  console.log('  Testing 6a: Missing required dynamic field "budget" (Expected: FAIL)');
  try {
    const failRes = await fetch(`${BASE_URL}/leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        verticalId,
        subVerticalId,
        name: 'Jane Smith Missing Budget',
        phone: '1234567890',
        data: {
          city: 'Seattle'
        }
      })
    });

    if (failRes.status === 400) {
      const err = await failRes.json();
      console.log(`  ✔ Validation caught error successfully: "${err.errors.join(', ')}"\n`);
    } else {
      throw new Error(`Expected HTTP 400 but got ${failRes.status}`);
    }
  } catch (err) {
    console.error('  ❌ Test 6a Failed:', err.message);
    process.exit(1);
  }

  // Test 6b: Valid lead with custom fields (Should succeed)
  console.log('  Testing 6b: Submitting fully valid lead (Expected: SUCCESS)');
  let leadId = null;
  try {
    const successRes = await fetch(`${BASE_URL}/leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        verticalId,
        subVerticalId,
        name: 'Jane Valid Smith',
        phone: '2065551234',
        businessName: 'Smith Holdings LLC',
        data: {
          budget: 450000,
          city: 'Seattle'
        }
      })
    });

    if (!successRes.ok) {
      const err = await successRes.json();
      throw new Error(err.message);
    }

    const lead = await successRes.json();
    leadId = lead._id;
    console.log(`  ✔ Lead Created Succeeded! Name: ${lead.name}, Phone: ${lead.phone}, Custom Budget: ${lead.data.budget}, City: ${lead.data.city}, ID: ${leadId}\n`);
  } catch (err) {
    console.error('  ❌ Test 6b Failed:', err.message);
    process.exit(1);
  }

  // 7. GET LEADS LIST WITH QUERY FILTERS
  console.log('7. Testing Leads Query Filters...');
  try {
    const getRes = await fetch(`${BASE_URL}/leads?verticalId=${verticalId}&q=Jane`, { headers });
    if (!getRes.ok) throw new Error(`Leads query failed: ${getRes.statusText}`);
    
    const listData = await getRes.json();
    console.log(`✔ Query Succeeded! Total: ${listData.pagination.total}, First Lead Name: ${listData.leads[0].name}\n`);
  } catch (err) {
    console.error('❌ Leads Query Test Failed:', err.message);
    process.exit(1);
  }

  // 8. LOGOUT TEST
  console.log('8. Testing Logout...');
  try {
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers
    });

    if (!logoutRes.ok) throw new Error(`Logout request failed: ${logoutRes.statusText}`);
    console.log('✔ Logout Succeeded!\n');
  } catch (err) {
    console.error('❌ Logout Test Failed:', err.message);
    process.exit(1);
  }

  console.log('=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===');
};

runTests();
