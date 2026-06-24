import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const auditReportPath = path.resolve(__dirname, '../TestAuditReport.md');

const API_URL = 'http://localhost:5000/api/v1';

// Super Admin Credentials (from seed.js)
const superAdminCredentials = {
  email: 'admin@gmail.com',
  password: 'admin123'
};

const testState = {
  superAdminToken: '',
  verticalAdminToken: '',
  agentToken: '',
  verticalAId: '',
  verticalBId: '',
  subVerticalAId: '',
  subVerticalBId: '',
  fieldAId: '',
  costConversionAId: '',
  verticalAdminId: '',
  agentId: '',
  escalationId: '',
  report: []
};

function logTestResult(name, status, details) {
  console.log(`${status === 'PASSED' ? '✅' : '❌'} Test: ${name} - ${status}`);
  if (details) console.log(`   Details: ${details}`);
  testState.report.push({ name, status, details });
}

async function runTests() {
  console.log('🧪 Starting Advanced Backend Implementation & Security Scope Test...');
  
  try {
    // -------------------------------------------------------------
    // 1. SUPER ADMIN AUTHENTICATION
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Super Admin Login ---');
    try {
      const loginRes = await axios.post(`${API_URL}/auth/login`, superAdminCredentials);
      if (loginRes.data.success) {
        testState.superAdminToken = loginRes.data.data.accessToken;
        logTestResult('Super Admin Authentication', 'PASSED', 'Successfully logged in and acquired token.');
      } else {
        throw new Error(JSON.stringify(loginRes.data));
      }
    } catch (err) {
      let msg = err.message;
      if (err.response) {
        msg += ` (Status: ${err.response.status}, Data: ${JSON.stringify(err.response.data)})`;
      }
      logTestResult('Super Admin Authentication', 'FAILED', msg);
      throw new Error(msg);
    }

    const superAdminHeaders = { Authorization: `Bearer ${testState.superAdminToken}` };

    // Test /auth/me
    try {
      const meRes = await axios.get(`${API_URL}/auth/me`, { headers: superAdminHeaders });
      logTestResult('Super Admin Profile Retrieval', 'PASSED', `Retrieved: ${meRes.data.data.name} (${meRes.data.data.role})`);
    } catch (err) {
      logTestResult('Super Admin Profile Retrieval', 'FAILED', err.message);
    }

    // -------------------------------------------------------------
    // 2. VERTICAL CREATION (SUPER ADMIN ONLY)
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Vertical Creation ---');
    try {
      // Create Vertical A
      const vertARes = await axios.post(`${API_URL}/verticals`, {
        name: `Automotive USA ${Date.now()}`,
        description: 'Auto leads vertical',
        color: '#ff4d4d',
        icon: 'Car'
      }, { headers: superAdminHeaders });
      testState.verticalAId = vertARes.data.data.id;

      // Create Vertical B
      const vertBRes = await axios.post(`${API_URL}/verticals`, {
        name: `Healthcare UK ${Date.now()}`,
        description: 'Healthcare leads vertical',
        color: '#4dff4d',
        icon: 'Heart'
      }, { headers: superAdminHeaders });
      testState.verticalBId = vertBRes.data.data.id;

      logTestResult('Vertical Creation (Super Admin)', 'PASSED', `Created Vertical A (ID: ${testState.verticalAId}) and Vertical B (ID: ${testState.verticalBId}).`);
    } catch (err) {
      logTestResult('Vertical Creation (Super Admin)', 'FAILED', err.message);
      throw err;
    }

    // -------------------------------------------------------------
    // 3. USER MANAGEMENT & VERTICAL ASSIGNMENT
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing User Scoping & Invitation ---');
    const uniqueVal = Date.now();
    try {
      // Invite Vertical Admin
      const inviteAdminRes = await axios.post(`${API_URL}/users/invite`, {
        name: 'John Admin',
        email: `admin_${uniqueVal}@gmail.com`,
        roleName: 'vertical_admin',
        verticalAccess: [testState.verticalAId]
      }, { headers: superAdminHeaders });
      
      const adminInviteToken = inviteAdminRes.data.data.inviteToken;
      testState.verticalAdminId = inviteAdminRes.data.data.id;

      // Complete registration for Vertical Admin
      const registerAdminRes = await axios.post(`${API_URL}/auth/register`, {
        token: adminInviteToken,
        password: 'adminpassword123'
      });
      testState.verticalAdminToken = registerAdminRes.data.data.accessToken;

      // Invite Agent
      const inviteAgentRes = await axios.post(`${API_URL}/users/invite`, {
        name: 'Bob Agent',
        email: `agent_${uniqueVal}@gmail.com`,
        roleName: 'agent',
        verticalAccess: [testState.verticalAId]
      }, { headers: superAdminHeaders });
      
      const agentInviteToken = inviteAgentRes.data.data.inviteToken;
      testState.agentId = inviteAgentRes.data.data.id;

      // Complete registration for Agent
      const registerAgentRes = await axios.post(`${API_URL}/auth/register`, {
        token: agentInviteToken,
        password: 'agentpassword123'
      });
      testState.agentToken = registerAgentRes.data.data.accessToken;

      logTestResult('Scoped User Onboarding', 'PASSED', 'Successfully created scoped Admin and Agent accounts.');
    } catch (err) {
      logTestResult('Scoped User Onboarding', 'FAILED', err.message);
      throw err;
    }

    const vertAdminHeaders = { Authorization: `Bearer ${testState.verticalAdminToken}` };
    const agentHeaders = { Authorization: `Bearer ${testState.agentToken}` };

    // Create Sub-Verticals
    try {
      const subARes = await axios.post(`${API_URL}/verticals/${testState.verticalAId}/sub-verticals`, {
        name: 'Auto Dealerships'
      }, { headers: vertAdminHeaders });
      testState.subVerticalAId = subARes.data.data.id;

      const subBRes = await axios.post(`${API_URL}/verticals/${testState.verticalBId}/sub-verticals`, {
        name: 'Hospitals Group'
      }, { headers: superAdminHeaders });
      testState.subVerticalBId = subBRes.data.data.id;

      // Assign Bob Agent to Sub-Vertical A
      await axios.patch(`${API_URL}/users/${testState.agentId}/verticals`, {
        verticalAccess: [testState.verticalAId],
        subVerticalAccess: [testState.subVerticalAId]
      }, { headers: superAdminHeaders });

      logTestResult('Sub-Vertical Scoping and Agent Assignment', 'PASSED', `Sub-Vertical A (ID: ${testState.subVerticalAId}) assigned to Agent Bob.`);
    } catch (err) {
      logTestResult('Sub-Vertical Scoping and Agent Assignment', 'FAILED', err.message);
    }

    // -------------------------------------------------------------
    // 4. VERTICAL-ADMIN BOUNDARY TESTS
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Vertical Admin Restrictions ---');
    
    // 4a. Read vertical A (Should pass)
    try {
      const res = await axios.get(`${API_URL}/verticals/${testState.verticalAId}`, { headers: vertAdminHeaders });
      logTestResult('Vertical Admin: Read Authorized Vertical', 'PASSED', `Successfully read vertical: ${res.data.data.name}`);
    } catch (err) {
      logTestResult('Vertical Admin: Read Authorized Vertical', 'FAILED', err.message);
    }

    // 4b. Read vertical B (Should fail with 403 Forbidden)
    try {
      await axios.get(`${API_URL}/verticals/${testState.verticalBId}`, { headers: vertAdminHeaders });
      logTestResult('Vertical Admin: Read Unauthorized Vertical', 'FAILED', 'Succeeded to read Vertical B but was expected to fail.');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        logTestResult('Vertical Admin: Read Unauthorized Vertical', 'PASSED', 'Correctly returned 403 Forbidden.');
      } else {
        logTestResult('Vertical Admin: Read Unauthorized Vertical', 'FAILED', `Expected 403 but got: ${err.message}`);
      }
    }

    // 4c. Create Field Config in Vertical A (Should pass)
    try {
      const res = await axios.post(`${API_URL}/configs/verticals/${testState.verticalAId}/fields`, {
        fieldKey: 'vehicle_model',
        label: 'Vehicle model',
        fieldType: 'text',
        isRequired: true,
        isCsvMapped: true,
        displayOrder: 1
      }, { headers: vertAdminHeaders });
      testState.fieldAId = res.data.data.id;
      logTestResult('Vertical Admin: Manage Configs in Authorized Vertical', 'PASSED', `Created config field: ${res.data.data.label}`);
    } catch (err) {
      logTestResult('Vertical Admin: Manage Configs in Authorized Vertical', 'FAILED', err.message);
    }

    // 4d. Create Field Config in Vertical B (Should fail with 403 Forbidden)
    try {
      await axios.post(`${API_URL}/configs/verticals/${testState.verticalBId}/fields`, {
        fieldKey: 'patient_age',
        label: 'Patient age',
        fieldType: 'number',
        isRequired: true,
        isCsvMapped: true,
        displayOrder: 1
      }, { headers: vertAdminHeaders });
      logTestResult('Vertical Admin: Manage Configs in Unauthorized Vertical', 'FAILED', 'Succeeded to write config but was expected to fail.');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        logTestResult('Vertical Admin: Manage Configs in Unauthorized Vertical', 'PASSED', 'Correctly blocked config creation with 403 Forbidden.');
      } else {
        logTestResult('Vertical Admin: Manage Configs in Unauthorized Vertical', 'FAILED', `Expected 403 but got: ${err.message}`);
      }
    }

    // 4e. Manage Sub-Verticals in Vertical B (Should fail with 403 Forbidden)
    try {
      await axios.post(`${API_URL}/verticals/${testState.verticalBId}/sub-verticals`, {
        name: 'Private Clinics'
      }, { headers: vertAdminHeaders });
      logTestResult('Vertical Admin: Manage Sub-Verticals in Unauthorized Vertical', 'FAILED', 'Succeeded to write sub-vertical but was expected to fail.');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        logTestResult('Vertical Admin: Manage Sub-Verticals in Unauthorized Vertical', 'PASSED', 'Correctly blocked sub-vertical creation with 403 Forbidden.');
      } else {
        logTestResult('Vertical Admin: Manage Sub-Verticals in Unauthorized Vertical', 'FAILED', `Expected 403 but got: ${err.message}`);
      }
    }

    // -------------------------------------------------------------
    // 5. TESTING COST/CONVERSIONS OPERATIONS & VERTICAL SECURITY BOUNDS
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Cost/Conversion Scopes ---');

    // 5a. Create cost conversion in Vertical A (Should succeed)
    try {
      const res = await axios.post(`${API_URL}/cost-conversions`, {
        name: 'Lead Customer A',
        phone: '+1555010099',
        businessName: 'Toyota Dealership',
        verticalId: testState.verticalAId,
        subVerticalId: testState.subVerticalAId,
        assignedTo: testState.agentId,
        data: { vehicle_model: 'Toyota Camry' }
      }, { headers: vertAdminHeaders });
      testState.costConversionAId = res.data.data.id;
      logTestResult('Vertical Admin: Create Cost/Conversion in Authorized Vertical', 'PASSED', `Created Cost/Conversion ID: ${testState.costConversionAId}`);
    } catch (err) {
      logTestResult('Vertical Admin: Create Cost/Conversion in Authorized Vertical', 'FAILED', err.message);
    }

    // 5b. Create cost conversion in Vertical B (Should fail with 403 Forbidden)
    try {
      await axios.post(`${API_URL}/cost-conversions`, {
        name: 'Patient Test Lead',
        phone: '+4420794609',
        verticalId: testState.verticalBId,
        subVerticalId: testState.subVerticalBId,
        data: {}
      }, { headers: vertAdminHeaders });
      logTestResult('Vertical Admin: Create Cost/Conversion in Unauthorized Vertical', 'FAILED', 'Succeeded to create cost conversion but was expected to fail.');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        logTestResult('Vertical Admin: Create Cost/Conversion in Unauthorized Vertical', 'PASSED', 'Correctly blocked creation with 403 Forbidden.');
      } else {
        logTestResult('Vertical Admin: Create Cost/Conversion in Unauthorized Vertical', 'FAILED', `Expected 403 but got: ${err.message}`);
      }
    }

    // 5c. Agent retrieval check (Should see own cost conversions in Vertical A)
    try {
      const res = await axios.get(`${API_URL}/cost-conversions?verticalId=${testState.verticalAId}`, { headers: agentHeaders });
      const items = res.data.data;
      if (items.length > 0) {
        logTestResult('Agent: Retrieve Assigned Cost/Conversions', 'PASSED', `Retrieved ${items.length} items assigned to agent.`);
      } else {
        logTestResult('Agent: Retrieve Assigned Cost/Conversions', 'FAILED', 'No items retrieved.');
      }
    } catch (err) {
      logTestResult('Agent: Retrieve Assigned Cost/Conversions', 'FAILED', err.message);
    }

    // 5d. Agent vertical boundary check (Should fail to read Vertical B cost conversions)
    try {
      await axios.get(`${API_URL}/cost-conversions?verticalId=${testState.verticalBId}`, { headers: agentHeaders });
      logTestResult('Agent: Read Unauthorized Vertical Cost/Conversions', 'FAILED', 'Succeeded to read but was expected to fail.');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        logTestResult('Agent: Read Unauthorized Vertical Cost/Conversions', 'PASSED', 'Correctly blocked with 403 Forbidden.');
      } else {
        logTestResult('Agent: Read Unauthorized Vertical Cost/Conversions', 'FAILED', `Expected 403 but got: ${err.message}`);
      }
    }

    // -------------------------------------------------------------
    // 5.5 ESCALATION FUNCTIONALITY TESTS
    // -------------------------------------------------------------
    console.log('\n--- 5.5 Testing Pass To / Escalate Feature ---');
    
    // 5.5a. Escalate to Vertical Admin (Should succeed)
    try {
      const res = await axios.post(`${API_URL}/cost-conversions/${testState.costConversionAId}/escalations`, {
        escalatedToId: testState.verticalAdminId,
        reason: 'Client demands discount greater than agent authority limit.'
      }, { headers: agentHeaders });
      testState.escalationId = res.data.data.id;
      logTestResult('Agent: Escalate to Admin', 'PASSED', `Escalated successfully. Escalation ID: ${testState.escalationId}`);
    } catch (err) {
      logTestResult('Agent: Escalate to Admin', 'FAILED', err.message);
    }

    // 5.5b. Escalate to non-admin Agent Bob (Should fail with 400 Bad Request)
    try {
      await axios.post(`${API_URL}/cost-conversions/${testState.costConversionAId}/escalations`, {
        escalatedToId: testState.agentId,
        reason: 'Attempting invalid escalation'
      }, { headers: vertAdminHeaders });
      logTestResult('Admin: Escalate to non-Admin user', 'FAILED', 'Escalation succeeded but was expected to fail.');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        logTestResult('Admin: Escalate to non-Admin user', 'PASSED', 'Correctly rejected escalation with 400 Bad Request.');
      } else {
        logTestResult('Admin: Escalate to non-Admin user', 'FAILED', `Expected 400 but got: ${err.message}`);
      }
    }

    // 5.5c. Fetch escalations for cost conversion
    try {
      const res = await axios.get(`${API_URL}/cost-conversions/${testState.costConversionAId}/escalations`, { headers: vertAdminHeaders });
      if (res.data.data.length > 0) {
        logTestResult('Admin: Fetch Cost/Conversion Escalations', 'PASSED', `Found ${res.data.data.length} escalations.`);
      } else {
        logTestResult('Admin: Fetch Cost/Conversion Escalations', 'FAILED', 'No escalations found.');
      }
    } catch (err) {
      logTestResult('Admin: Fetch Cost/Conversion Escalations', 'FAILED', err.message);
    }

    // 5.5d. Fetch admin escalations inbox
    try {
      const res = await axios.get(`${API_URL}/admin/escalations/inbox?status=OPEN`, { headers: vertAdminHeaders });
      if (res.data.data.length > 0) {
        logTestResult('Admin: Fetch Escalations Inbox', 'PASSED', `Found ${res.data.data.length} pending items in inbox.`);
      } else {
        logTestResult('Admin: Fetch Escalations Inbox', 'FAILED', 'Inbox is empty.');
      }
    } catch (err) {
      logTestResult('Admin: Fetch Escalations Inbox', 'FAILED', err.message);
    }

    // 5.5e. Resolve escalation (Should succeed)
    try {
      const res = await axios.put(`${API_URL}/escalations/${testState.escalationId}/resolve`, {
        resolutionNote: 'Approved 15% custom discount.'
      }, { headers: vertAdminHeaders });
      if (res.data.data.status === 'RESOLVED') {
        logTestResult('Admin: Resolve Escalation', 'PASSED', 'Successfully resolved escalation.');
      } else {
        throw new Error('Status not updated to RESOLVED');
      }
    } catch (err) {
      logTestResult('Admin: Resolve Escalation', 'FAILED', err.message);
    }

    // -------------------------------------------------------------
    // 6. TESTING MONGODB COMPATIBILITY LAYER (_id serialization)
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing MongoDB Compatibility Layer ---');
    try {
      const res = await axios.get(`${API_URL}/verticals/${testState.verticalAId}`, { headers: superAdminHeaders });
      if (res.data.data._id === testState.verticalAId && res.data.data.id === testState.verticalAId) {
        logTestResult('MongoDB Compatibility Layer (_id duplication)', 'PASSED', `Successfully duplicated id ${res.data.data.id} to _id ${res.data.data._id}`);
      } else {
        throw new Error('Response object did not include both id and _id fields matched.');
      }
    } catch (err) {
      logTestResult('MongoDB Compatibility Layer (_id duplication)', 'FAILED', err.message);
    }

    // -------------------------------------------------------------
    // 7. AUDIT LOGS CHECKING
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Audit Logs ---');
    try {
      const res = await axios.get(`${API_URL}/audit-logs`, { headers: superAdminHeaders });
      const logs = res.data.data;
      if (logs.length > 0) {
        logTestResult('Audit Logs Retrieval', 'PASSED', `Retrieved ${logs.length} audit entries, proving audit logs are active.`);
      } else {
        logTestResult('Audit Logs Retrieval', 'FAILED', 'No audit logs found.');
      }
    } catch (err) {
      logTestResult('Audit Logs Retrieval', 'FAILED', err.message);
    }

    console.log('\n🏆 ALL INTEGRATION TESTS RUN SUCCESSFULLY!');

  } catch (globalError) {
    console.error('\n💥 Integration test crashed globally:', globalError.message);
  } finally {
    writeAuditFile();
    // Self-cleanup: remove test-created verticals and their cost/conversions so DB stays pristine
    await cleanupTestData();
  }
}

