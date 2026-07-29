# THIEN-09 Test Evidence

Evidence date: 2026-06-17

## Scope

THIEN-09 verifies dashboard and log QA coverage for:

- Count accuracy for dashboard summary, user stats, document stats, combined
  statistics, upload statistics, and most-downloaded aggregation.
- Missing data and empty states for dashboard statistics, upload series, audit
  logs, and download logs.
- Admin permission enforcement for dashboard, report, and log routes.
- Subscription/payment mock route behavior.
- Download log creation through the real document download endpoint.

## Automated Evidence

| Command                                                                                                 | Result                       |
| ------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `npm test -- auth users admin documents audit-log download-log reports dashboard subscription payments` | Passed: 18 suites, 105 tests |
| `npm run test:e2e -- dashboard audit-log download-log reports admin-security documents-download`        | Passed: 6 suites, 33 tests   |
| `npm run test:e2e -- subscription-payments`                                                             | Passed: 1 suite, 5 tests     |
| `npm run lint`                                                                                          | Passed                       |
| `npm run build`                                                                                         | Passed                       |

## Coverage Notes

| Area                  | Evidence                                                                                                                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Counts accuracy       | Unit and E2E tests assert exact totals for dashboard summary, user role/status counts, document status/visibility counts, subject/category distributions, upload statistics, most-downloaded documents, and most-saved documents.                    |
| Missing data          | Unit tests assert stable dashboard response shapes when role, status, document, subject, category, and upload data are absent.                                                                                                                       |
| Empty states          | E2E tests assert empty `data` arrays and pagination metadata for audit logs and download logs, and empty dashboard statistics/upload series.                                                                                                         |
| Admin permission      | `admin-security.e2e-spec.ts` verifies unauthenticated requests return `401` for dashboard summary, user stats, document stats, combined statistics, subject/category distributions, upload statistics, report routes, audit logs, and download logs. |
| Download log creation | `documents-download.e2e-spec.ts` verifies `GET /api/documents/:id/download` creates a `DownloadLog` after authorization; `download-log.service.spec.ts` verifies direct service behavior.                                                            |
| Subscription mocks    | `subscription-payments.e2e-spec.ts` verifies public plan listing, protected current subscription, protected payment history, and missing-token `401` responses.                                                                                      |

## Dependency Status

After merging `origin/main`, `GET /api/documents/:id/download` is available in
`DocumentsController` and returns the generated URL payload with `200 OK`.
End-to-end download log creation is covered by
`test/documents-download.e2e-spec.ts`.
