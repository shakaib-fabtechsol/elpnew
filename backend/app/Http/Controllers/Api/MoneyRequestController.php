<?php

namespace App\Http\Controllers\Api;

use App\Enums\RequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\ApiRequest;
use App\Http\Requests\Workflow\DecisionRequest;
use App\Http\Requests\Workflow\PaymentRequest;
use App\Http\Resources\MoneyRequestResource;
use App\Http\Resources\RequestEventResource;
use App\Models\Employee;
use App\Models\User;
use App\Services\RequestWorkflow;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The endpoints every SADEED money request has, written once:
 *
 *   GET    /{requests}                 list (filters: employeeId, status, search, year)
 *   POST   /{requests}                 submit
 *   GET    /{requests}/{id}            one, with its history
 *   PUT    /{requests}/{id}            correct a Pending one / resubmit a Returned one
 *   DELETE /{requests}/{id}            withdraw before a decision
 *   POST   /{requests}/{id}/decision   Management Decision        (management)
 *   POST   /{requests}/{id}/payment    Financial Department Actions (admin, accounting)
 *   GET    /{requests}/{id}/history    the timeline
 *
 * A module says which model, resource and form it uses, and adds its own
 * rules in `prepare()` and `guard()`.
 */
abstract class MoneyRequestController extends Controller
{
    /** @var class-string<Model> */
    protected string $model;

    /** @var class-string<MoneyRequestResource> */
    protected string $resource = MoneyRequestResource::class;

    /** @var class-string<ApiRequest> */
    protected string $form;

    /** The date column lists are sorted and filtered by year on. */
    protected string $dateColumn = 'created_at';

    /** The column ?search= looks in besides the request number. */
    protected array $searchColumns = [];

    /** Uploaded files on the form (snake_case), each stored into the column of the same name. */
    protected array $files = ['attachment'];

    public function __construct(protected RequestWorkflow $workflow) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = $this->query($request->user())
            ->with('employee')
            ->when($request->integer('employeeId'), fn (Builder $q, int $id) => $q->where('employee_id', $id))
            ->withStatus($request->string('status')->toString() ?: null)
            ->when($request->integer('year'), fn (Builder $q, int $year) => $q->whereYear($this->dateColumn, $year))
            ->when($request->string('search')->toString(), function (Builder $q, string $term): void {
                $q->where(function (Builder $q) use ($term): void {
                    $q->where($this->numberColumn(), 'like', "%{$term}%");
                    foreach ($this->searchColumns as $column) {
                        $q->orWhere($column, 'like', "%{$term}%");
                    }
                    $q->orWhereHas('employee', fn (Builder $e) => $e->where('name', 'like', "%{$term}%"));
                });
            })
            ->orderByDesc($this->dateColumn)
            ->orderByDesc('id');

        $this->filter($query, $request);

