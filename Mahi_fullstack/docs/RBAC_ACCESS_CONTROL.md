# HireMatrix RBAC Access Control Design

## 1) Role-Wise Explanation

### Applicant
- Responsibility: maintain profile, upload resume, apply for jobs, track own progress.
- Workflow scope: entry point of hiring funnel from application to final decision.
- Real-world behavior: applies to multiple openings and expects transparent status updates.

### Recruiter
- Responsibility: create/manage own jobs, screen incoming applicants, shortlist/reject, schedule interviews.
- Workflow scope: owns early funnel operations for assigned/created requisitions.
- Real-world behavior: handles candidate volume and prepares qualified shortlist.

### HR Manager
- Responsibility: oversee hiring pipeline across teams, ensure process compliance, finalize decisions.
- Workflow scope: cross-functional supervision and final offer/rejection actions.
- Real-world behavior: monitors SLA, fairness, and conversion metrics.

### Hiring Manager
- Responsibility: evaluate shortlisted candidates and provide interview feedback.
- Workflow scope: technical/functional evaluation stage only.
- Real-world behavior: does not own requisition admin, but influences final decision via feedback.

### Admin
- Responsibility: full platform governance: users, system reports, and global controls.
- Workflow scope: full lifecycle visibility and control.
- Real-world behavior: audits operations, handles escalations, and manages access.

## 2) Permission Matrix (CRUD + Conditions)

| Entity | Applicant | Recruiter | HR Manager | Hiring Manager | Admin |
|---|---|---|---|---|---|
| Jobs - Create | No | Yes (own requisitions) | Yes | No | Yes |
| Jobs - Read | Yes (all active jobs) | Yes (own jobs) | Yes (all) | Yes (assigned jobs) | Yes (all) |
| Jobs - Update | No | Yes (own jobs only) | Yes (all) | No | Yes |
| Jobs - Delete | No | Yes (own jobs only) | Yes (all) | No | Yes |
| Applications - Create | Yes (own only) | No | No | No | No |
| Applications - Read | Yes (own only) | Yes (only jobs posted by recruiter) | Yes (all) | Yes (shortlisted/interview-scheduled of assigned jobs) | Yes (all) |
| Applications - Update | No direct (status) | Yes (Shortlisted/Rejected/Interview Scheduled on own jobs) | Yes (Interview Scheduled/Selected/Rejected) | No status update; feedback/comments only | Yes (all statuses) |
| Applications - Delete | Own withdraw only (optional feature) | No | No | No | Yes |
| Users - Create | Self-register only | No | No | No | Yes |
| Users - Read | Self only | Limited directory (HM listing) | Limited org | Self/assigned context | Yes (all) |
| Users - Update | Self profile only | Self profile only | Self profile only | Self profile only | Yes (all) |
| Users - Delete | No | No | No | No | Yes (deactivate preferred) |
| Interviews - Create | No | Yes (for own jobs) | Yes | Yes (assigned jobs) | Yes |
| Interviews - Read | Own only | Own jobs only | All | Assigned jobs only | All |
| Interviews - Update | No | No | Yes | Yes (feedback/result on assigned jobs) | Yes |
| Interviews - Delete | No | No | Controlled (optional) | No | Yes |

## 3) Accessibility Rules

- Ownership-based:
  - Applicant can access only their own applications/interviews.
  - Recruiter can manage only jobs they posted.
- Role + condition-based:
  - Hiring Manager can access only applications/interviews for jobs where they are assigned.
  - HR can access all recruitment entities but not unrestricted system config.
- Workflow-based:
  - Recruiter handles early-stage transitions.
  - HR handles final decision transitions.
  - Hiring Manager contributes evaluation feedback, not final status control.

## 4) Application Workflow Permissions

- Applied -> Shortlisted: Recruiter (own jobs), HR, Admin.
- Applied -> Rejected: Recruiter (own jobs), HR, Admin.
- Shortlisted -> Interview Scheduled: Recruiter (own jobs), HR, Admin.
- Interview Scheduled -> Selected: HR, Admin.
- Interview Scheduled -> Rejected: HR, Admin.

## 5) Authorization Design

- JWT includes: `id`, `role`, `exp`.
- Middleware:
  - `protect` verifies token + active user.
  - `allowRoles(...roles)` checks role-level access.
  - Route-level ownership checks enforce entity conditions.
- API protection examples:
  - `PUT /jobs/:id`: recruiter allowed only if `job.postedBy == req.user.id`.
  - `PATCH /applications/:id/status`: restrict status transitions by role map.
  - `PATCH /interviews/:id`: HM allowed only when assigned to the job.

## 6) Database Design Suggestions

- `User`: role, profile fields, company metadata, applicant resume/skills.
- `Job`: postedBy, assignedHiringManagers[], requirements, deadline.
- `Application`: applicantId, jobId, status, comments[], notes.
- `Interview`: applicationId, interviewerId, scheduledDate, feedback, result.
- Optional extension:
  - `RolePermission` mapping table for dynamic policies.
  - `AuditLog` collection for security-grade traceability.

## 7) UI/UX Role-Based Access

- Separate dashboard sections per role.
- Sidebar navigation generated from role permissions.
- Hidden/disabled actions in UI for disallowed operations.
- Backend remains source of truth (frontend checks are convenience only).

## 8) Real-World Improvements

- Security:
  - Refresh tokens + rotation.
  - Brute-force protection and login throttling.
  - Optional MFA for HR/Admin.
- Scalability:
  - Queue-based emails/notifications.
  - Indexing for status + recruiter + job filters.
- Governance:
  - Audit logs for all status/permission changes.
  - SLA metrics (time-to-shortlist, time-to-hire).
  - Activity timeline on each application.
