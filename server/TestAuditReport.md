# System Advanced Test Audit Report

**Date**: 6/11/2026, 10:38:03 AM
**Target Server**: http://localhost:5000/api/v1

## Summary of Test Results

| Test Scenario | Status | Details |
| :--- | :--- | :--- |
| Super Admin Authentication | **PASSED** | Successfully logged in and acquired token. |
| Super Admin Profile Retrieval | **PASSED** | Retrieved: Super Admin (super_admin) |
| Vertical Creation (Super Admin) | **PASSED** | Created Vertical A (ID: 3c5c1392-1f9c-49df-86f2-935982792070) and Vertical B (ID: 06d8d721-eee7-40ca-8061-ae0f06236752). |
| Sub-Vertical Creation | **PASSED** | Created Sub-Vertical A (ID: ddad1ab3-6974-49b2-8264-288decb8dc55) and Sub-Vertical B (ID: 5814b93b-0035-4aa0-bb1a-aff7d61c6632). |
| User Invitations and Vertical Access Assignment | **PASSED** | Created Vertical Admin (vert_admin_1781154477193@leadsbase.io) and Agent (agent_1781154477193@leadsbase.io) scoped to Vertical A. |
| Vertical Admin Login | **PASSED** | Acquired token. |
| Agent Login | **PASSED** | Acquired token. |
| Vertical Admin: Read Authorized Vertical | **PASSED** | Successfully read Vertical A data: Automotive USA 1781154473813 |
| Vertical Admin: Read Unauthorized Vertical | **PASSED** | Correctly returned 403 Forbidden. |
| Vertical Admin: Manage Configs in Authorized Vertical | **PASSED** | Created config field: Vehicle model |
| Vertical Admin: Manage Configs in Unauthorized Vertical | **PASSED** | Correctly blocked config creation with 403 Forbidden. |
| Vertical Admin: Manage Sub-Verticals in Unauthorized Vertical | **PASSED** | Correctly blocked sub-vertical creation with 403 Forbidden. |
| Vertical Admin: Create Lead in Authorized Vertical | **PASSED** | Created Lead ID: 13019243-e46e-46f6-be0d-206268cff6cf |
| Vertical Admin: Create Lead in Unauthorized Vertical | **PASSED** | Correctly blocked lead creation with 403 Forbidden. |
| Agent: Retrieve Assigned Leads | **PASSED** | Retrieved 1 leads assigned to agent. |
| Agent: Read Unauthorized Vertical Leads | **PASSED** | Correctly blocked with 403 Forbidden. |
| MongoDB Compatibility Layer (_id duplication) | **PASSED** | Successfully duplicated id 3c5c1392-1f9c-49df-86f2-935982792070 to _id 3c5c1392-1f9c-49df-86f2-935982792070 |
| Audit Logs Retrieval | **PASSED** | Retrieved 11 audit entries, proving audit logs are active. |

---
### Final Verdict: 🏆 SYSTEM SECURE & HEALTHY
