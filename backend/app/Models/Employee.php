<?php

namespace App\Models;

use App\Casts\Money;
use App\Support\Numbering;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Employee extends Model
{
    use SoftDeletes;

    /** The allowances that sit on top of basic pay. */
    public const ALLOWANCES = ['special', 'housing', 'phone_allowance', 'transport', 'electricity', 'water'];

    /** What is held back from a month's pay as a standing deduction. */
    public const DEDUCTIONS = ['loan', 'salary_advance', 'disciplinary', 'other_deduction', 'administrative'];

    protected $guarded = ['id', 'emp_no'];

    protected function casts(): array
    {
        $money = array_fill_keys(['salary', ...self::ALLOWANCES, ...self::DEDUCTIONS], Money::class);

        $dates = array_fill_keys([
            'date_of_birth', 'id_expiry', 'passport_expiry', 'visa_expiry', 'work_permit_expiry',
            'lawyer_card_expiry', 'date_of_joining', 'employment_end_date', 'last_working_date',
            'contract_start_date', 'salary_effective_date', 'sp_registration_date',
        ], 'date:Y-m-d');

        return [...$money, ...$dates, 'social_protection' => 'boolean', 'annual_leave_days' => 'integer'];
    }

    protected static function booted(): void
    {
        // EMP-0026: handed out by the server, never typed.
        static::creating(function (Employee $employee): void {
            $employee->emp_no ??= Numbering::code('EMP', 4);
        });
    }

    /* ------------------------------------------------------------- pay */

    public function totalAllowances(): float
    {
        return round(array_sum(array_map(fn ($key) => (float) $this->{$key}, self::ALLOWANCES)), 3);
    }

    public function totalDeductions(): float
    {
        return round(array_sum(array_map(fn ($key) => (float) $this->{$key}, self::DEDUCTIONS)), 3);
    }

    public function grossSalary(): float
    {
        return round((float) $this->salary + $this->totalAllowances(), 3);
    }

    public function netSalary(): float
    {
        return round($this->grossSalary() - $this->totalDeductions(), 3);
    }

    /* ------------------------------------------------------------ scopes */

    /** ?search= over number, both names, department, occupation, civil ID. */
    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (! $term) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term): void {
            foreach (['emp_no', 'name', 'name_ar', 'department', 'occupation', 'civil_id', 'branch'] as $column) {
                $q->orWhere($column, 'like', '%'.$term.'%');
            }
        });
    }

    /* --------------------------------------------------------- relations */

    public function user(): HasOne
    {
        return $this->hasOne(User::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(EmployeeDocument::class);
    }

    public function salaryAdvances(): HasMany
    {
        return $this->hasMany(SalaryAdvance::class);
    }

    public function loans(): HasMany
    {
        return $this->hasMany(Loan::class);
    }

    public function entitlements(): HasMany
    {
        return $this->hasMany(EntitlementRequest::class);
    }

    public function assistanceRequests(): HasMany
    {
        return $this->hasMany(AssistanceRequest::class);
    }

    public function bonuses(): HasMany
    {
        return $this->hasMany(Bonus::class);
    }

    public function commissions(): HasMany
    {
        return $this->hasMany(Commission::class);
    }

    public function leaves(): HasMany
    {
        return $this->hasMany(Leave::class);
    }

    public function violations(): HasMany
    {
        return $this->hasMany(Violation::class);
    }

    public function generalRequests(): HasMany
    {
        return $this->hasMany(GeneralRequest::class);
    }

    public function salaryPayments(): HasMany
    {
        return $this->hasMany(SalaryPayment::class);
    }
}
