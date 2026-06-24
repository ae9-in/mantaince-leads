# System Advanced Test Audit Report

**Date**: 6/24/2026, 4:25:13 PM
**Target Server**: http://localhost:5000/api/v1

## Summary of Test Results

| Test Scenario | Status | Details |
| :--- | :--- | :--- |
| Super Admin Authentication | **PASSED** | Successfully logged in and acquired token. |
| Super Admin Profile Retrieval | **PASSED** | Retrieved: Super Administrator (super_admin) |
| Vertical Creation (Super Admin) | **PASSED** | Created Vertical A (ID: 9042a5fa-49fa-47b2-8510-2571ef738337) and Vertical B (ID: b7b676e1-0acd-4bbe-a918-df96a721f420). |
| Scoped User Onboarding | **PASSED** | Successfully created scoped Admin and Agent accounts. |
| Sub-Vertical Scoping and Agent Assignment | **PASSED** | Sub-Vertical A (ID: f91a285c-8e2a-4056-9093-bef66021868f) assigned to Agent Bob. |
| Vertical Admin: Read Authorized Vertical | **PASSED** | Successfully read vertical: Automotive USA 1782298498979 |
| Vertical Admin: Read Unauthorized Vertical | **PASSED** | Correctly returned 403 Forbidden. |
| Vertical Admin: Manage Configs in Authorized Vertical | **PASSED** | Created config field: Vehicle model |
| Vertical Admin: Manage Configs in Unauthorized Vertical | **PASSED** | Correctly blocked config creation with 403 Forbidden. |
| Vertical Admin: Manage Sub-Verticals in Unauthorized Vertical | **PASSED** | Correctly blocked sub-vertical creation with 403 Forbidden. |
| Vertical Admin: Create Cost/Conversion in Authorized Vertical | **PASSED** | Created Cost/Conversion ID: ed741fe5-526f-4282-8062-d2a7b1665a19 |
| Vertical Admin: Create Cost/Conversion in Unauthorized Vertical | **PASSED** | Correctly blocked creation with 403 Forbidden. |
| Agent: Retrieve Assigned Cost/Conversions | **PASSED** | Retrieved 1 items assigned to agent. |
| Agent: Read Unauthorized Vertical Cost/Conversions | **PASSED** | Correctly blocked with 403 Forbidden. |
| Agent: Escalate to Admin | **PASSED** | Escalated successfully. Escalation ID: 34e72a66-769d-49ee-a870-51b6d179cd24 |
| Admin: Escalate to non-Admin user | **PASSED** | Correctly rejected escalation with 400 Bad Request. |
| Admin: Fetch Cost/Conversion Escalations | **PASSED** | Found 1 escalations. |
| Admin: Fetch Escalations Inbox | **PASSED** | Found 1 pending items in inbox. |
| Admin: Resolve Escalation | **PASSED** | Successfully resolved escalation. |
| MongoDB Compatibility Layer (_id duplication) | **PASSED** | Successfully duplicated id 9042a5fa-49fa-47b2-8510-2571ef738337 to _id 9042a5fa-49fa-47b2-8510-2571ef738337 |
| Audit Logs Retrieval | **PASSED** | Retrieved 25 audit entries, proving audit logs are active. |

---
### Final Verdict: 🏆 SYSTEM SECURE & HEALTHY
