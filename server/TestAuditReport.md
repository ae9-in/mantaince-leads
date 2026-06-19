# System Advanced Test Audit Report

**Date**: 6/19/2026, 2:52:47 PM
**Target Server**: http://localhost:5000/api/v1

## Summary of Test Results

| Test Scenario | Status | Details |
| :--- | :--- | :--- |
| Super Admin Authentication | **PASSED** | Successfully logged in and acquired token. |
| Super Admin Profile Retrieval | **PASSED** | Retrieved: Super Administrator (super_admin) |
| Vertical Creation (Super Admin) | **PASSED** | Created Vertical A (ID: 71258d34-8da6-4720-a4f5-670c65bec1af) and Vertical B (ID: 8788a43a-4fcd-46c5-8da0-8cd2dca71ca7). |
| Sub-Vertical Creation | **PASSED** | Created Sub-Vertical A (ID: 3564e10d-c6f4-4b2e-a346-987ded64ecd6) and Sub-Vertical B (ID: 3dd1ba25-299f-422a-96f2-33ec519b090e). |
| User Invitations and Vertical Access Assignment | **PASSED** | Created Vertical Admin (vert_admin_1781860961291@leadsbase.io) and Agent (agent_1781860961291@leadsbase.io) scoped to Vertical A. |
| Vertical Admin Login | **PASSED** | Acquired token. |
| Agent Login | **PASSED** | Acquired token. |
| Vertical Admin: Read Authorized Vertical | **PASSED** | Successfully read Vertical A data: Automotive USA 1781860957606 |
| Vertical Admin: Read Unauthorized Vertical | **PASSED** | Correctly returned 403 Forbidden. |
| Vertical Admin: Manage Configs in Authorized Vertical | **PASSED** | Created config field: Vehicle model |
| Vertical Admin: Manage Configs in Unauthorized Vertical | **PASSED** | Correctly blocked config creation with 403 Forbidden. |
| Vertical Admin: Manage Sub-Verticals in Unauthorized Vertical | **PASSED** | Correctly blocked sub-vertical creation with 403 Forbidden. |
| Vertical Admin: Create Lead in Authorized Vertical | **PASSED** | Created Lead ID: 358ce86a-dfe1-4d1a-ab76-97930364d731 |
| Vertical Admin: Create Lead in Unauthorized Vertical | **PASSED** | Correctly blocked lead creation with 403 Forbidden. |
| Agent: Retrieve Assigned Leads | **PASSED** | Retrieved 1 leads assigned to agent. |
| Agent: Read Unauthorized Vertical Leads | **PASSED** | Correctly blocked with 403 Forbidden. |
| MongoDB Compatibility Layer (_id duplication) | **PASSED** | Successfully duplicated id 71258d34-8da6-4720-a4f5-670c65bec1af to _id 71258d34-8da6-4720-a4f5-670c65bec1af |
| Audit Logs Retrieval | **PASSED** | Retrieved 25 audit entries, proving audit logs are active. |

---
### Final Verdict: 🏆 SYSTEM SECURE & HEALTHY
