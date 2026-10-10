<?php

namespace App\Models;

use App\Casts\Money;
use Illuminate\Database\Eloquent\Model;

/** One of the firm's own bank accounts. Closed accounts are kept, marked inactive. */
class FirmBankAccount extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'opening_balance' => Money::class,
            'opened_at' => 'date:Y-m-d',
            'active' => 'boolean',
            'branch_id' => 'integer',
        ];
    }
}
