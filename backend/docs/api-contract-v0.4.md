# DocuMind API Contract v0.4

Status: Final review / defense baseline  
Effective date: 2026-08-26  
Scope: Web, mobile, NestJS backend, PostgreSQL/Prisma, Cloudflare R2, Firebase Authentication, Gemini and SePay  
Executable reference: `GET /api/docs`

This document is the project-wide integration contract. Source code is the executable source of truth; this version supersedes v0.3 for new development. The spreadsheet edition is `docs/Documind_API_Contract_v0.4.xlsx`; the companion workbook `docs/Documind_v0.4_flows_business_rules.xlsx` maps the same APIs to user flows and business rules.

## 1. Global conventions

| Item           | Contract                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| Base URL       | `<BACKEND_ORIGIN>/api`                                                                                             |
| Swagger        | `/api/docs`, version `0.4`                                                                                         |
| Naming         | JSON fields use `camelCase`; IDs are UUID unless stated otherwise                                                  |
| Time           | ISO-8601 UTC                                                                                                       |
| Authentication | `Authorization: Bearer <firebaseIdToken>`; browser clients may also use the secure session cookie created by login |
| Authorization  | Role/status is loaded from PostgreSQL; `BLOCKED` and `INACTIVE` accounts are rejected                              |
| Validation     | Unknown fields are rejected; DTO conversion and validation are global                                              |
| Pagination     | `page >= 1`, default `1`; `limit` default `20`, maximum `100`; deterministic order                                 |
| Request trace  | Client may send `x-request-id`; backend returns the effective ID in the header and error body                      |
| Upload         | `multipart/form-data`; documents: PDF/DOCX/PPTX/XLSX, normally <= 10 MB                                            |
| Storage        | R2 keys, bucket names, credentials and internal stack traces are never returned                                    |

### Success response

Normal JSON responses are wrapped by the global interceptor:

```json
{ "success": true, "data": {}, "timestamp": "2026-08-26T00:00:00.000Z" }
```

Canonical paginated services return `{ items, meta }`, producing:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 0,
    "totalPages": 0,
    "hasNext": false,
    "hasPrevious": false
  },
  "timestamp": "2026-08-26T00:00:00.000Z"
}
```

`204` has no body. SSE chat endpoints use `text/event-stream` and are not JSON envelopes. Avatar/binary and redirect endpoints return their declared media/redirect response. The SePay IPN explicitly returns `{"success":true}` to the gateway.

### Error response and statuses

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "title", "message": "title must not be empty" }]
  },
  "timestamp": "2026-08-26T00:00:00.000Z",
  "path": "/api/documents",
  "requestId": "uuid"
}
```

| Status          | Rule                                                           |
| --------------- | -------------------------------------------------------------- |
| 200/201/202/204 | read-update / created / async accepted / successful no-content |
| 400             | invalid input or transition                                    |
| 401             | missing, expired or invalid identity/webhook credential        |
| 403             | blocked/inactive, wrong role, or forbidden resource            |
| 404             | absent or deliberately hidden resource                         |
| 409             | state conflict, duplicate or content not ready                 |
| 413/415/422     | too large / unsupported type / unprocessable file              |
| 429             | rate, AI credit, upload credit or capacity limit               |
| 500/503         | unexpected failure / dependency not ready                      |

## 2. Endpoint inventory

Auth labels: **Public**, **Optional**, **User**, **Admin**, **SePay**. All paths below include `/api`.

### Authentication and profile

| Method and path              | Auth            | Request                | Success                | Principal rules                                                      |
| ---------------------------- | --------------- | ---------------------- | ---------------------- | -------------------------------------------------------------------- |
| `POST /auth/firebase-login`  | Firebase bearer | header                 | 200 user/session       | Verify token, upsert/load PostgreSQL user, set secure session cookie |
| `POST /auth/register`        | Firebase bearer | registration profile   | 200 user               | Firebase owns credentials; backend stores profile/terms only         |
| `POST /auth/forgot-password` | Public          | `{email}`              | 204                    | Uniform result to prevent account enumeration                        |
| `GET /auth/me`               | User            | —                      | 200 current user       | Database role/status is authoritative                                |
| `POST /auth/logout`          | Public          | —                      | 204                    | Clears backend session cookie; client also signs out Firebase        |
| `GET /users/profile`         | User            | —                      | 200 profile            | Only current profile                                                 |
| `PATCH /users/profile`       | User            | allowed profile fields | 200 profile            | Whitelist fields; email identity remains Firebase-controlled         |
| `POST /users/avatar`         | User            | multipart `file`       | 201 avatar metadata    | Image validation; replaces current avatar                            |
| `GET /users/:userId/avatar`  | Public          | UUID                   | 200 binary or redirect | Cacheable public representation; never exposes R2 key                |

