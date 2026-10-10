<?php

namespace Database\Seeders;

use App\Models\FirmBankAccount;
use Illuminate\Database\Seeder;

/**
 * The firm's bank accounts in the demo. Safe to run on its own
 * (`php artisan db:seed --class=FirmSeeder`): it only adds what is missing.
 */
class FirmSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            ['Bank Muscat', 'Muscat Branch', 'Shatti Al Qurum', 'Muscat, Oman', 'Operating Account', 'Current Account', '0123456789', 'OM81 BMUS 0123 4567 8901', 'BMUSOMRX', 1, 5000, -232, true],
            ['National Bank of Oman', 'Ruwi Branch', 'Ruwi', 'Muscat, Oman', 'Corporate Account', 'Current Account', '9876543210', 'OM45 NBOM 9876 5432 1098', 'NBOMOMRX', null, 12000, -232, true],
            ['Bank Dhofar', 'Salalah Branch', 'Salalah Main', 'Dhofar, Oman', 'Salalah Office Account', 'Current Account', '4455667788', 'OM12 BDOF 4455 6677 8899', 'BDOFOMRU', 2, 3000, -120, false],
            ['Sohar International', 'Sohar Branch', 'Sohar', 'Al Batinah, Oman', 'Sohar Office Account', 'Current Account', '1122334455', 'OM68 SIIB 1122 3344 5566', 'SIIBOMRX', 3, 8000, -180, true],
            ['Oman Arab Bank', 'Azaiba Branch', 'Azaiba', 'Muscat, Oman', 'Client Funds Account', 'Call Account', '4455667899', 'OM96 OABB 4455 6677 8899', 'OABOOMRX', 1, 6500, -150, true],
            ['Ahli Bank', 'Qurum Branch', 'Qurum', 'Muscat, Oman', 'Payroll Account', 'Current Account', '9988776655', 'OM94 AHLI 9988 7766 5544', 'AHLIOMRX', 1, 7000, -95, true],
        ] as [$bank, $branch, $area, $location, $name, $type, $number, $iban, $swift, $branchId, $opening, $openedOffset, $active]) {
            FirmBankAccount::firstOrCreate(['account_number' => $number], [
                'bank_name' => $bank, 'bank_branch' => $branch, 'branch_area' => $area, 'location' => $location,
                'account_name' => $name, 'account_type' => $type, 'iban' => $iban, 'swift' => $swift,
                'branch_id' => $branchId, 'opening_balance' => $opening,
                'opened_at' => now()->addDays($openedOffset)->format('Y-m-d'), 'active' => $active,
            ]);
        }
    }
}
