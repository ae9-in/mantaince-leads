# System Advanced Test Audit Report

**Date**: 6/20/2026, 10:15:49 AM
**Target Server**: http://localhost:5000/api/v1

## Summary of Test Results

| Test Scenario | Status | Details |
| :--- | :--- | :--- |
| Super Admin Authentication | **PASSED** | Successfully logged in and acquired token. |
| Super Admin Profile Retrieval | **PASSED** | Retrieved: Super Administrator (super_admin) |
| Vertical Creation (Super Admin) | **PASSED** | Created Vertical A (ID: 8c344da4-5e66-492c-aae6-adebc7026b7f) and Vertical B (ID: 671f21d1-4161-494b-865e-c9b1c94bcb78). |
| Sub-Vertical Creation | **PASSED** | Created Sub-Vertical A (ID: e6bdaeb6-107c-4c99-8c6e-5b81ac54bee8) and Sub-Vertical B (ID: ce597ce7-193a-4303-881e-c3ee5a7e739e). |
| User Invitations and Vertical Access Assignment | **PASSED** | Created Vertical Admin (vert_admin_1781930745633@leadsbase.io) and Agent (agent_1781930745633@leadsbase.io) scoped to Vertical A. |
| Vertical Admin Login | **PASSED** | Acquired token. |
| Agent Login | **PASSED** | Acquired token. |
| Vertical Admin: Read Authorized Vertical | **PASSED** | Successfully read Vertical A data: Automotive USA 1781930742744 |
| Vertical Admin: Read Unauthorized Vertical | **PASSED** | Correctly returned 403 Forbidden. |
| Vertical Admin: Manage Configs in Authorized Vertical | **PASSED** | Created config field: Vehicle model |
| Vertical Admin: Manage Configs in Unauthorized Vertical | **PASSED** | Correctly blocked config creation with 403 Forbidden. |
| Vertical Admin: Manage Sub-Verticals in Unauthorized Vertical | **PASSED** | Correctly blocked sub-vertical creation with 403 Forbidden. |
| Vertical Admin: Create Lead in Authorized Vertical | **PASSED** | Created Lead ID: 0b654a81-5fe3-4c70-bea9-754bc957ed94 |
| Vertical Admin: Create Lead in Unauthorized Vertical | **PASSED** | Correctly blocked lead creation with 403 Forbidden. |
| Agent: Retrieve Assigned Leads | **PASSED** | Retrieved 1 leads assigned to agent. |
| Agent: Read Unauthorized Vertical Leads | **PASSED** | Correctly blocked with 403 Forbidden. |
| MongoDB Compatibility Layer (_id duplication) | **PASSED** | Successfully duplicated id 8c344da4-5e66-492c-aae6-adebc7026b7f to _id 8c344da4-5e66-492c-aae6-adebc7026b7f |
| Audit Logs Retrieval | **PASSED** | Retrieved 25 audit entries, proving audit logs are active. |

---
### Final Verdict: 🏆 SYSTEM SECURE & HEALTHY