### Personal taxonomy

Subjects and categories are user-scoped; equal names owned by different users do not conflict.

| Method and path                                      | Auth   | Request/result         | Principal rules                                               |
| ---------------------------------------------------- | ------ | ---------------------- | ------------------------------------------------------------- |
| `GET /subjects`, `GET /subjects/:id`                 | User   | list/detail            | Only the current user's taxonomy                              |
| `POST /subjects`                                     | User   | name/code              | Unique within owner scope                                     |
| `PATCH /subjects/:id`                                | User   | editable fields        | Owner only                                                    |
| `DELETE /subjects/:id`                               | User   | 200/204                | Reject when referential/business constraints prevent deletion |
| `GET /categories?subjectId=` / `GET /categories/:id` | User   | list/detail            | Owner scope; optional subject filter                          |
| `POST /categories`                                   | User   | name, subject relation | Referenced subject must belong to user                        |
| `PATCH /categories/:id`, `DELETE /categories/:id`    | User   | update/delete          | Owner only; preserve referential integrity                    |
| `GET /tags`, `GET /tags/:id`                         | Public | global tags            | Readable for document forms                                   |
| `POST /tags`, `PATCH /tags/:id`, `DELETE /tags/:id`  | Admin  | tag fields             | Global tag catalog is admin-managed                           |

### Documents, storage and extraction

`DocumentDto` includes id, title, description, fileName, normalized fileType, fileSize as a decimal string, subject, category, tags, `aiStatus`, nullable summary, visibility, status, saved, owned, owner and timestamps. Internal `storagePath` is forbidden in client responses.

| Method and path                                      | Auth                  | Request/result                                                                 | Principal rules                                                                                               |
| ---------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `POST /documents` (alias `/documents/upload`)        | User                  | multipart file, title, description?, subjectId, categoryId, visibility?, tags? | Validate quota/type/size; write private R2 object and DB metadata; create PENDING content; enqueue extraction |
| `GET /documents`                                     | User                  | filters/pagination -> library                                                  | User sees owned plus saved accessible documents; admin scope may be broader                                   |
| `GET /documents/:id`                                 | User                  | detail                                                                         | Owner, saved/public-accessible user, or admin only                                                            |
| `PUT /documents/:id`                                 | User                  | metadata                                                                       | Owner only; taxonomy must belong to owner                                                                     |
| `PUT /documents/:id/visibility`                      | User                  | `{visibility}`                                                                 | Owner only; PUBLIC always enters moderation PENDING; PRIVATE removes community exposure                       |
| `DELETE /documents/:id`                              | User                  | — -> 204                                                                       | Owner only; database deletion and best-effort object cleanup                                                  |
| `GET /documents/:id/download`, `/download-url`       | User                  | signed URL                                                                     | Check access, short expiry; download path records counter/log                                                 |
| `GET /documents/:id/preview`, `/preview-url`         | User                  | signed URL                                                                     | Check access; Office formats may use converted preview                                                        |
| `POST /documents/:id/extract`                        | User                  | — -> 202                                                                       | Owner/access check; prevent overlapping jobs; retry policy applies                                            |
| `GET /documents/:id/content`                         | User                  | extracted payload                                                              | Access check; return 409 while content is not ready                                                           |
| `GET /documents/:id/extraction-status`               | User                  | status/progress/job/error                                                      | Polling contract: PENDING, PROCESSING, COMPLETED or FAILED                                                    |
| `POST /storage/upload-url`                           | User                  | key/file metadata                                                              | Compatibility presigned flow; key is constrained to current user's namespace                                  |
| `POST /storage/download-url`, `/storage/preview-url` | User                  | `{key}`                                                                        | Reject keys outside current user's namespace                                                                  |
| `DELETE /storage/object`                             | User                  | `{key}`                                                                        | Namespace ownership required                                                                                  |
| `POST /content-extraction/test`                      | Environment/test-only | multipart file                                                                 | Diagnostic extraction; must not be exposed in public production routing                                       |

Extraction pipeline: download from R2, select extractor, optionally OCR, persist text/quality/provenance, chunk and embed, then update status. Failed jobs retain safe error metadata and bounded retry count. PUBLIC uploads are never auto-approved by the scanner.

### Community and saved documents

