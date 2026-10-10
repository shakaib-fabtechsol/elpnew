<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\Employees\BonusRequest;
use App\Models\Bonus;
use App\Models\Employee;
use Illuminate\Database\Eloquent\Model;

class BonusController extends MoneyRequestController
{
    protected string $model = Bonus::class;

    protected string $form = BonusRequest::class;

    protected string $dateColumn = 'recorded_on';

    protected array $searchColumns = ['bonus_subcategory', 'bonus_type', 'notes'];

    protected function prepare(array $data, Employee $employee, ?Model $existing): array
    {
        if ($data['bonus_subcategory'] !== Bonus::OTHER) {
            $data['bonus_type'] = null;
        }

        return [...$data, 'recorded_on' => $existing?->recorded_on?->format('Y-m-d') ?? now()->format('Y-m-d')];
    }
}
