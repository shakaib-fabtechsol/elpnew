<?php

namespace App\Enums;

/** The four answers management can give a request (Management Decision step). */
enum Decision: string
{
    case Full = 'full';
    case Partial = 'partial';
    case Return = 'return';
    case Reject = 'reject';

    public function label(): string
    {
        return match ($this) {
            self::Full => 'Full Approval',
            self::Partial => 'Partial Approval',
            self::Return => 'Return Request',
            self::Reject => 'Rejection',
        };
    }

    /** The state a request is left in by this answer. */
    public function resultingStatus(): RequestStatus
    {
        return match ($this) {
            self::Full, self::Partial => RequestStatus::Approved,
            self::Return => RequestStatus::Returned,
            self::Reject => RequestStatus::Rejected,
        };
    }

    /** Refusing or handing back has to say why. */
    public function needsComment(): bool
    {
        return $this === self::Return || $this === self::Reject;
    }
}
