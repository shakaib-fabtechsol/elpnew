<?php

namespace App\Http\Requests\Employees;

use App\Models\EmployeeAsset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Issuing an asset, or correcting its details. Returning and disposing are
 * their own actions on the controller, since each is one date and a status.
 *
 * An asset number names one physical item, so it cannot be Assigned to two
 * people at once; once it comes back it may be issued again.
 */
class EmployeeAssetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('permission', $this->isMethod('post') ? 'employeeAssets.create' : 'employeeAssets.edit');
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'type' => [$required, Rule::in(EmployeeAsset::TYPES)],
            'assetNumber' => [$required, 'string', 'max:40'],
            'makeModel' => ['nullable', 'string', 'max:120'],
            'serialNumber' => ['nullable', 'string', 'max:80'],
            'issueDate' => [$required, 'date_format:Y-m-d', 'before_or_equal:today'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return ['issueDate.before_or_equal' => 'The issue date cannot be in the future.'];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            $number = $this->input('assetNumber');
            if (! is_string($number) || $validator->errors()->has('assetNumber')) {
                return;
            }
            $current = $this->route('asset');
            // Only an item still out blocks the number; editing a returned row does not.
            if ($current instanceof EmployeeAsset && $current->status !== EmployeeAsset::ASSIGNED) {
                return;
            }
            if ($holder = EmployeeAsset::heldElsewhere($number, $current?->id)) {
                $validator->errors()->add('assetNumber', 'Asset '.$holder->asset_number.' is already assigned to '.($holder->employee?->name ?? 'another employee').'. Record its return first.');
            }
        }];
    }
}
