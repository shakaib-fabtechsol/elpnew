<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FirmBankAccount;
use App\Support\Keys;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * The firm's bank accounts. Everyone signed in can read them (payment forms
 * offer the active ones); only management adds or changes one. An account is
 * never deleted - payments already made name it - it is made inactive.
 */
class FirmBankAccountController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => FirmBankAccount::orderBy('id')->get()->map(fn ($a) => $this->shape($a))]);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('manage');
        $account = FirmBankAccount::create([
            ...$this->validated($request, null),
            'opened_at' => $request->input('openedAt') ?: now()->format('Y-m-d'),
            'active' => $request->boolean('active', true),
        ]);

        return response()->json(['data' => $this->shape($account->refresh())], 201);
    }

    public function update(Request $request, FirmBankAccount $bankAccount): JsonResponse
    {
        Gate::authorize('manage');
        $bankAccount->update($this->validated($request, $bankAccount));

        return response()->json(['data' => $this->shape($bankAccount->refresh())]);
    }

    private function validated(Request $request, ?FirmBankAccount $existing): array
    {
        // Codes are written in capitals; small letters are the same code.
        foreach (['iban', 'swift'] as $key) {
            if (is_string($request->input($key))) {
                $request->merge([$key => strtoupper(trim($request->input($key)))]);
            }
        }

        $req = $existing ? 'sometimes' : 'required';
        $data = $request->validate([
            'bankName' => [$req, 'string', 'max:80'],
            'logo' => ['nullable', 'string', 'max:255'],
            'bankBranch' => ['nullable', 'string', 'max:80'],
            'branchArea' => ['nullable', 'string', 'max:80'],
            'location' => ['nullable', 'string', 'max:120'],
            'accountName' => [$req, 'string', 'max:120'],
            'accountType' => ['nullable', 'string', 'max:40'],
            'accountNumber' => [$req, 'regex:/^[0-9 ]{6,40}$/', Rule::unique('firm_bank_accounts', 'account_number')->ignore($existing?->id)],
            'iban' => ['nullable', 'regex:/^[A-Z]{2}[0-9A-Z ]{10,32}$/'],
            'swift' => ['nullable', 'regex:/^[A-Z0-9]{8}([A-Z0-9]{3})?$/'],
            'branchId' => ['nullable', 'integer'],
            'openingBalance' => ['nullable', 'numeric', 'min:0'],
            'active' => ['sometimes', 'boolean'],
        ], [
            'accountNumber.regex' => 'Enter a valid account number: digits only, at least 6.',
            'accountNumber.unique' => 'This account number is already on the list.',
            'iban.regex' => 'Enter a valid IBAN: two letters, then 10 to 32 letters or digits.',
            'swift.regex' => 'Enter a valid SWIFT code: 8 or 11 letters or digits.',
        ]);

        return Keys::snake($data);
    }

    private function shape(FirmBankAccount $account): array
    {
        return Keys::camel(collect($account->attributesToArray())->except(['created_at', 'updated_at'])->all());
    }
}
