<?php

namespace App\Http\Resources;

/** A supplier as the directory lists it: its number, names and tax numbers. */
class SupplierResource extends ApiResource
{
    protected array $except = ['deleted_at'];
}
