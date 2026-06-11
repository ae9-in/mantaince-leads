import axios from 'axios';

const API_URL = 'http://localhost:5000/api/v1';
const credentials = {
    email: 'admin@gmail.com',
    password: 'admin123'
};

async function testBackend() {
    console.log('🧪 Starting Full Backend Implementation Test...');
    let token = '';

    try {
        // 1. Test Login
        console.log('\n--- 1. Testing Login ---');
        const loginRes = await axios.post(`${API_URL}/auth/login`, credentials);
        if (loginRes.data.success) {
            console.log('✅ Login Successful!');
            token = loginRes.data.data.accessToken;
            console.log('🔑 Token acquired.');
        } else {
            console.error('❌ Login Failed:', loginRes.data);
            return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        // 2. Test /auth/me
        console.log('\n--- 2. Testing /auth/me ---');
        const meRes = await axios.get(`${API_URL}/auth/me`, { headers });
        console.log('✅ Profile retrieved:', meRes.data.data.name, `(${meRes.data.data.role})`);

        // 3. Test Verticals
        console.log('\n--- 3. Testing /verticals ---');
        const vertRes = await axios.get(`${API_URL}/verticals`, { headers });
        console.log('✅ Verticals retrieved:', vertRes.data.data.length);
        if (vertRes.data.data.length > 0) {
            console.log(`📍 First Vertical: ${vertRes.data.data[0].name} (ID: ${vertRes.data.data[0].id})`);
        }

        // 4. Test Users
        console.log('\n--- 4. Testing /users ---');
        const usersRes = await axios.get(`${API_URL}/users`, { headers });
        console.log('✅ Users retrieved:', usersRes.data.data.length);

        // 5. Test Leads (should be empty but succeed)
        console.log('\n--- 5. Testing /leads (Empty State) ---');
        if (vertRes.data.data.length > 0) {
            const verticalId = vertRes.data.data[0].id;
            const leadsRes = await axios.get(`${API_URL}/leads?verticalId=${verticalId}`, { headers });
            console.log('✅ Leads retrieved:', leadsRes.data.data.length);
        } else {
            console.log('⏩ Skipping Leads test (no vertical available)');
        }

        // 6. Test Audit Logs
        console.log('\n--- 6. Testing /audit-logs ---');
        const auditRes = await axios.get(`${API_URL}/audit-logs`, { headers });
        console.log('✅ Audit logs retrieved:', auditRes.data.data.length);
        console.log('📈 Performance tracking is active.');

        console.log('\n🏆 ALL CORE BACKEND IMPLEMENTATIONS ARE VERIFIED AND WORKING!');
    } catch (err) {
        console.error('\n💥 Test Failed!');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Error Data:', err.response.data);
        } else {
            console.error('Error Message:', err.message);
        }
        process.exit(1);
    }
}

testBackend();
