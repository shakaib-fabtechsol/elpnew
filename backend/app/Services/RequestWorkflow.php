<?php

namespace App\Services;

use App\Enums\Decision;
use App\Enums\RequestStatus;
use App\Models\RequestEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The SADEED request workflow, the one place its rules live:
 *
 *   Submit -> Management Decision -> Financial Department Actions
 *
 * - Only a Pending request can be decided.
 * - Full approval grants what was asked; partial grants less (more than zero,
 *   less than requested); return and rejection must say why.
 * - Only an Approved request can be paid, and a transfer must say where it
 *   went and what the bank called it.
 * - A Returned request goes back to Pending when the employee resubmits it.
 *
 * Every move is written to the request's history in the same transaction.
 */
final class RequestWorkflow
{
    /** Logs the first line of a new request's history. */
    public function submitted(Model $request, ?User $by): void
    {
        // Whichever note this kind of request carries; read off the raw
        // attributes because not every request has every one of these columns.
        $attributes = $request->getAttributes();
        $note = $attributes['reason'] ?? $attributes['notes'] ?? $attributes['comment'] ?? null;

        $this->log($request, 'Request submitted', null, RequestStatus::Pending, $by, $request->requestedAmount(), $note);
    }

    public function decide(Model $request, Decision $decision, ?float $approvedAmount, ?string $comment, User $by): Model
    {
        if (! $request->status->awaitsDecision()) {
            throw ValidationException::withMessages([
                'decision' => 'This request is '.strtolower($request->status->value).' and cannot be decided again.',
            ]);
        }

        $requested = $request->requestedAmount();

        if ($decision === Decision::Partial) {
            if ($approvedAmount === null || $approvedAmount <= 0 || $approvedAmount >= $requested) {
                throw ValidationException::withMessages([
                    'approvedAmount' => 'A partial approval must grant more than zero and less than the '.number_format($requested, 3).' OMR requested.',
                ]);
            }
        }

        if ($decision->needsComment() && blank($comment)) {
            throw ValidationException::withMessages([
                'comment' => $decision === Decision::Return
                    ? 'Say what the employee needs to correct before returning the request.'
                    : 'Give the reason for rejecting the request.',
            ]);
        }

        return DB::transaction(function () use ($request, $decision, $approvedAmount, $comment, $by, $requested) {
            $from = $request->status;

            $request->forceFill([
                'decision' => $decision,
                'status' => $decision->resultingStatus(),
                'approved_amount' => match ($decision) {
                    Decision::Full => $requested,
                    Decision::Partial => $approvedAmount,
                    default => null,
                },
                'management_comment' => $comment,
                'decided_by' => $by->id,
                'decided_at' => now(),
            ]);

            if ($request->status === RequestStatus::Approved) {
                $request->whenApproved();
            }

            $request->save();

            $this->log($request, match ($decision) {
                Decision::Full => 'Request approved',
                Decision::Partial => 'Request partially approved',
                Decision::Return => 'Request returned to employee',
                Decision::Reject => 'Request rejected',
            }, $from, $request->status, $by, $request->status === RequestStatus::Approved ? $request->grantedAmount() : null, $comment);

            return $request;
        });
    }

    /**
     * @param  array{payment_method:string, payment_date:string, bank_account?:?string, payment_reference?:?string, finance_comment?:?string, expense_type?:?string, category?:?string, subcategory?:?string}  $payment
     */
    public function pay(Model $request, array $payment, User $by): Model
    {
        if ($request->status !== RequestStatus::Approved) {
            throw ValidationException::withMessages([
                'status' => $request->status === RequestStatus::Paid
                    ? 'This request has already been paid.'
                    : 'Only an approved request can be paid.',
            ]);
        }

        return DB::transaction(function () use ($request, $payment, $by) {
            $request->forceFill([
                ...$request->defaultBooking(),
                ...array_filter($payment, fn ($value) => $value !== null && $value !== ''),
                'status' => RequestStatus::Paid,
                'paid_by' => $by->id,
                'paid_at' => now(),
            ]);

            $request->whenPaid();
            $request->save();

            $this->log($request, 'Amount disbursed', RequestStatus::Approved, RequestStatus::Paid, $by, $request->grantedAmount(), $payment['finance_comment'] ?? $payment['payment_method'], $payment['payment_reference'] ?? null);

            return $request;
        });
    }

    /** The employee answers a returned request with corrected details. */
    public function resubmit(Model $request, array $changes, User $by): Model
    {
        if ($request->status !== RequestStatus::Returned) {
            throw ValidationException::withMessages(['status' => 'Only a returned request can be resubmitted.']);
        }

        return DB::transaction(function () use ($request, $changes, $by) {
            $request->fill($changes)->forceFill([
                'status' => RequestStatus::Pending,
                'decision' => null,
                'approved_amount' => null,
                'decided_by' => null,
                'decided_at' => null,
            ])->save();

            $this->log($request, 'Request resubmitted', RequestStatus::Returned, RequestStatus::Pending, $by, $request->requestedAmount());

            return $request;
        });
    }

    /** Withdrawn before anyone decided it. */
    public function cancel(Model $request, User $by): Model
    {
        if (! in_array($request->status, [RequestStatus::Pending, RequestStatus::Returned], true)) {
            throw ValidationException::withMessages(['status' => 'A request that has been decided cannot be withdrawn.']);
        }

        return DB::transaction(function () use ($request, $by) {
            $from = $request->status;
            $request->forceFill(['status' => RequestStatus::Cancelled])->save();
            $this->log($request, 'Request withdrawn', $from, RequestStatus::Cancelled, $by);

            return $request;
        });
    }

    public function log(Model $subject, string $action, RequestStatus|string|null $from, RequestStatus|string|null $to, ?User $by, ?float $amount = null, ?string $comment = null, ?string $reference = null): RequestEvent
    {
        return RequestEvent::create([
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->getKey(),
            'action' => $action,
            'from_status' => $from instanceof RequestStatus ? $from->value : $from,
            'to_status' => $to instanceof RequestStatus ? $to->value : $to,
            'amount' => $amount,
            'comment' => $comment,
            'reference' => $reference,
            'user_id' => $by?->id,
        ]);
    }
}
