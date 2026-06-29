# System Advanced Test Audit Report

**Date**: 6/29/2026, 2:44:06 PM
**Target Server**: http://localhost:5000/api/v1

## Summary of Test Results

| Test Scenario | Status | Details |
| :--- | :--- | :--- |
| Super Admin Authentication | **PASSED** | Successfully logged in and acquired token. |
| Super Admin Profile Retrieval | **PASSED** | Retrieved: Super Administrator (super_admin) |
| Vertical Creation (Super Admin) | **PASSED** | Created Vertical A (ID: 1275bd69-7411-48d7-9541-3738f2eb9562) and Vertical B (ID: 1d0109df-8478-4e27-b232-aa34cbc0f4f2). |
| Scoped User Onboarding | **PASSED** | Successfully created scoped Admin and Agent accounts. |
| Sub-Vertical Scoping and Agent Assignment | **PASSED** | Sub-Vertical A (ID: 28daa830-13ae-4875-a749-f57461264c7f) assigned to Agent Bob. |
| Vertical Admin: Read Authorized Vertical | **PASSED** | Successfully read vertical: Automotive USA 1782724441076 |
| Vertical Admin: Read Unauthorized Vertical | **PASSED** | Correctly returned 403 Forbidden. |
| Vertical Admin: Manage Configs in Authorized Vertical | **PASSED** | Created config field: Vehicle model |
| Vertical Admin: Manage Configs in Unauthorized Vertical | **PASSED** | Correctly blocked config creation with 403 Forbidden. |
| Vertical Admin: Manage Sub-Verticals in Unauthorized Vertical | **PASSED** | Correctly blocked sub-vertical creation with 403 Forbidden. |
| Vertical Admin: Create Cost/Conversion in Authorized Vertical | **PASSED** | Created Cost/Conversion ID: 362f7219-8538-4c29-9d0d-b9b5db6ed294 |
| Vertical Admin: Create Cost/Conversion in Unauthorized Vertical | **PASSED** | Correctly blocked creation with 403 Forbidden. |
| Agent: Retrieve Assigned Cost/Conversions | **PASSED** | Retrieved 1 items assigned to agent. |
| Agent: Read Unauthorized Vertical Cost/Conversions | **PASSED** | Correctly blocked with 403 Forbidden. |
| Agent: Escalate to Admin | **PASSED** | Escalated successfully. Escalation ID: 71bd416a-8c82-4ad2-9c5d-9899bedeafaa |
| Admin: Escalate to non-Admin user | **PASSED** | Correctly rejected escalation with 400 Bad Request. |
| Admin: Fetch Cost/Conversion Escalations | **PASSED** | Found 1 escalations. |
| Admin: Fetch Escalations Inbox | **PASSED** | Found 1 pending items in inbox. |
| Admin: Resolve Escalation | **PASSED** | Successfully resolved escalation. |
| MongoDB Compatibility Layer (_id duplication) | **PASSED** | Successfully duplicated id 1275bd69-7411-48d7-9541-3738f2eb9562 to _id 1275bd69-7411-48d7-9541-3738f2eb9562 |
| Audit Logs Retrieval | **PASSED** | Retrieved 25 audit entries, proving audit logs are active. |

---
### Final Verdict: 🏆 SYSTEM SECURE & HEALTHY
