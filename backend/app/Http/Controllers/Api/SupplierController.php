<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * The supplier directory, read-only for now: suppliers are added here only by
 * an invoice claim registering a new one, and the app lists them so the claim
 * and the Suppliers page agree.
 *
 *   GET /suppliers   list (filters: search, status)
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
}
