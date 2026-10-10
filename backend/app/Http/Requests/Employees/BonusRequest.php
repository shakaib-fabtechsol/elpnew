<?php

namespace App\Http\Requests\Employees;

use App\Http\Requests\ApiRequest;
use App\Models\Bonus;
use Illuminate\Validation\Rule;

class BonusRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'employeeId' => ['nullable', 'integer'],
            'bonusSubcategory' => ['required', Rule::in(Bonus::SUBCATEGORIES)],
            'bonusType' => ['nullable', 'string', 'max:120', 'required_if:bonusSubcategory,'.Bonus::OTHER],
            'amount' => ['required', 'numeric', 'gt:0'],
            'notes' => ['required', 'string', 'max:500'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ];
    }

    public function messages(): array
    {
        return [
            'bonusType.required_if' => 'Say what the bonus is for.',
            'notes.required' => 'Enter the reason for this bonus request.',
        ];
    }
}
