<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Employees\AssistanceRequestForm;
use App\Models\AssistanceRequest;
use App\Models\Employee;
use App\Services\Eligibility;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class AssistanceRequestController extends MoneyRequestController
{
    protected string $model = AssistanceRequest::class;

    protected string $form = AssistanceRequestForm::class;

    protected string $dateColumn = 'request_date';

    protected array $searchColumns = ['assistance_type', 'purpose', 'notes'];

    protected array $files = ['proof'];

    protected function prepare(array $data, Employee $employee, ?Model $existing): array
    {
        return [
            ...$data,
            'beneficiary' => $data['beneficiary'] ?? 'Employee (Self)',
            'request_date' => $existing?->request_date?->format('Y-m-d') ?? now()->format('Y-m-d'),
        ];
    }

    protected function guard(array $data, Employee $employee, ?Model $existing): void
    {
        $summary = Eligibility::assistanceSummary($employee);

        if (! $existing && ! $summary['canRequest']) {
            throw ValidationException::withMessages([
                'amount' => 'A new request cannot be made while '.$summary['openRequest'].' is still waiting.',
            ]);
        }

        // What this request already counts for is freed up when it is corrected.
        $available = $summary['remaining'] + ($existing ? $existing->requestedAmount() : 0);
        if ((float) $data['amount'] > $available) {
            throw ValidationException::withMessages([
                'amount' => 'The most that can be requested this year is '.number_format($available, 3).' OMR.',
            ]);
        }
    }
}
