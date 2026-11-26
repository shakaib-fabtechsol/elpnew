<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\EmployeeAssetRequest;
use App\Http\Resources\EmployeeAssetResource;
use App\Models\Employee;
use App\Models\EmployeeAsset;
use App\Support\Keys;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * The Assigned Assets register on an employee's file.
 *
 * An item is issued, then returned or disposed of; nothing is deleted, so the
 * register keeps every item the person has ever held. Anybody sees their own
 * register; other people's need Employee Assets permission within the
 * viewer's record access.
 */
class EmployeeAssetController extends Controller
{
    public function index(Request $request, Employee $employee): AnonymousResourceCollection
    {
        $this->authorizeView($request, $employee);

        $assets = EmployeeAsset::where('employee_id', $employee->id)
            ->with('recorder:id,name')
            // Items still out first, then the newest issued.
            ->orderByRaw('case when status = ? then 0 else 1 end', [EmployeeAsset::ASSIGNED])
            ->orderByDesc('issue_date')->orderByDesc('id')
            ->get();

        return EmployeeAssetResource::collection($assets);
    }

    public function store(EmployeeAssetRequest $request, Employee $employee): JsonResponse
    {
        Gate::authorize('view-employee', $employee);

        $asset = EmployeeAsset::create([
            ...$this->details($request->validated()),
            'employee_id' => $employee->id,
            'status' => EmployeeAsset::ASSIGNED,
            'recorded_by' => $request->user()->id,
        ]);

        return (new EmployeeAssetResource($asset->load('recorder:id,name')))->response()->setStatusCode(201);
    }

    /**
     * action=return (returnDate) or action=dispose (disposalDate) closes an
     * item; with no action the details are corrected.
     */
    public function update(Request $request, Employee $employee, EmployeeAsset $asset): EmployeeAssetResource
    {
        Gate::authorize('view-employee', $employee);
        abort_unless($asset->employee_id === $employee->id, 404);

        $action = $request->input('action');
        if ($action === 'return' || $action === 'dispose') {
            Gate::authorize('permission', 'employeeAssets.edit');
            $field = $action === 'return' ? 'returnDate' : 'disposalDate';
            $data = $request->validate([
                $field => ['required', 'date_format:Y-m-d', 'after_or_equal:'.$asset->issue_date->format('Y-m-d'), 'before_or_equal:today'],
                'notes' => ['nullable', 'string', 'max:500'],
            ], [
                $field.'.after_or_equal' => 'The date cannot be before the item was issued.',
                $field.'.before_or_equal' => 'The date cannot be in the future.',
            ]);

            // A disposed item is gone; a returned one may still be written off later.
            if ($asset->status === EmployeeAsset::DISPOSED || ($action === 'return' && $asset->status === EmployeeAsset::RETURNED)) {
                throw ValidationException::withMessages(['action' => 'This item is already '.strtolower($asset->status).'.']);
            }

            $asset->fill([
                ($action === 'return' ? 'return_date' : 'disposal_date') => $data[$field],
                'status' => $action === 'return' ? EmployeeAsset::RETURNED : EmployeeAsset::DISPOSED,
                'notes' => array_key_exists('notes', $data) ? $data['notes'] : $asset->notes,
            ])->save();

            return new EmployeeAssetResource($asset->load('recorder:id,name'));
        }

        abort_unless($action === null || $action === 'edit', 422, 'Unknown action.');
        $data = app(EmployeeAssetRequest::class)->validated();
        $asset->fill($this->details($data))->save();

        return new EmployeeAssetResource($asset->load('recorder:id,name'));
    }

    private function authorizeView(Request $request, Employee $employee): void
    {
        Gate::authorize('view-employee', $employee);
        abort_unless($request->user()->employee_id === $employee->id || $request->user()->can('permission', 'employeeAssets.view'), 403);
    }

    /** The validated fields as columns, numbers trimmed. */
    private function details(array $data): array
    {
        $columns = Keys::snake(array_intersect_key($data, array_flip(['type', 'assetNumber', 'makeModel', 'serialNumber', 'issueDate', 'notes'])));
        if (isset($columns['asset_number'])) {
            $columns['asset_number'] = trim($columns['asset_number']);
        }

        return $columns;
    }
}
