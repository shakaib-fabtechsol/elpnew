# SADEED API (Laravel 13)

The back end for the SADEED React app in the parent folder. JSON over
`/api/v1`, Sanctum token sign-in, keys in **camelCase** - the same names the
React app already uses (`requestNo`, `approvedAmount`, `deductMonth`...).

## Run it

```bash
cd backend
composer install
cp .env.example .env        # SQLite by default; set DB_* for MySQL
php artisan key:generate
php artisan migrate --seed  # tables + the app's demo data
php artisan serve           # http://localhost:8000
php artisan test            # 51 feature tests
```

`CORS_ALLOWED_ORIGINS` in `.env` lists the React app's address
(default `http://localhost:5173`, the Vite dev server).

### Demo sign-ins (password: `password`)

| Email | Role | Employee |
|---|---|---|
| admin@sadeed.om | admin - decides, manages | EMP-0001 Mohammed Al Yahyaei |
| accounts@sadeed.om | accounting - pays | EMP-0013 Nadia Al Siyabi |
| aisha@sadeed.om | lawyer - own requests | EMP-0007 Aisha Al Kindi (a request at every stage) |
| ahmed@sadeed.om | lawyer | EMP-0003 Ahmed Al Balushi |

```http
POST /api/v1/auth/login   { "email": "aisha@sadeed.om", "password": "password" }
→ { "data": { "token": "1|...", "user": { ... } } }

then on every call:  Authorization: Bearer 1|...   Accept: application/json
```

## Who can do what

| | admin | accounting | lawyer / execution |
|---|---|---|---|
| See records | everyone's | everyone's | own only (others → 404) |
| Submit requests | for anyone | own | own |
| Management Decision | ✔ | | |
| Financial Department Actions (pay) | ✔ | ✔ | |
| Add / edit employees, violations, circulars | ✔ | | |

## The SADEED workflow

Salary advances, loans, assistance, bonuses, commissions and all
entitlements (allowances, overtime, leave encashment, notice pay, end of
service) share one engine (`App\Services\RequestWorkflow`):

```
Pending ──decision──► Approved ──payment──► Paid
   │  full | partial        (Financial Department Actions)
   ├─ return ─► Returned ──resubmit (PUT)──► Pending
   └─ reject ─► Rejected        withdraw (DELETE) ─► Cancelled
```

Rules enforced on the server: partial must be > 0 and < requested; return
and reject need a comment; only Pending can be decided; only Approved can be
paid; a transfer needs account + reference and no future date. Every move is
written to the request's history.

Stored statuses are `Pending | Returned | Approved | Paid | Rejected | Cancelled`;
each record also carries `statusLabel` - the module's own wording
("Partially Approved", "Awaiting Payment", "Disbursed", "Active"...).

## Endpoints

### Auth & lists
| | |
|---|---|
| `POST auth/login` · `GET auth/me` · `POST auth/logout` | |
| `GET lookups` | every dropdown list (purposes, leave types, penalties...) |

### Employees
| | |
|---|---|
| `GET/POST employees` · `GET/PATCH/DELETE employees/{id}` | `?search=&status=&department=&branch=` |
| `GET employees/next-number` | EMP-0026 for the Add header |
| `GET employees/{id}/requests-overview` | counts by status for every request type + eligibility |
| `GET employees/{id}/leave-balance?type=&year=` | |
| `GET/POST employees/{id}/documents` · `GET …/documents/{doc}/download` · `DELETE …` | versions & expiry status worked out |
| `GET/POST employees/{id}/corrections` · `POST corrections/{id}/decision` | approval updates the record |

### Requests on the workflow
`salary-advances` · `loans` · `assistance-requests` · `bonuses` · `commissions` · `entitlements`

| | |
|---|---|
| `GET {type}` | `?employeeId=&status=Pending,Returned&search=&year=&perPage=` (+ `?kind=medical` on entitlements) |
| `POST {type}` | submit (multipart when it carries a file) |
| `GET {type}/{id}` | with history |
| `PUT/POST {type}/{id}` | correct a Pending one / resubmit a Returned one |
| `DELETE {type}/{id}` | withdraw |
| `POST {type}/{id}/decision` | `{ decision: full|partial|return|reject, approvedAmount, comment }` |
| `POST {type}/{id}/payment` | `{ paymentMethod, paymentDate, bankAccount, paymentReference, financeComment }` |
| `GET {type}/{id}/history` | |
| `POST loans/{id}/installments` | record a repayment or deferral |
| `POST invoices/analyze` | `file` + `kind` → invoice reading + risk checks |

Worked out on the server, never trusted from the client: overtime and
encashment amounts, invoice claim = total − insurance, loan schedule
(month-end rule, short last installment), limits (advance ≤ net salary −
owed advances; loan ≤ 10 × net − owed; assistance ≤ 2 × net a year), one
open loan / assistance request at a time.

### Invoice AI
`App\Services\Invoices\InvoiceReader` is the one piece that becomes real AI.
`DemoInvoiceReader` stands in (same samples as the app; a file named `dup…`
reads as a duplicate). The checks in `InvoiceRiskChecker` already run for
real: duplicate invoice number (anyone), same medication claimed before,
VAT that is not 0 % or 5 %, invoice older than 90 days, unknown supplier
(registered automatically with its VAT number on submit).

### Leave · violations · general requests · salaries · circulars
| | |
|---|---|
| `GET/POST leaves` · `PUT/DELETE leaves/{id}` | balance, overlap and advance-leave rules |
| `POST leaves/{id}/department-decision` → `POST leaves/{id}/decision` | two stages |
| `POST violations` · `…/{id}/acknowledge` · `/response` · `/decision` · `/appeal` · `/outcome` | numbered VIO-xxx only when a penalty is issued |
| `GET/POST general-requests` (`kind=general|grievance|complaint`) · `POST …/{id}/decision` | |
| `GET/POST salaries` · `POST salaries/{id}/transfer` · `/reject` | loan installment and advance due that month deducted automatically |
| `GET/POST circulars` (`?pending=1`) · `/{id}/revise` · `/cancel` · `/acknowledge` · `GET circulars-audit` | |

Errors are standard Laravel JSON: `422 { message, errors: { field: [..] } }`
(field names in camelCase, ready to show under the input), `401`, `403`, `404`.
