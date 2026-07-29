# THIEN-07 Completion Evidence

Evidence date: 2026-06-17

## Scope

THIEN-07 implements admin report/statistics endpoints for:

- Upload statistics grouped by day, week, or month.
- Most-downloaded documents from `DownloadLog` aggregation.
- Most-saved documents from `SavedDocument` aggregation.

## Endpoints

| Endpoint                                   | Purpose                                                    |
| ------------------------------------------ | ---------------------------------------------------------- |
| `GET /api/admin/reports/upload-statistics` | Upload series by `groupBy=day`, `week`, or `month`         |
| `GET /api/admin/reports/most-downloaded`   | Most downloaded documents by optional date range and limit |
| `GET /api/admin/reports/most-saved`        | Most saved documents by optional date range and limit      |

All endpoints require Firebase authentication and `ADMIN` role.

## Automated Evidence

| Command                                      | Result                     |
| -------------------------------------------- | -------------------------- |
| `npm test -- reports dashboard download-log` | Passed: 6 suites, 39 tests |
| `npm run test:e2e -- reports admin-security` | Passed: 2 suites, 17 tests |
| `npm run lint`                               | Passed                     |
| `npm run build`                              | Passed                     |

## Coverage Notes

| Area              | Evidence                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload statistics | `reports.e2e-spec.ts` verifies `/api/admin/reports/upload-statistics`; `ReportsService` delegates to `DashboardService.getUploadStatistics()`. |
| Most downloaded   | `reports.e2e-spec.ts` verifies `/api/admin/reports/most-downloaded`; `ReportsService` delegates to `DownloadLogService.getMostDownloaded()`.   |
| Most saved        | `reports.service.spec.ts` verifies grouping by `SavedDocument.documentId`, missing-document filtering, and empty states.                       |
| Admin permission  | `admin-security.e2e-spec.ts` verifies all report endpoints require a Firebase bearer token.                                                    |
