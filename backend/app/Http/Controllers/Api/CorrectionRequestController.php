<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CorrectionRequest;
use App\Models\Employee;
use App\Support\Keys;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * An employee asks for their record to be corrected; management decides.
 * Approval is what changes the record - never the request itself.
 */
class CorrectionRequestController extends Controller
{
    /** Fields an employee may ask to have corrected (camelCase, as the app names them). */
    private const CORRECTABLE = [
        'employeeName', 'arabicName', 'nationality', 'gender', 'dateOfBirth', 'civilId', 'idExpiry',
        'passportNumber', 'passportExpiry', 'phone', 'personalEmail', 'address', 'emergencyName',
        'emergencyRelationship', 'emergencyPhone', 'bankName', 'accountNumber', 'iban', 'swiftCode',
    ];

    public function index(Request $request, Employee $employee): JsonResponse
    {
        Gate::authorize('view-employee', $employee);
        $rows = CorrectionRequest::where('employee_id', $employee->id)
            ->when($request->string('status')->toString(), fn ($q, $s) => $q->where('status', $s))
            ->latest()->get();

        return response()->json(['data' => $rows->map(fn ($r) => Keys::camel($r->attributesToArray()))]);
    }

    public function store(Request $request, Employee $employee): JsonResponse
    {
        abort_unless($request->user()->employee_id === $employee->id || $request->user()->can('manage'), 403);

        $data = $request->validate([
            'section' => ['required', 'string', 'max:40'],
            'changes' => ['required', 'array', 'min:1'],
            'changes.*.field' => ['required', Rule::in(self::CORRECTABLE)],
            'changes.*.requested' => ['present', 'nullable', 'string', 'max:500'],
        ]);

        $changes = array_map(function ($change) use ($employee) {
            $column = match ($change['field']) {
                'employeeName' => 'name',
                'arabicName' => 'name_ar',
                default => Str::snake($change['field']),
            };
            $current = $employee->{$column};

            return [
                'field' => $change['field'],
                'current' => $current instanceof \DateTimeInterface ? $current->format('Y-m-d') : $current,
                'requested' => $change['requested'],
            ];
        }, $data['changes']);

        $row = CorrectionRequest::create([
            'employee_id' => $employee->id,
            'section' => $data['section'],
            'changes' => $changes,
            'status' => 'Pending',
            'submitted_by' => $request->user()->id,
        ]);

        return response()->json(['data' => Keys::camel($row->attributesToArray())], 201);
    }

    public function decide(Request $request, CorrectionRequest $correction): JsonResponse
    {
        Gate::authorize('manage');
        if ($correction->status !== 'Pending') {
            throw ValidationException::withMessages(['decision' => 'This correction has already been decided.']);
        }

        $data = $request->validate([
            'decision' => ['required', Rule::in(['Approved', 'Rejected'])],
            'comment' => ['nullable', 'string', 'max:300', 'required_if:decision,Rejected'],
        ]);

        DB::transaction(function () use ($correction, $data, $request) {
            if ($data['decision'] === 'Approved') {
                $update = [];
                foreach ($correction->changes as $change) {
                    $column = match ($change['field']) {
                        'employeeName' => 'name',
                        'arabicName' => 'name_ar',
                        default => Str::snake($change['field']),
                    };
                    $update[$column] = $change['requested'];
                }
                $correction->employee->update($update);
            }

            $correction->update([
                'status' => $data['decision'],
                'decision_comment' => $data['comment'] ?? null,
                'decided_by' => $request->user()->id,
                'decided_at' => now(),
            ]);
        });

        return response()->json(['data' => Keys::camel($correction->refresh()->attributesToArray())]);
    }
}
