<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Employees\CommissionRequest;
use App\Models\Commission;
use App\Models\Employee;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Commissions are agreed by the firm, so only management files one. */
class CommissionController extends MoneyRequestController
{
    protected string $model = Commission::class;

    protected string $form = CommissionRequest::class;

    protected array $searchColumns = ['client_name', 'case_file_no', 'invoice_no', 'type'];

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('manage');

        return parent::store($request);
    }

    protected function prepare(array $data, Employee $employee, ?Model $existing): array
    {
        if ($data['type'] !== Commission::INVOICE_LINKED) {
            $data['invoice_no'] = null;
        }

        return $data;
    }

    protected function numberColumn(): string
    {
        return 'commission_no';
    }
}