| Method and path                        | Auth     | Request/result   | Principal rules                                           |
| -------------------------------------- | -------- | ---------------- | --------------------------------------------------------- |
| `GET /community/documents`             | Optional | query/pagination | Only `PUBLIC + APPROVED + ACTIVE` documents               |
| `GET /community/documents/:id`         | Optional | detail           | Same publication predicate; saved flag when authenticated |
| `GET /community/documents/:id/preview` | User     | signed URL       | Publication predicate and authenticated access            |
| `POST /community/documents/:id/save`   | User     | saved relation   | Idempotent; cannot save inaccessible/unapproved document  |
| `DELETE /community/documents/:id/save` | User     | — -> 204         | Idempotent removal scoped to current user                 |
| `GET /saved-documents`                 | User     | paginated list   | Current user's accessible saved documents only            |

### AI chat and history

| Method and path                  | Auth | Request/result                   | Principal rules                                                                       |
| -------------------------------- | ---- | -------------------------------- | ------------------------------------------------------------------------------------- |
| `POST /chat/ask-document`        | User | question, documentId, sessionId? | Document access and completed extraction required; consume AI credit unless unlimited |
| `POST /chat/ask-library`         | User | question, filters/sessionId?     | Retrieval is restricted to the user's accessible library                              |
| `POST /chat/ask-document/stream` | User | same as above -> SSE             | Events: `status`, `sources`, repeated `delta`, terminal/error                         |
| `POST /chat/ask-library/stream`  | User | same as above -> SSE             | Same authorization, quota and persistence as non-stream call                          |
| `GET /chat/sessions`             | User | pagination/filter                | Current user's sessions only                                                          |
| `GET /chat/sessions/:id`         | User | session detail                   | Owner only                                                                            |
| `GET /chat/messages/:sessionId`  | User | pagination                       | Session owner only; stable chronological ordering                                     |

Answers must be grounded in returned source chunks. Source traceability includes document/chunk identity. The service records delivery status; failed generation must not be represented as a successful complete answer.

### Subscription, payment and entitlements

`GET /subscription/plans` and `GET /subscription/current` are retained compatibility aliases. The authoritative implementation for current entitlements is the payments module routes listed first below.

| Method and path                        | Auth   | Request/result            | Principal rules                                                                      |
| -------------------------------------- | ------ | ------------------------- | ------------------------------------------------------------------------------------ |
| `GET /subscription/plans`              | Public | bundle snapshots          | Plans are additive resource bundles, not mutually exclusive permanent tiers          |
| `GET /subscription/current`            | User   | wallet/expiry             | Compute remaining storage, upload and AI credits; free baseline resumes after expiry |
| `POST /payments/checkout`              | User   | plan, method, return URLs | Snapshot price and entitlements into immutable order; sign SePay fields server-side  |
| `GET /payments/history`                | User   | orders                    | Only current user's orders; expired pending orders are normalized                    |
| `GET /payments/:invoiceNumber`         | User   | order                     | Owner only; pending status may be reconciled with gateway                            |
| `POST /payments/:invoiceNumber/status` | User   | FAILED/CANCELLED          | A PAID order cannot be changed by client                                             |
| `POST /payments/sepay/ipn`             | SePay  | provider payload          | Verify API key, invoice, amount and approval; idempotently apply entitlement once    |

Entitlements are cumulative. A paid order extends time from `max(now, currentExpiry)`, adds storage/upload/AI credits, records an `EntitlementTransaction`, and creates an audit trail in one database transaction. Redirect success alone never grants resources. Refund/reversal targets the originating transaction and must not erase unrelated purchases.

### Notifications

| Method and path                 | Auth | Request/result       | Principal rules                                  |
| ------------------------------- | ---- | -------------------- | ------------------------------------------------ |
| `GET /notifications?limit=`     | User | latest notifications | Current user only; bounded limit                 |
| `PATCH /notifications/read-all` | User | —                    | Changes current user's unread notifications only |
| `PATCH /notifications/:id/read` | User | notification         | Ownership required; idempotent                   |

### Administration, moderation, reports and logs

Every endpoint in this section requires Firebase authentication plus PostgreSQL role `ADMIN`.

