<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** That an employee opened a circular - which is not yet having acknowledged it. */
class CircularRead extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['read_at' => 'datetime'];
    }
}
