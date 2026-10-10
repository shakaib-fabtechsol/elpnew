<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\EmployeeDocumentResource;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Papers on an employee's file, newest first. A renewed paper is filed as a
 * new version; nothing is overwritten. A paper that stands for a number on
 * the record (passport, civil ID, lawyer card) can only be filed once that
 * number and its expiry are saved, so the two cannot disagree.
 */
class EmployeeDocumentController extends Controller
{
    public function index(Employee $employee): AnonymousResourceCollection
    {
        Gate::authorize('view-employee', $employee);
        $papers = $employee->documents()->orderByDesc('uploaded_at')->orderByDesc('id')->get();

        return EmployeeDocumentResource::collection($papers->each(fn ($doc) => $doc->setRelation('siblings', $papers)));
    }

    public function store(Request $request, Employee $employee): JsonResponse
    {
        Gate::authorize('view-employee', $employee);
        abort_unless($request->user()->can('manage') || $request->user()->employee_id === $employee->id, 403);

        $data = $request->validate([
            'type' => ['required', Rule::in(EmployeeDocument::allTypes())],
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
            'documentNumber' => ['nullable', 'string', 'max:60'],
            'expiry' => ['nullable', 'date_format:Y-m-d', Rule::requiredIf(EmployeeDocument::expires((string) $request->input('type')))],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        if ($related = EmployeeDocument::RELATED_RECORD[$data['type']] ?? null) {
            [$number, $expiry] = $related;
            if (! $employee->{$number} || ! $employee->{$expiry}) {
                throw ValidationException::withMessages(['type' => 'Save the '.$data['type'].' number and expiry on the employee record first.']);
            }
        }

        $file = $request->file('file');
        $document = $employee->documents()->create([
            'type' => $data['type'],
            'document_number' => $data['documentNumber'] ?? null,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $file->store('employees/'.$employee->id.'/documents', 'local'),
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'expiry' => $data['expiry'] ?? null,
            'notes' => $data['notes'] ?? null,
            'uploaded_at' => now(),
            'uploaded_by' => $request->user()->id,
        ]);

        return (new EmployeeDocumentResource($document->setRelation('siblings', $employee->documents()->get())))->response()->setStatusCode(201);
    }

    /** Served through the API, never from a public URL: these are personal papers. */
    public function download(Employee $employee, EmployeeDocument $document): StreamedResponse
    {
        Gate::authorize('view-employee', $employee);
        abort_unless($document->employee_id === $employee->id && $document->file_path, 404);

        return Storage::disk('local')->download($document->file_path, $document->file_name);
    }

    public function destroy(Employee $employee, EmployeeDocument $document): JsonResponse
    {
        Gate::authorize('manage');
        abort_unless($document->employee_id === $employee->id, 404);
        if ($document->file_path) {
            Storage::disk('local')->delete($document->file_path);
        }
        $document->delete();

        return response()->json(null, 204);
    }
}
