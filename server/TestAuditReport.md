# System Advanced Test Audit Report

**Date**: 6/24/2026, 5:33:03 PM
**Target Server**: http://localhost:5000/api/v1

## Summary of Test Results

| Test Scenario | Status | Details |
| :--- | :--- | :--- |
| Super Admin Authentication | **PASSED** | Successfully logged in and acquired token. |
| Super Admin Profile Retrieval | **PASSED** | Retrieved: Super Administrator (super_admin) |
| Vertical Creation (Super Admin) | **PASSED** | Created Vertical A (ID: 331fbed0-db4b-405b-a40e-e1a47c1c8214) and Vertical B (ID: 89131e77-a042-4d38-8d21-1da4b77a58fd). |
| Scoped User Onboarding | **PASSED** | Successfully created scoped Admin and Agent accounts. |
| Sub-Vertical Scoping and Agent Assignment | **PASSED** | Sub-Vertical A (ID: 57fd1c8d-0686-46a7-8705-160d1dab0462) assigned to Agent Bob. |
| Vertical Admin: Read Authorized Vertical | **PASSED** | Successfully read vertical: Automotive USA 1782302577901 |
| Vertical Admin: Read Unauthorized Vertical | **PASSED** | Correctly returned 403 Forbidden. |
| Vertical Admin: Manage Configs in Authorized Vertical | **PASSED** | Created config field: Vehicle model |
| Vertical Admin: Manage Configs in Unauthorized Vertical | **PASSED** | Correctly blocked config creation with 403 Forbidden. |
| Vertical Admin: Manage Sub-Verticals in Unauthorized Vertical | **PASSED** | Correctly blocked sub-vertical creation with 403 Forbidden. |
| Vertical Admin: Create Cost/Conversion in Authorized Vertical | **PASSED** | Created Cost/Conversion ID: 91d57a67-a2e9-4b7e-bd80-2e15aa44381c |
| Vertical Admin: Create Cost/Conversion in Unauthorized Vertical | **PASSED** | Correctly blocked creation with 403 Forbidden. |
| Agent: Retrieve Assigned Cost/Conversions | **PASSED** | Retrieved 1 items assigned to agent. |
| Agent: Read Unauthorized Vertical Cost/Conversions | **PASSED** | Correctly blocked with 403 Forbidden. |
| Agent: Escalate to Admin | **PASSED** | Escalated successfully. Escalation ID: edc5131e-0154-4607-80ed-f6d80dbb132a |
| Admin: Escalate to non-Admin user | **PASSED** | Correctly rejected escalation with 400 Bad Request. |
| Admin: Fetch Cost/Conversion Escalations | **PASSED** | Found 1 escalations. |
| Admin: Fetch Escalations Inbox | **PASSED** | Found 1 pending items in inbox. |
| Admin: Resolve Escalation | **PASSED** | Successfully resolved escalation. |
| MongoDB Compatibility Layer (_id duplication) | **PASSED** | Successfully duplicated id 331fbed0-db4b-405b-a40e-e1a47c1c8214 to _id 331fbed0-db4b-405b-a40e-e1a47c1c8214 |
| Audit Logs Retrieval | **PASSED** | Retrieved 25 audit entries, proving audit logs are active. |

---
### Final Verdict: 🏆 SYSTEM SECURE & HEALTHY
