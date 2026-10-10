<?php

namespace App\Enums;

/**
 * Where any money request stands, whatever it is for.
 *
 * Pending   - waiting on management.
 * Returned  - handed back to the employee to correct; waits on them.
 * Approved  - granted (in full or in part), waiting on the financial department.
 * Paid      - the money has gone out.
 * Rejected  - refused, with the reason on the record.
 * Cancelled - withdrawn before a decision.
 *
 * Each module words these its own way on screen ("Disbursed", "Awaiting
 * Payment", "Full Approval"...) - that wording is the resource's business; the
 * stored state is one of these.
 */
enum RequestStatus: string
{
    case Pending = 'Pending';
    case Returned = 'Returned';
    case Approved = 'Approved';
    case Paid = 'Paid';
    case Rejected = 'Rejected';
    case Cancelled = 'Cancelled';

    /** Still open to a management decision. */
    public function awaitsDecision(): bool
    {
        return $this === self::Pending;
    }

    /** Money granted, whether or not it has been paid yet. */
    public function isGranted(): bool
    {
        return $this === self::Approved || $this === self::Paid;
    }
}
