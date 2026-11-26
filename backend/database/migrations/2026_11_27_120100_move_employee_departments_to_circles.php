<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The firm is now organised in three circles - Judicial, Administrative and
 * Financial / Accounting - instead of the older departments. Every record,
 * and every permission scoped to departments, is moved onto its circle so
 * nothing is left under a name the form no longer offers or the API takes.
 *
 * Accountants filed under Administration go to Financial / Accounting rather
 * than Administrative: that circle exists for exactly that work.
 */
return new class extends Migration
{
    /** Old department => circle. */
    private const CIRCLE = [
        'Partner' => 'Judicial',
        'Legal Services' => 'Judicial',
        'Litigation' => 'Judicial',
        'Advisory & Contracts' => 'Judicial',
        'Administration' => 'Administrative',
        'Human Resources' => 'Administrative',
        'Information Technology' => 'Administrative',
        'Finance' => 'Financial / Accounting',
    ];

    public function up(): void
    {
        DB::table('employees')->where('department', 'Administration')->where('occupation', 'Accountant')
            ->update(['department' => 'Financial / Accounting']);

        foreach (self::CIRCLE as $old => $circle) {
            DB::table('employees')->where('department', $old)->update(['department' => $circle]);
        }

        $this->remapPermissions(fn (string $department) => self::CIRCLE[$department] ?? $department);
    }

    /**
     * Best effort: a circle covers several old departments, so the way back
     * is a guess - a partner by title, everybody else to the department most
     * of the circle came from.
     */
    public function down(): void
    {
        DB::table('employees')->where('department', 'Judicial')->where('occupation', 'like', '%Partner%')
            ->update(['department' => 'Partner']);
        DB::table('employees')->where('department', 'Judicial')->update(['department' => 'Legal Services']);
        DB::table('employees')->whereIn('department', ['Administrative', 'Financial / Accounting'])
            ->update(['department' => 'Administration']);

        $back = ['Judicial' => 'Legal Services', 'Administrative' => 'Administration', 'Financial / Accounting' => 'Administration'];
        $this->remapPermissions(fn (string $department) => $back[$department] ?? $department);
    }

    /** Departments a permission is scoped to, renamed, with any doubles dropped. */
    private function remapPermissions(callable $rename): void
    {
        DB::table('employee_permissions')->whereNotNull('departments')->orderBy('id')
            ->each(function ($row) use ($rename) {
                $departments = json_decode($row->departments, true);
                if (! is_array($departments) || ! $departments) {
                    return;
                }
                $moved = array_values(array_unique(array_map($rename, $departments)));
                if ($moved !== $departments) {
                    DB::table('employee_permissions')->where('id', $row->id)->update(['departments' => json_encode($moved)]);
                }
            });
    }
};
