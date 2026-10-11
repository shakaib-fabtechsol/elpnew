<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use App\Support\Keys;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * The supplier directory. Everyone signed in can read it (an invoice claim
 * names its supplier from it, and registers one that is new); only management
 * adds or changes a supplier by hand. A supplier is never deleted here -
 * claims already paid name it - it is made Inactive.
 *
 *   GET   /suppliers              list (filters: search, status)
 *   POST  /suppliers              add                (management)
 *   PATCH /suppliers/{supplier}   change what is sent (management)
 */
class SupplierController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Supplier::query()
            ->when($request->string('status')->toString(), fn ($q, string $status) => $q->where('status', $status))
            ->when($request->string('search')->toString(), function ($q, string $term): void {
                $q->where(fn ($q) => $q->where('name', 'like', "%{$term}%")
                    ->orWhere('supplier_no', 'like', "%{$term}%")
                    ->orWhere('vat_number', 'like', "%{$term}%"));
            })
            ->orderBy('id');

        return SupplierResource::collection($query->paginate(min($request->integer('perPage', 50), 200)));
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('manage');
        $supplier = Supplier::create($this->validated($request, null));

        return (new SupplierResource($supplier->refresh()))->response()->setStatusCode(201);
    }

    public function update(Request $request, Supplier $supplier): SupplierResource
    {
        Gate::authorize('manage');
        $supplier->update($this->validated($request, $supplier));

        return new SupplierResource($supplier->refresh());
    }

    private function validated(Request $request, ?Supplier $existing): array
    {
        $req = $existing ? 'sometimes' : 'required';
        // A tax number belongs to one supplier: an invoice is matched to its
        // supplier by it, so two records sharing one could not be told apart.
        $unique = fn (string $column) => Rule::unique('suppliers', $column)->ignore($existing?->id)->withoutTrashed();

        $data = $request->validate([
            'name' => [$req, 'string', 'max:255'],
            'category' => [$req, 'string', 'max:60'],
            'commercialRegistration' => ['nullable', 'string', 'max:30', $unique('commercial_registration')],
            'taxIdentificationNumber' => ['nullable', 'string', 'max:30'],
            'vatNumber' => ['nullable', 'string', 'max:30', $unique('vat_number')],
            'bank' => ['nullable', 'string', 'max:80'],
            'accountNumber' => ['nullable', 'string', 'max:40'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'status' => ['sometimes', Rule::in(Supplier::STATUSES)],
        ], [
            'commercialRegistration.unique' => 'Another supplier already has this commercial registration.',
            'vatNumber.unique' => 'Another supplier already has this VAT number.',
        ]);

        return Keys::snake($data);
    }
}
