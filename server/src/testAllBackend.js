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
  leadAId: '',
  verticalAdminId: '',
  agentId: '',
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

    // Create Sub-Verticals
    try {
      const subARes = await axios.post(`${API_URL}/verticals/${testState.verticalAId}/sub-verticals`, {
        name: 'Used Cars Dealerships'
      }, { headers: superAdminHeaders });
      testState.subVerticalAId = subARes.data.data.id;

      const subBRes = await axios.post(`${API_URL}/verticals/${testState.verticalBId}/sub-verticals`, {
        name: 'Dental Clinics Private'
      }, { headers: superAdminHeaders });
      testState.subVerticalBId = subBRes.data.data.id;

      logTestResult('Sub-Vertical Creation', 'PASSED', `Created Sub-Vertical A (ID: ${testState.subVerticalAId}) and Sub-Vertical B (ID: ${testState.subVerticalBId}).`);
    } catch (err) {
      logTestResult('Sub-Vertical Creation', 'FAILED', err.message);
      throw err;
    }

    // -------------------------------------------------------------
    // 3. USER MANAGEMENT & RBAC SETUP
    // -------------------------------------------------------------
    console.log('\n--- 3. Setting Up Vertical Admin & Agent Users ---');
    const uniqueEmailSuffix = Date.now();
    const vertAdminEmail = `vert_admin_${uniqueEmailSuffix}@leadsbase.io`;
    const agentEmail = `agent_${uniqueEmailSuffix}@leadsbase.io`;

    try {
      // Create Vertical Admin (Assigned access to Vertical A only)
      const inviteAdminRes = await axios.post(`${API_URL}/users/invite`, {
        name: 'John Vertical Admin',
        email: vertAdminEmail,
        role: 'vertical_admin',
        password: 'password123',
        verticalAccess: [testState.verticalAId]
      }, { headers: superAdminHeaders });
      testState.verticalAdminId = inviteAdminRes.data.data.id;

      // Create Agent (Assigned access to Vertical A only)
      const inviteAgentRes = await axios.post(`${API_URL}/users/invite`, {
        name: 'Bob Agent',
        email: agentEmail,
        role: 'agent',
        password: 'password123',
        verticalAccess: [testState.verticalAId]
      }, { headers: superAdminHeaders });
      testState.agentId = inviteAgentRes.data.data.id;

      logTestResult('User Invitations and Vertical Access Assignment', 'PASSED', `Created Vertical Admin (${vertAdminEmail}) and Agent (${agentEmail}) scoped to Vertical A.`);
    } catch (err) {
      logTestResult('User Invitations and Vertical Access Assignment', 'FAILED', err.message);
      throw err;
    }

    // Log in as Vertical Admin
    try {
      const vertAdminLogin = await axios.post(`${API_URL}/auth/login`, {
        email: vertAdminEmail,
        password: 'password123'
      });
      testState.verticalAdminToken = vertAdminLogin.data.data.accessToken;
      logTestResult('Vertical Admin Login', 'PASSED', 'Acquired token.');
    } catch (err) {
      logTestResult('Vertical Admin Login', 'FAILED', err.message);
      throw err;
    }

    // Log in as Agent
    try {
      const agentLogin = await axios.post(`${API_URL}/auth/login`, {
        email: agentEmail,
        password: 'password123'
      });
      testState.agentToken = agentLogin.data.data.accessToken;
      logTestResult('Agent Login', 'PASSED', 'Acquired token.');
    } catch (err) {
      logTestResult('Agent Login', 'FAILED', err.message);
      throw err;
    }

    const vertAdminHeaders = { Authorization: `Bearer ${testState.verticalAdminToken}` };
    const agentHeaders = { Authorization: `Bearer ${testState.agentToken}` };

    // -------------------------------------------------------------
    // 4. TESTING VERTICAL SECURITY BOUNDS (ROUTING & ROW-LEVEL SCOPING)
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Vertical Admin Access Scopes ---');
    
    // 4a. Retrieve Vertical A (Should pass)
    try {
      const res = await axios.get(`${API_URL}/verticals/${testState.verticalAId}`, { headers: vertAdminHeaders });
      logTestResult('Vertical Admin: Read Authorized Vertical', 'PASSED', `Successfully read Vertical A data: ${res.data.data.name}`);
    } catch (err) {
      logTestResult('Vertical Admin: Read Authorized Vertical', 'FAILED', err.message);
    }

    // 4b. Retrieve Vertical B (Should fail with 403 Forbidden)
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
    // 5. TESTING LEADS OPERATIONS & VERTICAL SECURITY BOUNDS
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Leads Scopes ---');

    // 5a. Create lead in Vertical A (Should succeed)
    try {
      const res = await axios.post(`${API_URL}/leads`, {
        name: 'Lead Customer A',
        phone: '+1555010099',
        businessName: 'Toyota Dealership',
        verticalId: testState.verticalAId,
        subVerticalId: testState.subVerticalAId,
        assignedTo: testState.agentId,
        data: { vehicle_model: 'Toyota Camry' }
      }, { headers: vertAdminHeaders });
      testState.leadAId = res.data.data.id;
      logTestResult('Vertical Admin: Create Lead in Authorized Vertical', 'PASSED', `Created Lead ID: ${testState.leadAId}`);
    } catch (err) {
      logTestResult('Vertical Admin: Create Lead in Authorized Vertical', 'FAILED', err.message);
    }

    // 5b. Create lead in Vertical B (Should fail with 403 Forbidden)
    try {
      await axios.post(`${API_URL}/leads`, {
        name: 'Patient Test Lead',
        phone: '+4420794609',
        verticalId: testState.verticalBId,
        subVerticalId: testState.subVerticalBId,
        data: {}
      }, { headers: vertAdminHeaders });
      logTestResult('Vertical Admin: Create Lead in Unauthorized Vertical', 'FAILED', 'Succeeded to create lead but was expected to fail.');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        logTestResult('Vertical Admin: Create Lead in Unauthorized Vertical', 'PASSED', 'Correctly blocked lead creation with 403 Forbidden.');
      } else {
        logTestResult('Vertical Admin: Create Lead in Unauthorized Vertical', 'FAILED', `Expected 403 but got: ${err.message}`);
      }
    }

    // 5c. Agent retrieval check (Should see own leads in Vertical A)
    try {
      const res = await axios.get(`${API_URL}/leads?verticalId=${testState.verticalAId}`, { headers: agentHeaders });
      const leads = res.data.data;
      if (leads.length > 0) {
        logTestResult('Agent: Retrieve Assigned Leads', 'PASSED', `Retrieved ${leads.length} leads assigned to agent.`);
      } else {
        logTestResult('Agent: Retrieve Assigned Leads', 'FAILED', 'No leads retrieved.');
      }
    } catch (err) {
      logTestResult('Agent: Retrieve Assigned Leads', 'FAILED', err.message);
    }

    // 5d. Agent vertical boundary check (Should fail to read Vertical B leads)
    try {
      await axios.get(`${API_URL}/leads?verticalId=${testState.verticalBId}`, { headers: agentHeaders });
      logTestResult('Agent: Read Unauthorized Vertical Leads', 'FAILED', 'Succeeded to read leads but was expected to fail.');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        logTestResult('Agent: Read Unauthorized Vertical Leads', 'PASSED', 'Correctly blocked with 403 Forbidden.');
      } else {
        logTestResult('Agent: Read Unauthorized Vertical Leads', 'FAILED', `Expected 403 but got: ${err.message}`);
      }
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
