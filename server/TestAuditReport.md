# System Advanced Test Audit Report

**Date**: 6/24/2026, 1:53:55 PM
**Target Server**: http://localhost:5000/api/v1

## Summary of Test Results

| Test Scenario | Status | Details |
| :--- | :--- | :--- |
| Super Admin Authentication | **PASSED** | Successfully logged in and acquired token. |
| Super Admin Profile Retrieval | **PASSED** | Retrieved: Super Administrator (super_admin) |
| Vertical Creation (Super Admin) | **PASSED** | Created Vertical A (ID: d6cc84cb-eb27-4cde-8efa-7d2d81aa5ef6) and Vertical B (ID: 537b3d47-5c73-4f3f-8ebe-09a050be9662). |
| Scoped User Onboarding | **PASSED** | Successfully created scoped Admin and Agent accounts. |
| Sub-Vertical Scoping and Agent Assignment | **PASSED** | Sub-Vertical A (ID: 284a1c16-6fb3-48e4-8c31-cdfd9f43286a) assigned to Agent Bob. |
| Vertical Admin: Read Authorized Vertical | **PASSED** | Successfully read vertical: Automotive USA 1782289423697 |
| Vertical Admin: Read Unauthorized Vertical | **PASSED** | Correctly returned 403 Forbidden. |
| Vertical Admin: Manage Configs in Authorized Vertical | **PASSED** | Created config field: Vehicle model |
| Vertical Admin: Manage Configs in Unauthorized Vertical | **PASSED** | Correctly blocked config creation with 403 Forbidden. |
| Vertical Admin: Manage Sub-Verticals in Unauthorized Vertical | **PASSED** | Correctly blocked sub-vertical creation with 403 Forbidden. |
| Vertical Admin: Create Cost/Conversion in Authorized Vertical | **PASSED** | Created Cost/Conversion ID: 030ddb64-3313-4a58-81d7-b0b3684ca3b9 |
| Vertical Admin: Create Cost/Conversion in Unauthorized Vertical | **PASSED** | Correctly blocked creation with 403 Forbidden. |
| Agent: Retrieve Assigned Cost/Conversions | **PASSED** | Retrieved 1 items assigned to agent. |
| Agent: Read Unauthorized Vertical Cost/Conversions | **PASSED** | Correctly blocked with 403 Forbidden. |
| Agent: Escalate to Admin | **PASSED** | Escalated successfully. Escalation ID: 3479fd76-71df-4174-8bdb-f330a0d88f8c |
| Admin: Escalate to non-Admin user | **PASSED** | Correctly rejected escalation with 400 Bad Request. |
| Admin: Fetch Cost/Conversion Escalations | **PASSED** | Found 1 escalations. |
| Admin: Fetch Escalations Inbox | **PASSED** | Found 1 pending items in inbox. |
| Admin: Resolve Escalation | **PASSED** | Successfully resolved escalation. |
| MongoDB Compatibility Layer (_id duplication) | **PASSED** | Successfully duplicated id d6cc84cb-eb27-4cde-8efa-7d2d81aa5ef6 to _id d6cc84cb-eb27-4cde-8efa-7d2d81aa5ef6 |
| Audit Logs Retrieval | **PASSED** | Retrieved 25 audit entries, proving audit logs are active. |

---
### Final Verdict: 🏆 SYSTEM SECURE & HEALTHY
