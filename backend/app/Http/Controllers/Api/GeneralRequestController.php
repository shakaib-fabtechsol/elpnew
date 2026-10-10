<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\GeneralRequestResource;
use App\Models\Employee;
use App\Models\GeneralRequest;
use App\Services\RequestWorkflow;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** General requests, grievances and complaints (?kind=general|grievance|complaint). */
class GeneralRequestController extends Controller
{
    public function __construct(private RequestWorkflow $workflow) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = GeneralRequest::query()->visibleTo($request->user())->with(['employee', 'reviewer'])
            ->when($request->string('kind')->toString(), fn (Builder $q, $k) => $q->where('kind', $k))
            ->when($request->integer('employeeId'), fn (Builder $q, $id) => $q->where('employee_id', $id))
            ->when($request->string('status')->toString(), fn (Builder $q, $s) => $q->whereIn('status', explode(',', $s)))
            ->when($request->string('search')->toString(), fn (Builder $q, $t) => $q->where(fn ($w) => $w->where('request_no', 'like', "%$t%")->orWhere('comment', 'like', "%$t%")))
            ->orderByDesc('date')->orderByDesc('id');

        return GeneralRequestResource::collection($query->paginate(min($request->integer('perPage', 10), 100)));
    }

    public function show(Request $request, int $id): GeneralRequestResource
    {
        return new GeneralRequestResource($this->find($request, $id)->load(['employee', 'reviewer']));
    }

    public function store(Request $request): JsonResponse
    {
        $kind = $request->input('kind', 'general');
        $data = $request->validate([
            'kind' => ['nullable', Rule::in(array_keys(GeneralRequest::KINDS))],
            'requestType' => ['required', Rule::in(GeneralRequest::KINDS[$kind][2] ?? [])],
            'comment' => ['required', 'string', 'max:'.GeneralRequest::COMMENT_LIMIT],
            'document' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
            'employeeId' => ['nullable', 'integer'],
        ]);

        $user = $request->user();
        $employee = ($data['employeeId'] ?? null) && $user->can('manage')
            ? Employee::findOrFail($data['employeeId'])
            : ($user->employee ?? throw ValidationException::withMessages(['employeeId' => 'Your account is not linked to an employee record.']));

        $record = GeneralRequest::create([
            'kind' => $kind,
            'employee_id' => $employee->id,
            'request_type' => $data['requestType'],
            'comment' => $data['comment'],
            'document' => $request->file('document')?->store('general/'.$employee->id, 'local'),
            'date' => now()->format('Y-m-d'),
            'status' => 'Pending',
        ]);
        $this->workflow->log($record, GeneralRequest::KINDS[$kind][0].' submitted', null, 'Pending', $user, null, $data['comment']);

        return (new GeneralRequestResource($record->load('employee')))->response()->setStatusCode(201);
    }

    public function decide(Request $request, int $id): GeneralRequestResource
    {
        Gate::authorize('manage');
        $record = $this->find($request, $id);
        if ($record->status !== 'Pending') {
            throw ValidationException::withMessages(['decision' => 'This request has already been decided.']);
        }

        $data = $request->validate([
            'decision' => ['required', Rule::in(['Approved', 'Rejected'])],
            'remarks' => ['nullable', 'string', 'max:'.GeneralRequest::DECISION_COMMENT_LIMIT, 'required_if:decision,Rejected'],
        ], ['remarks.required_if' => 'Give the reason for rejecting the request.']);

        $record->update([
            'status' => $data['decision'],
            'remarks' => $data['remarks'] ?? null,
            'decision_date' => now()->format('Y-m-d'),
            'reviewed_by' => $request->user()->id,
        ]);
        $this->workflow->log($record, 'Request '.strtolower($data['decision']), 'Pending', $data['decision'], $request->user(), null, $data['remarks'] ?? null);

        return new GeneralRequestResource($record->load(['employee', 'reviewer']));
    }

    private function find(Request $request, int $id): GeneralRequest
    {
        return GeneralRequest::query()->visibleTo($request->user())->findOrFail($id);
    }
}
