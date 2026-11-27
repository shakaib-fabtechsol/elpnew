<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Employees\SalaryAdvanceRequest;
use App\Models\Employee;
use App\Models\SalaryAdvance;
use App\Services\Eligibility;
use App\Services\Requests\RequestCatalog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class SalaryAdvanceController extends MoneyRequestController
{
    protected string $model = SalaryAdvance::class;

    protected string $form = SalaryAdvanceRequest::class;

    protected string $dateColumn = 'requested_on';

    protected array $searchColumns = ['purpose', 'reason'];

    protected array $files = [];

    protected function prepare(array $data, Employee $employee, ?Model $existing): array
    {
        $data['requested_on'] = $existing?->requested_on?->format('Y-m-d') ?? now()->format('Y-m-d');
        // No purpose given (the Add Request sheet does not ask for one): the
        // column is NOT NULL, so it is read from the remarks where they name
        // one ("school fees" is Education Expenses) and is otherwise the
        // list's own "Other", with nothing specified. An edit keeps the
        // purpose the request already has.
        if (blank($data['purpose'] ?? null)) {
            $data['purpose'] = $existing?->purpose ?? RequestCatalog::purposeFrom((string) ($data['reason'] ?? '')) ?? SalaryAdvance::OTHER_PURPOSE;
        }
        if ($data['purpose'] !== SalaryAdvance::OTHER_PURPOSE) {
            $data['purpose_other'] = null;
        }

        return $data;
    }

    protected function guard(array $data, Employee $employee, ?Model $existing): void
    {
        // Comes back out of one month's pay: it cannot be a month gone by...
        $month = array_search($data['deduct_month'], SalaryAdvance::MONTHS, true);
        if ((int) now()->format('Y') * 12 + (int) now()->format('n') - 1 > $data['deduct_year'] * 12 + $month) {
            throw ValidationException::withMessages(['deductMonth' => 'The deduction month cannot be in the past.']);
        }

        // ...and cannot be more than that pay leaves.
        $limit = Eligibility::advanceLimit($employee);
        if ((float) $data['amount'] > $limit) {
            throw ValidationException::withMessages([
                'amount' => 'The most you can request is '.number_format($limit, 3).' OMR (net salary less advances still to be deducted).',
            ]);
        }
    }
}
