<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** The last management insight written for an employee, kept so it is not written again on every visit. */
class EmployeeInsight extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['content' => 'array', 'generated_at' => 'datetime'];
    }
}
