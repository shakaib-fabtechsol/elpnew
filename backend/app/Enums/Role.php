<?php

namespace App\Enums;

/**
 * Who a signed-in user is to the firm. The same four roles the front end
 * shows (src/lib/permissions.js), so a role means one thing on both sides.
 */
enum Role: string
{
    case Admin = 'admin';
    case Lawyer = 'lawyer';
    case Execution = 'execution';
    case Accounting = 'accounting';

    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Management / Admin',
            self::Lawyer => 'Lawyer',
            self::Execution => 'Execution Team',
            self::Accounting => 'Accounting',
        };
    }

    /** Sees every employee's records, not only their own. */
    public function seesEveryone(): bool
    {
        return $this === self::Admin || $this === self::Accounting;
    }
}
