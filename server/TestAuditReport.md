# System Advanced Test Audit Report

**Date**: 6/13/2026, 12:07:21 PM
**Target Server**: http://localhost:5000/api/v1

## Summary of Test Results

| Test Scenario | Status | Details |
| :--- | :--- | :--- |
| Super Admin Authentication | **PASSED** | Successfully logged in and acquired token. |
| Super Admin Profile Retrieval | **PASSED** | Retrieved: Super Admin (super_admin) |
| Vertical Creation (Super Admin) | **PASSED** | Created Vertical A (ID: fe2109e7-aeb9-48e5-99c5-9f81b93a820a) and Vertical B (ID: 457badac-6489-4396-8fdb-3ceace7715c6). |
| Sub-Vertical Creation | **PASSED** | Created Sub-Vertical A (ID: 3ec75a90-b458-42d9-91f2-aca13b12ab4f) and Sub-Vertical B (ID: d4b1d0f1-ad23-4641-a20c-47dab4c6833d). |
| User Invitations and Vertical Access Assignment | **PASSED** | Created Vertical Admin (vert_admin_1781332633744@leadsbase.io) and Agent (agent_1781332633744@leadsbase.io) scoped to Vertical A. |
| Vertical Admin Login | **PASSED** | Acquired token. |
| Agent Login | **PASSED** | Acquired token. |
| Vertical Admin: Read Authorized Vertical | **PASSED** | Successfully read Vertical A data: Automotive USA 1781332629438 |
| Vertical Admin: Read Unauthorized Vertical | **PASSED** | Correctly returned 403 Forbidden. |
| Vertical Admin: Manage Configs in Authorized Vertical | **PASSED** | Created config field: Vehicle model |
| Vertical Admin: Manage Configs in Unauthorized Vertical | **PASSED** | Correctly blocked config creation with 403 Forbidden. |
| Vertical Admin: Manage Sub-Verticals in Unauthorized Vertical | **PASSED** | Correctly blocked sub-vertical creation with 403 Forbidden. |
| Vertical Admin: Create Lead in Authorized Vertical | **PASSED** | Created Lead ID: f0f05b69-cdf4-4746-8026-da3538a2e844 |
| Vertical Admin: Create Lead in Unauthorized Vertical | **PASSED** | Correctly blocked lead creation with 403 Forbidden. |
| Agent: Retrieve Assigned Leads | **PASSED** | Retrieved 1 leads assigned to agent. |
| Agent: Read Unauthorized Vertical Leads | **PASSED** | Correctly blocked with 403 Forbidden. |
| MongoDB Compatibility Layer (_id duplication) | **PASSED** | Successfully duplicated id fe2109e7-aeb9-48e5-99c5-9f81b93a820a to _id fe2109e7-aeb9-48e5-99c5-9f81b93a820a |
| Audit Logs Retrieval | **PASSED** | Retrieved 25 audit entries, proving audit logs are active. |

---
### Final Verdict: 🏆 SYSTEM SECURE & HEALTHY
