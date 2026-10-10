<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CircularResource;
use App\Http\Resources\RequestEventResource;
use App\Models\Circular;
use App\Models\RequestEvent;
use App\Services\RequestWorkflow;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Circulars. Management issues, revises (a new version supersedes the old,
 * which keeps its acknowledgements) and cancels; everyone acknowledges the
 * ones issued to them. Nothing is ever deleted, and every move is audited.
 */
class CircularController extends Controller
{
    public function __construct(private RequestWorkflow $workflow) {}

    /** ?pending=1 - only the ones the signed-in employee has still to acknowledge. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $circulars = Circular::query()
            ->with(['acknowledgements.employee:id,name', 'supersededBy:id,supersedes_id,circular_no', 'issuer:id,name'])
            ->when($request->string('status')->toString(), fn (Builder $q, $s) => $q->where('status', $s))
            ->orderByDesc('date')->orderByDesc('id')
            ->get();

        // Everyone but management sees only what was issued to them.
        if (! $user->can('manage') && $user->employee) {
            $circulars = $circulars->filter(fn (Circular $c) => $c->isFor($user->employee))->values();
        }

        // Only what was issued to them, management included: management sees
        // every circular, but is asked to acknowledge only its own (any other
        // would be refused, and would hold the app's gate shut for good).
        if ($request->boolean('pending') && $user->employee) {
            $circulars = $circulars->filter(fn (Circular $c) => $c->status === Circular::ACTIVE
                && $c->isFor($user->employee)
                && ! $c->acknowledgements->contains('employee_id', $user->employee_id))->values();
        }

        return CircularResource::collection($circulars);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('manage');
        $circular = DB::transaction(function () use ($request) {
            $circular = Circular::create([...$this->validated($request), 'status' => Circular::ACTIVE, 'issued_by' => $request->user()->id]);
            $this->workflow->log($circular, 'Issued', null, Circular::ACTIVE, $request->user(), null, $circular->target_group);

            return $circular;
        });

        return (new CircularResource($circular->load(['acknowledgements', 'issuer:id,name'])))->response()->setStatusCode(201);
    }

    public function show(int $id): CircularResource
    {
        return new CircularResource(Circular::with(['acknowledgements.employee:id,name', 'supersededBy:id,supersedes_id,circular_no', 'issuer:id,name'])->findOrFail($id));
    }

    /** A correction: a new circular in its place; the original is kept as it was. */
    public function revise(Request $request, int $id): JsonResponse
    {
        Gate::authorize('manage');
        $original = Circular::findOrFail($id);
        if ($original->status !== Circular::ACTIVE) {
            throw ValidationException::withMessages(['status' => 'Only an active circular can be revised.']);
        }

        $circular = DB::transaction(function () use ($request, $original) {
            $original->update(['status' => Circular::COMPLETED]);
            $circular = Circular::create([...$this->validated($request), 'status' => Circular::ACTIVE, 'supersedes_id' => $original->id, 'issued_by' => $request->user()->id]);
            $this->workflow->log($circular, 'New version', null, Circular::ACTIVE, $request->user(), null, 'Supersedes '.$original->circular_no);

            return $circular;
        });

        return (new CircularResource($circular->load(['acknowledgements', 'issuer:id,name'])))->response()->setStatusCode(201);
    }

    public function cancel(Request $request, int $id): CircularResource
    {
        Gate::authorize('manage');
        $circular = Circular::findOrFail($id);
        $circular->update(['status' => Circular::CANCELLED]);
        $this->workflow->log($circular, 'Cancelled', Circular::ACTIVE, Circular::CANCELLED, $request->user());

        return new CircularResource($circular->load(['acknowledgements.employee:id,name', 'issuer:id,name']));
    }

    public function acknowledge(Request $request, int $id): CircularResource
    {
        $user = $request->user();
        $circular = Circular::findOrFail($id);
        abort_unless($user->employee, 422, 'Your account is not linked to an employee record.');
        if ($circular->status !== Circular::ACTIVE || ! $circular->isFor($user->employee)) {
            throw ValidationException::withMessages(['circular' => 'This circular is not waiting on you.']);
        }

        $ack = $circular->acknowledgements()->firstOrCreate(['employee_id' => $user->employee_id], ['acknowledged_at' => now()]);
        if ($ack->wasRecentlyCreated) {
            $this->workflow->log($circular, 'Acknowledged', null, null, $user);
        }

        return new CircularResource($circular->load(['acknowledgements.employee:id,name', 'issuer:id,name']));
    }

    /** GET /circulars-audit - what has happened to the circulars, newest first, each with its number. */
    public function audit(Request $request): JsonResponse
    {
        Gate::authorize('manage');

        $events = RequestEvent::with('user')->where('subject_type', (new Circular)->getMorphClass())->orderByDesc('id')->limit(500)->get();
        $numbers = Circular::whereIn('id', $events->pluck('subject_id')->unique())->pluck('circular_no', 'id');

        return response()->json(['data' => $events->map(fn (RequestEvent $event) => [
            ...(new RequestEventResource($event))->resolve($request),
            'circularNo' => $numbers[$event->subject_id] ?? null,
        ])->values()]);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'targetGroup' => ['required', Rule::in(Circular::TARGET_GROUPS)],
            'branch' => ['nullable', 'string', 'max:20'],
            'content' => ['required', 'string', 'max:5000'],
            'file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ]);

        $file = $request->file('file');

        return [
            'date' => $data['date'],
            'target_group' => $data['targetGroup'],
            'branch' => $data['branch'] ?? 'general',
            'content' => $data['content'],
            'file_name' => $file?->getClientOriginalName(),
            'file_path' => $file?->store('circulars', 'local'),
        ];
    }
}
