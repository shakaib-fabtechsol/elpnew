<?php

namespace App\Models;

use App\Support\Numbering;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
    use SoftDeletes;

    protected $guarded = ['id', 'supplier_no'];

    protected function casts(): array
    {
        return ['auto_registered' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::creating(function (Supplier $supplier): void {
            $supplier->supplier_no ??= Numbering::code('SUP');
        });
    }

    /** The supplier an invoice names: by VAT number first, then by name. */
    public static function matching(?string $vatNumber, string $name): ?self
    {
        return self::query()
            ->when($vatNumber, fn ($q) => $q->where('vat_number', $vatNumber))
            ->when(! $vatNumber, fn ($q) => $q->whereRaw('lower(name) = ?', [mb_strtolower($name)]))
            ->first()
            ?? self::query()->whereRaw('lower(name) = ?', [mb_strtolower($name)])->first();
    }
}
