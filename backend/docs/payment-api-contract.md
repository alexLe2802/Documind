# Payment API Contract

Updated: 2026-06-24

## Conventions

- Base path: `/api`
- Protected user endpoints require `Authorization: Bearer <Firebase ID token>`.
- SePay webhook endpoint requires `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>`.
- Protected endpoint success responses are wrapped by the global API envelope:

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-06-24T10:00:00.000Z"
}
```

- Error responses are wrapped by the global error envelope:

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "This subscription plan is already active"
  },
  "timestamp": "2026-06-24T10:00:00.000Z",
  "path": "/api/payments/checkout",
  "requestId": "7f2d5d9a-54c4-44fd-9f5c-9d090cf1b6ad"
}
```

## Business Rules

- `FREE` is not checkoutable.
- Users cannot manually switch to `FREE`; the system switches them to `FREE` only when their paid subscription expires or an active paid order is refunded.
- If a user is already on the requested active paid plan, checkout returns `409`.
- Display prices remain `STUDENT = 149000 VND` and `PRO = 349000 VND`.
- Test checkout command amounts are sent to SePay as `STUDENT = 5000 VND` and `PRO = 10000 VND`.
- If a user is on active `STUDENT` and upgrades to `PRO`, checkout amount is only the remaining test checkout difference: `10000 - 5000 = 5000 VND`.
- A `STUDENT -> PRO` differential upgrade keeps the current subscription expiry date.
- If a user is on active `PRO`, `STUDENT` checkout is rejected with `409`.
- Pending checkout sessions expire after 2 minutes.
- If a user repeats checkout for the same pending plan within 2 minutes, the existing checkout session is returned.
- Frontend success redirects do not directly activate subscriptions. Activation is done by SePay IPN/webhook, with gateway reconciliation as a fallback when the frontend polls payment status.

## Endpoints

### GET `/subscription/plans`

Lists available plans.

Auth: Bearer token

Success `200` data:

```json
[
  {
    "code": "STUDENT",
    "name": "Student",
    "amount": 149000,
    "currency": "VND",
    "billingPeriod": "MONTHLY"
  }
]
```

Responses:

| Code | Meaning                         |
| ---- | ------------------------------- |
| 200  | Plans returned                  |
| 401  | Missing or invalid bearer token |

### GET `/subscription/current`

Returns the current subscription. If the paid plan is expired, the backend restores `FREE` before returning the response.

Auth: Bearer token

Success `200` data:

```json
{
  "plan": "STUDENT",
  "startsAt": "2026-06-24T10:00:00.000Z",
  "expiresAt": "2026-07-24T10:00:00.000Z",
  "storageLimitMb": 1024,
  "uploadLimit": 100,
  "aiChatLimit": 300,
  "aiChatsUsed": 0
}
```

Responses:

| Code | Meaning                         |
| ---- | ------------------------------- |
| 200  | Current subscription returned   |
| 401  | Missing or invalid bearer token |

### POST `/payments/checkout`

Creates or resumes a signed SePay checkout session.

Auth: Bearer token

Request:

```json
{
  "plan": "PRO",
  "paymentMethod": "BANK_TRANSFER"
}
```

Success `200` data:

```json
{
  "invoiceNumber": "DM1782231415188EDCBF63C",
  "checkoutUrl": "https://pay.sepay.vn/checkout",
  "expiresAt": "2026-06-24T10:02:00.000Z",
  "fields": {
    "merchant": "SP-LIVE-...",
    "operation": "PURCHASE",
    "payment_method": "BANK_TRANSFER",
    "order_invoice_number": "DM1782231415188EDCBF63C",
    "order_amount": 10000,
    "currency": "VND",
    "signature": "..."
  }
}
```

For a `STUDENT -> PRO` upgrade while the Student plan is active, `order_amount` is `5000`.

Responses:

| Code | Meaning                                                        |
| ---- | -------------------------------------------------------------- |
| 200  | Checkout initialized or existing pending checkout returned     |
| 400  | Invalid plan/payment method or attempt to checkout `FREE`      |
| 401  | Missing or invalid bearer token                                |
| 409  | Requested plan already active or paid-plan downgrade attempted |
| 503  | SePay is not configured                                        |

### GET `/payments/history`

Returns the latest 20 payment orders for the current user. Expired pending orders are marked `EXPIRED` before returning.

Auth: Bearer token

Success `200` data:

```json
[
  {
    "invoiceNumber": "DM1782231415188EDCBF63C",
    "plan": "PRO",
    "paymentMethod": "BANK_TRANSFER",
    "amount": 5000,
    "currency": "VND",
    "status": "PENDING",
    "paidAt": null,
    "expiresAt": "2026-06-24T10:02:00.000Z",
    "createdAt": "2026-06-24T10:00:00.000Z"
  }
]
```

Responses:

| Code | Meaning                         |
| ---- | ------------------------------- |
| 200  | History returned                |
| 401  | Missing or invalid bearer token |

### GET `/payments/{invoiceNumber}`

Returns one payment order. If the order is pending, the backend attempts gateway reconciliation against SePay; if SePay reports `CAPTURED`, the order is marked `PAID` and the subscription is activated before returning.

Auth: Bearer token

Responses:

| Code | Meaning                                             |
| ---- | --------------------------------------------------- |
| 200  | Payment order returned                              |
| 400  | SePay reconciliation returned mismatched order data |
| 401  | Missing or invalid bearer token                     |
| 404  | Order not found or belongs to another user          |

### POST `/payments/{invoiceNumber}/status`

Records a cancelled or failed checkout redirect.

Auth: Bearer token

Request:

```json
{
  "status": "CANCELLED"
}
```

Responses:

| Code | Meaning                                    |
| ---- | ------------------------------------------ |
| 200  | Payment order status updated               |
| 400  | Status is not `FAILED` or `CANCELLED`      |
| 401  | Missing or invalid bearer token            |
| 404  | Order not found or belongs to another user |
| 409  | Paid payment cannot be changed             |

### POST `/payments/sepay/ipn`

Receives SePay Payment Gateway IPNs and standard bank transfer webhooks.

Auth: `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>`

Success `200` body:

```json
{
  "success": true
}
```

Responses:

| Code | Meaning                                         |
| ---- | ----------------------------------------------- |
| 200  | Webhook acknowledged                            |
| 400  | Unsupported payload or payment detail mismatch  |
| 401  | Missing or invalid webhook API key              |
| 403  | SePay notification is not approved              |
| 404  | Referenced payment order not found              |
| 409  | Transaction already processed for another order |
