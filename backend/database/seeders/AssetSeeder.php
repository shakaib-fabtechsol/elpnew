<?php

namespace Database\Seeders;

use App\Models\EmployeeAsset;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * A few items out with the demo people, and one already back, so the
 * Assigned Assets register has something to show and its history reads.
 */
class AssetSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@sadeed.om')->value('id');

        // employee, type, number, make / model, serial, issued, returned
        $rows = [
            [3, 'Computer / Laptop', 'AST-IT-00428', 'Dell Latitude 5450', 'DL5450-7H2K9Q', '2026-05-01', null],
            [3, 'Mobile Phone', 'AST-MOB-00116', 'iPhone 15', 'F2LXK9QW0D', '2026-05-01', null],
            [3, 'Work ID Card', 'AST-ID-00041', 'Staff ID Card', null, '2026-05-01', null],
            [7, 'Computer / Laptop', 'AST-IT-00311', 'HP EliteBook 840', 'HP840-5CG3301', '2024-09-01', '2026-03-15'],
            [7, 'Computer / Laptop', 'AST-IT-00455', 'Lenovo ThinkPad T14', 'PF4ZK2LM', '2026-03-16', null],
            [7, 'Work ID Card', 'AST-ID-00029', 'Staff ID Card', null, '2021-08-01', null],
            [1, 'Car', 'AST-CAR-0007', 'Toyota Land Cruiser 2024', 'JTMHV05J804123456', '2024-02-10', null],
        ];

        foreach ($rows as [$employee, $type, $number, $model, $serial, $issued, $returned]) {
            EmployeeAsset::create([
                'employee_id' => $employee, 'type' => $type, 'asset_number' => $number,
                'make_model' => $model, 'serial_number' => $serial, 'issue_date' => $issued,
                'return_date' => $returned, 'status' => $returned ? EmployeeAsset::RETURNED : EmployeeAsset::ASSIGNED,
                'recorded_by' => $admin,
            ]);
        }
    }
}