| Method and path                              | Purpose and principal rules                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET /admin/users`                           | Paginated/filterable users; do not leak credentials/tokens                                       |
| `PATCH /admin/users/:id/status`              | ACTIVE/BLOCKED/INACTIVE transition; audit actor and target                                       |
| `GET /admin/documents`                       | PUBLIC moderation inventory; filters for status, extraction, moderation, flag, owner and keyword |
| `GET /admin/documents/:id/preview`           | Preview PUBLIC document before decision                                                          |
| `PUT /admin/documents/:id/approve`           | Set APPROVED + ACTIVE, reviewer/time; audit and notify owner                                     |
| `PUT /admin/documents/:id/reject`            | Nonblank reason required; set REJECTED + HIDDEN; audit and notify owner                          |
| `PUT /admin/documents/:id/hide`              | Operational hide/unhide with optional reason; audit decision                                     |
| `GET /admin/dashboard/summary`               | Aggregate headline metrics                                                                       |
| `GET /admin/dashboard/user-stats`            | User aggregates                                                                                  |
| `GET /admin/dashboard/document-stats`        | Document aggregates                                                                              |
| `GET /admin/dashboard/statistics`            | Combined dashboard series                                                                        |
| `GET /admin/dashboard/documents-by-subject`  | Subject breakdown with query range/filter                                                        |
| `GET /admin/dashboard/documents-by-category` | Category breakdown with query range/filter                                                       |
| `GET /admin/dashboard/upload-statistics`     | Upload time series                                                                               |
| `GET /admin/dashboard/chatbot-stats`         | Chat usage/delivery aggregates                                                                   |
| `GET /admin/reports/upload-statistics`       | Report-ready upload statistics                                                                   |
| `GET /admin/reports/most-downloaded`         | Ranked downloads with deterministic tie-break                                                    |
| `GET /admin/reports/most-saved`              | Ranked saves with deterministic tie-break                                                        |
| `GET /admin/logs/downloads`                  | Paginated download audit data                                                                    |
| `GET /admin/logs/audit`                      | Paginated actor/action/resource audit data                                                       |

Moderation's publication invariant is enforced by backend queries, not UI visibility: only `PUBLIC + APPROVED + ACTIVE` may reach Community. Scanner flags rank risk but never replace an admin decision.

### Operations

| Method and path                   | Auth   | Contract                                                          |
| --------------------------------- | ------ | ----------------------------------------------------------------- |
| `GET /health`, `GET /health/live` | Public | Process liveness; 200 when running                                |
| `GET /health/ready`               | Public | Dependency readiness; 503 when required dependency is unavailable |

## 3. Cross-flow state rules

| Domain                | States and allowed behavior                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| User                  | ACTIVE can use protected APIs; BLOCKED/INACTIVE receives 403 after identity verification                                            |
| Extraction            | PENDING -> PROCESSING -> COMPLETED; failures -> FAILED; retry returns to PROCESSING subject to retry/concurrency limits             |
| Visibility/moderation | PRIVATE is never community-visible; PUBLIC -> PENDING -> APPROVED or REJECTED; APPROVED must also be ACTIVE                         |
| Payment               | PENDING -> PAID/FAILED/CANCELLED/EXPIRED; PAID application is idempotent and client-immutable                                       |
| Chat                  | Retrieval must pass document access first; generation consumes entitlement atomically and persists delivery outcome                 |
| Save                  | Unique `(userId, documentId)`; create/delete are idempotent; losing publication/access hides the saved document from usable results |

## 4. Client integration requirements

- Web and mobile obtain/refresh Firebase identity and attach it to protected calls.
- Clients read business payload from `response.data`; paginated metadata is top-level `meta`.
- Clients must branch on HTTP status and stable `error.code`, not localized `message` text.
- Upload UI polls extraction status after `202/201`; it must not assume extracted content is immediately available.
- Payment UI grants no local entitlement on return URL; it polls the backend-owned order/current entitlement state.
- SSE clients reconnect deliberately and must not double-submit a question after a terminal event.
- Admin UI cannot be the only permission layer; backend guards and publication predicates remain mandatory.

## 5. Known compatibility notes for v0.4

- Document upload supports both `POST /documents` and legacy `POST /documents/upload`; new clients use `/documents`.
- Preview/download URL aliases remain for existing clients.
- Subscription routes exist in both payments and legacy subscription modules. New behavior must be changed in the payments service and contract-tested to keep aliases consistent.
- Some older admin implementations return `{data, meta}` instead of canonical `{items, meta}`. Consumers should use the current observed payload until the backend normalizes it; this is a documented migration item, not a new client convention.
- v0.4 changes documentation/Swagger contract version; it does not change the public base path to `/api/v0.4`.

## 6. Definition of done for API changes

An endpoint change is complete only when controller/DTO/service, Swagger, automated tests, web/mobile client typing, this contract and the flow workbook agree. Breaking field/path/status changes require a new contract version or an explicitly documented compatibility alias.