        return $this->resource::collection($query->paginate(min($request->integer('perPage', 10), 100)));
    }

    public function show(Request $request, int $id): MoneyRequestResource
    {
        return new $this->resource($this->load($this->find($request->user(), $id)));
    }

    public function store(Request $request): JsonResponse
    {
        /** @var ApiRequest $form */
        $form = app($this->form);
        $user = $request->user();
        $employee = $this->employeeFor($user, $request->integer('employeeId') ?: null);

        $record = DB::transaction(function () use ($form, $employee, $user) {
            $data = $this->prepare($this->withUploads($form, $employee), $employee, null);
            unset($data['employee_id']);
            $this->guard($data, $employee, null);

            $record = new $this->model(['employee_id' => $employee->id, ...$data]);
            // Set here rather than left to the column default, so the model
            // in hand knows its state without being read back.
            $record->status = RequestStatus::Pending;
            $record->save();
            $this->workflow->submitted($record, $user);

            return $record;
        });

        return (new $this->resource($this->load($record)))->response()->setStatusCode(201);
    }

    public function update(Request $request, int $id): MoneyRequestResource
    {
        $record = $this->find($request->user(), $id);
        $this->ensureOwnerOrManager($request->user(), $record);

        /** @var ApiRequest $form */
        $form = app($this->form);
        $data = $this->prepare($this->withUploads($form, $record->employee), $record->employee, $record);
        unset($data['employee_id']);
        $this->guard($data, $record->employee, $record);

        match ($record->status) {
            RequestStatus::Returned => $this->workflow->resubmit($record, $data, $request->user()),
            RequestStatus::Pending => $record->fill($data)->save(),
            default => throw ValidationException::withMessages(['status' => 'A decided request can no longer be changed.']),
        };

        return new $this->resource($this->load($record->refresh()));
    }

    public function destroy(Request $request, int $id): MoneyRequestResource
    {
        $record = $this->find($request->user(), $id);
        $this->ensureOwnerOrManager($request->user(), $record);

        return new $this->resource($this->load($this->workflow->cancel($record, $request->user())));
    }

    public function decide(DecisionRequest $request, int $id): MoneyRequestResource
    {
        Gate::authorize('manage');
        $record = $this->find($request->user(), $id);

        $this->beforeDecision($record, $request);
        $amount = $request->validated('approvedAmount');
        $this->workflow->decide($record, $request->decision(), $amount === null ? null : (float) $amount, $request->validated('comment'), $request->user());

        return new $this->resource($this->load($record));
    }

    public function pay(PaymentRequest $request, int $id): MoneyRequestResource
    {
        Gate::authorize('pay');
        $record = $this->find($request->user(), $id);

        $this->workflow->pay($record, $this->paymentFields($record, $request->columns()), $request->user());

        return new $this->resource($this->load($record));
    }

    public function history(Request $request, int $id): AnonymousResourceCollection
    {
        $record = $this->find($request->user(), $id);

        return RequestEventResource::collection($record->events()->with('user')->get());
    }

    /* ----------------------------------------------------- for modules */

    /** Filters a module's list takes besides the shared ones (?kind=medical). */
    protected function filter(Builder $query, Request $request): void {}

    /** Turns the validated form into columns: computed amounts, defaults. */
    protected function prepare(array $data, Employee $employee, ?Model $existing): array
    {
        return $data;
    }

    /** Business rules that refuse a request (limits, one-at-a-time...). */
    protected function guard(array $data, Employee $employee, ?Model $existing): void {}

    /** Anything a module records alongside a decision (a loan's new installment). */
    protected function beforeDecision(Model $record, DecisionRequest $request): void {}

    /** The payment columns to record; a module can add its own. */
    protected function paymentFields(Model $record, array $payment): array
    {
        return $payment;
    }

    /** What a single record is returned with. */
    protected function load(Model $record): Model
    {
        return $record->load(['employee', 'decider', 'payer', 'events.user']);
    }

    protected function numberColumn(): string
    {
        return 'request_no';
    }

    /* ---------------------------------------------------------- helpers */

    /**
     * The validated form with each uploaded file stored privately and
     * replaced by its path. A field sent without a file keeps what is there.
     */
    protected function withUploads(ApiRequest $form, Employee $employee): array
    {
        $data = $form->columns();

        foreach ($this->files as $field) {
            unset($data[$field]);
            $file = $form->file(Str::camel($field));
            if ($file) {
                $data[$field] = $file->store('requests/'.$employee->id, 'local');
            }
        }

        return $data;
    }

    protected function query(User $user): Builder
    {
        return $this->model::query()->visibleTo($user);
    }

    protected function find(User $user, int $id): Model
    {
        return $this->query($user)->findOrFail($id);
    }

    /**
     * Whose request this is. Management may file one for anybody; everyone
     * else files their own, whatever the body says.
     */
    protected function employeeFor(User $user, ?int $employeeId): Employee
    {
        if ($employeeId && $user->can('manage')) {
            return Employee::findOrFail($employeeId);
        }

        if (! $user->employee) {
            throw ValidationException::withMessages(['employeeId' => 'Your account is not linked to an employee record.']);
        }

        return $user->employee;
    }

    protected function ensureOwnerOrManager(User $user, Model $record): void
    {
        abort_unless($user->can('manage') || $user->employee_id === $record->employee_id, 403, 'Only the employee who made this request can change it.');
    }
}