async function cleanupTestData() {
  try {
    console.log('\n🧹 Post-test cleanup: removing test data...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, superAdminCredentials);
    if (!loginRes.data.success) return;
    const token = loginRes.data.data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    // Cleanup test verticals (A and B from the state)
    const testVertIds = [testState.verticalAId, testState.verticalBId].filter(Boolean);
    for (const vid of testVertIds) {
      try {
        // First delete all cost conversions in this vertical
        const ccRes = await axios.get(`${API_URL}/cost-conversions?verticalId=${vid}&limit=1000`, { headers });
        const ccs = ccRes.data.data || [];
        for (const cc of ccs) {
          const ccId = cc._id || cc.id;
          await axios.delete(`${API_URL}/cost-conversions/${ccId}`, { headers }).catch(() => {});
        }
        await axios.delete(`${API_URL}/verticals/${vid}`, { headers });
        console.log('  ✅ Cleaned up test vertical:', vid);
      } catch (e) {
        console.log('  ⚠️ Could not clean vertical', vid + ':', e.response?.data?.error || e.message);
      }
    }

    // Cleanup test users (vertical admin and agent created during test)
    const testUserIds = [testState.verticalAdminId, testState.agentId].filter(Boolean);
    for (const uid of testUserIds) {
      try {
        await axios.delete(`${API_URL}/users/${uid}`, { headers });
        console.log('  ✅ Cleaned up test user:', uid);
      } catch (e) {
        // Users may not have a DELETE endpoint - that's fine
        console.log('  ℹ️ User cleanup skipped for', uid, '(may not support DELETE)');
      }
    }

    console.log('✅ Post-test cleanup complete.');
  } catch (e) {
    console.log('⚠️ Post-test cleanup error (non-fatal):', e.message);
  }
}

function writeAuditFile() {
  console.log(`Writing test audit file to: ${auditReportPath}`);
  
  let md = `# System Advanced Test Audit Report\n\n`;
  md += `**Date**: ${new Date().toLocaleString()}\n`;
  md += `**Target Server**: ${API_URL}\n\n`;
  
  md += `## Summary of Test Results\n\n`;
  md += `| Test Scenario | Status | Details |\n`;
  md += `| :--- | :--- | :--- |\n`;
  
  testState.report.forEach(t => {
    md += `| ${t.name} | **${t.status}** | ${t.details || ''} |\n`;
  });
  
  md += `\n---\n`;
  
  const allPassed = testState.report.every(t => t.status === 'PASSED');
  if (allPassed && testState.report.length > 0) {
    md += `### Final Verdict: 🏆 SYSTEM SECURE & HEALTHY\n`;
  } else {
    md += `### Final Verdict: ⚠️ DEGRADED STATE / CORE SECURITY FAILURES DETECTED\n`;
  }

  fs.writeFileSync(auditReportPath, md);
  console.log('✅ Audit report written.');
}

runTests();
