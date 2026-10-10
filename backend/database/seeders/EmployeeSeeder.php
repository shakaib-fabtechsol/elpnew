<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Employee;
use App\Models\EmployeeDocument;
use App\Models\Supplier;
use App\Models\User;
use App\Support\Numbering;
use Illuminate\Database\Seeder;

/**
 * The firm's people, as the app's demo has them (src/pages/employees/
 * employeeData.js), the suppliers, and four sign-ins - one per role.
 */
class EmployeeSeeder extends Seeder
{
    public function run(): void
    {
        // id, name, nameAr, branch, joined, gender, nationality, department, occupation, salary, housing, transport, special, administrative, status, practiceLevel, contract, bank, extra
        $rows = [
            [1, 'Mohammed Al Yahyaei', 'محمد اليحيائي', 'Muscat', '2020-01-15', 'Male', 'Omani', 'Partner', 'Partner', 2500, 300, 125, 75, 175, 'Active', null, 'Indefinite-term', 'Bank Muscat'],
            [2, 'Fatima Al Rashdi', 'فاطمة الراشدي', 'Muscat', '2021-03-20', 'Female', 'Omani', 'Legal Services', 'Lawyer', 2000, 240, 100, 60, 140, 'Active', 'Trainee Lawyer', 'Indefinite-term', 'National Bank of Oman'],
            [3, 'Ahmed Al Balushi', 'أحمد البلوشي', 'Salalah', '2022-06-10', 'Male', 'Omani', 'Legal Services', 'Lawyer', 800, 96, 40, 24, 56, 'Active', 'Primary Lawyer', 'Fixed-term', 'Bank Dhofar'],
            [4, 'Sarah Al Lawati', 'سارة اللواتي', 'Muscat', '2019-09-05', 'Female', 'Omani', 'Administration', 'Administrative Assistant', 650, 78, 33, 19, 46, 'Active', null, 'Indefinite-term', 'Oman Arab Bank'],
            [5, 'Rajesh Kumar', 'راجيش كومار', 'Salalah', '2023-02-28', 'Male', 'Indian', 'Administration', 'Accountant', 1200, 144, 60, 36, 84, 'Inactive', null, 'Indefinite-term', 'Sohar International', ['decision_maker' => 'Employee Decision', 'reason_for_leaving' => 'Resignation', 'last_working_date' => '2026-06-30']],
            [6, 'Khalid Al Hinai', 'خالد الهنائي', 'Muscat', '2018-04-12', 'Male', 'Omani', 'Partner', 'Partner', 3000, 360, 150, 90, 210, 'Active', null, 'Fixed-term', 'Bank Muscat'],
            [7, 'Aisha Al Kindi', 'عائشة الكندي', 'Muscat', '2021-08-01', 'Female', 'Omani', 'Legal Services', 'Lawyer', 1800, 216, 90, 54, 126, 'Active', 'Appeal Lawyer', 'Indefinite-term', 'National Bank of Oman'],
            [8, 'Salim Al Rawahi', 'سالم الرواحي', 'Salalah', '2020-11-15', 'Male', 'Omani', 'Legal Services', 'Legal Consultant', 2200, 264, 110, 66, 154, 'Active', null, 'Indefinite-term', 'Bank Dhofar'],
            [9, 'Layla Al Habsi', 'ليلى الحبسي', 'Muscat', '2022-02-20', 'Female', 'Omani', 'Administration', 'Administrative Assistant', 600, 72, 30, 18, 42, 'Active', null, 'Fixed-term', 'Oman Arab Bank'],
            [10, 'Hamad Al Busaidi', 'حمد البوسعيدي', 'Salalah', '2019-07-08', 'Male', 'Omani', 'Legal Services', 'Lawyer', 1500, 180, 75, 45, 105, 'Active', 'Supreme Court Lawyer', 'Indefinite-term', 'Sohar International'],
            [11, 'Maryam Al Harthi', 'مريم الحارثي', 'Muscat', '2023-01-10', 'Female', 'Omani', 'Legal Services', 'Lawyer', 1600, 192, 80, 48, 112, 'Active', 'Trainee Lawyer', 'Indefinite-term', 'Bank Muscat'],
            [12, 'Yousuf Al Wahaibi', 'يوسف الوهيبي', 'Muscat', '2017-09-25', 'Male', 'Omani', 'Partner', 'Partner', 3500, 420, 175, 105, 245, 'Active', null, 'Fixed-term', 'National Bank of Oman'],
            [13, 'Nadia Al Siyabi', 'نادية السيابي', 'Salalah', '2021-05-18', 'Female', 'Omani', 'Administration', 'Accountant', 900, 108, 45, 27, 63, 'Active', null, 'Indefinite-term', 'Bank Dhofar'],
            [14, 'Omar Al Maskari', 'عمر المسكري', 'Muscat', '2020-03-30', 'Male', 'Omani', 'Legal Services', 'Lawyer', 1700, 204, 85, 51, 119, 'Active', 'Primary Lawyer', 'Indefinite-term', 'Oman Arab Bank'],
            [15, 'Huda Al Jabri', 'هدى الجابري', 'Muscat', '2022-09-12', 'Female', 'Omani', 'Administration', 'Administrative Assistant', 550, 66, 28, 16, 39, 'Active', null, 'Fixed-term', 'Sohar International'],
            [16, 'Imran Sheikh', 'عمران شيخ', 'Salalah', '2021-11-22', 'Male', 'Pakistani', 'Legal Services', 'Lawyer', 1400, 168, 70, 42, 98, 'Active', 'Appeal Lawyer', 'Indefinite-term', 'Bank Muscat'],
            [17, 'Amina Al Farsi', 'أمينة الفارسي', 'Muscat', '2019-12-05', 'Female', 'Omani', 'Legal Services', 'Legal Consultant', 2100, 252, 105, 63, 147, 'Active', null, 'Indefinite-term', 'National Bank of Oman'],
            [18, 'Hassan Al Zadjali', 'حسن الزدجالي', 'Salalah', '2020-08-17', 'Male', 'Omani', 'Legal Services', 'Lawyer', 1450, 174, 73, 43, 102, 'Inactive', 'Supreme Court Lawyer', 'Fixed-term', 'Bank Dhofar', ['decision_maker' => 'Management Decision', 'management_reason' => 'Termination / Dismissal', 'last_working_date' => '2026-05-31']],
            [19, 'Zainab Al Hosni', 'زينب الحوسني', 'Muscat', '2023-04-03', 'Female', 'Omani', 'Legal Services', 'Lawyer', 1550, 186, 78, 46, 109, 'Active', 'Trainee Lawyer', 'Indefinite-term', 'Oman Arab Bank'],
            [20, 'Abdul Rahman', 'عبد الرحمن', 'Muscat', '2018-06-14', 'Male', 'Egyptian', 'Administration', 'Accountant', 1100, 132, 55, 33, 77, 'Active', null, 'Indefinite-term', 'Sohar International'],
            [21, 'Sumaya Al Riyami', 'سمية الريامي', 'Salalah', '2022-07-25', 'Female', 'Omani', 'Administration', 'Administrative Assistant', 580, 70, 29, 17, 41, 'Active', null, 'Fixed-term', 'Bank Muscat'],
            [22, 'Tariq Al Ghafri', 'طارق الغافري', 'Muscat', '2019-02-11', 'Male', 'Omani', 'Partner', 'Partner', 2800, 336, 140, 84, 196, 'Active', null, 'Indefinite-term', 'National Bank of Oman'],
            [23, 'Reem Al Mahrouqi', 'ريم المحروقي', 'Muscat', '2021-10-08', 'Female', 'Omani', 'Legal Services', 'Lawyer', 1650, 198, 83, 49, 116, 'Inactive', 'Primary Lawyer', 'Indefinite-term', 'Bank Dhofar', ['decision_maker' => 'Management Decision', 'management_reason' => 'Contract Expiry', 'last_working_date' => '2026-04-30']],
            [24, 'Nasir Al Shukri', 'ناصر الشكري', 'Salalah', '2020-05-20', 'Male', 'Omani', 'Legal Services', 'Legal Consultant', 2000, 240, 100, 60, 140, 'Active', null, 'Fixed-term', 'Oman Arab Bank'],
            [25, 'Priya Sharma', 'بريا شارما', 'Muscat', '2022-12-01', 'Female', 'Indian', 'Administration', 'Administrative Assistant', 620, 74, 31, 19, 43, 'Active', null, 'Indefinite-term', 'Sohar International'],
        ];

        foreach ($rows as $row) {
            [$id, $name, $nameAr, $branch, $joined, $gender, $nationality, $department, $occupation, $salary, $housing, $transport, $special, $administrative, $status, $practice, $contract, $bank] = $row;
            $slug = strtolower(str_replace(' ', '.', $name));

            $employee = new Employee([
                'name' => $name, 'name_ar' => $nameAr, 'branch' => $branch, 'date_of_joining' => $joined,
                'gender' => $gender, 'nationality' => $nationality, 'department' => $department,
                'occupation' => $occupation, 'practice_level' => $practice, 'contract_type' => $contract,
                'employment_type' => 'Full-Time', 'contract_start_date' => $joined,
                'salary' => $salary, 'housing' => $housing, 'transport' => $transport, 'special' => $special,
                'administrative' => $administrative, 'status' => $status,
                'bank_name' => $bank, 'account_holder' => $name,
                'account_number' => '0312 0123 4567 '.str_pad((string) (889 + $id), 4, '0', STR_PAD_LEFT),
                'work_email' => $slug.'@sadeed.om',
                'civil_id' => (string) (10000000 + $id * 7919),
                'id_expiry' => now()->addYears(2)->format('Y-m-d'),
                'phone' => '9'.str_pad((string) (1000000 + $id * 3571), 7, '0', STR_PAD_LEFT),
                'salary_effective_date' => $joined,
                ...($row[18] ?? []),
            ]);
            $employee->id = $id;
            $employee->emp_no = 'EMP-'.str_pad((string) $id, 4, '0', STR_PAD_LEFT);
            $employee->save();
        }
        Numbering::atLeast('EMP', 25);

        // One sign-in per role. Password for all: "password".
        foreach ([
            [1, 'admin@sadeed.om', Role::Admin],
            [13, 'accounts@sadeed.om', Role::Accounting],
            [7, 'aisha@sadeed.om', Role::Lawyer],
            [3, 'ahmed@sadeed.om', Role::Lawyer],
        ] as [$employeeId, $email, $role]) {
            User::create([
                'name' => Employee::find($employeeId)->name,
                'email' => $email,
                'password' => 'password',
                'role' => $role,
                'employee_id' => $employeeId,
            ]);
        }

        // Papers already on file (the files themselves are not in the demo).
        foreach ([
            [1, '2026-08-26 10:30', 'Residence Card', 'Resident_Card_Mohammed.pdf', '2030-09-12', 'Clear copy of the resident card'],
            [1, '2026-08-20 14:15', 'Passport', 'Passport_Mohammed.jpg', '2030-09-12', 'Valid until 12/09/2030'],
            [1, '2026-08-15 09:45', 'Law Practice License', 'Bar_Card_Mohammed.pdf', '2027-03-31', 'Issued by Oman Bar Association'],
            [1, '2026-08-10 11:20', 'University Degree', 'Bachelor_Law.pdf', null, 'Bachelor of Law'],
            [3, '2026-08-05 13:05', 'Experience Certificate', 'Experience_Certificate.pdf', null, '5 years of legal experience'],
            [3, '2026-08-01 15:40', 'Appointment Decision', 'Decision_2026_14.pdf', null, 'Decision No. 14/2026'],
            [7, '2026-07-29 12:10', 'Training Certificate', 'Training_Certificate.jpg', null, 'Legal training certificate'],
            [8, '2026-07-25 16:25', 'Other', 'Reference_Letter.pdf', null, 'Reference letter'],
        ] as [$employeeId, $at, $type, $file, $expiry, $notes]) {
            EmployeeDocument::create(['employee_id' => $employeeId, 'type' => $type, 'file_name' => $file, 'expiry' => $expiry, 'notes' => $notes, 'uploaded_at' => $at]);
        }

        // Suppliers, including the two medical ones invoice claims come from.
        foreach ([
            ['Al Maha Properties', 'Utilities', '1102233', 'OM1102233'],
            ['Oman Electricity Distribution', 'Utilities', '1004455', 'OM1004455'],
            ['Omantel', 'Telecommunications', '1006677', 'OM1006677'],
            ['Ooredoo', 'Telecommunications', '1008899', 'OM1008899'],
            ['Muscat Stationery Est.', 'Office Supplies', '1201122', 'OM1201122'],
            ['Gulf Cleaning Services', 'Maintenance', '1303344', 'OM1303344'],
            ['Bank Muscat', 'Banking', '1000011', 'OM1000011'],
            ['Tax Authority', 'Government', null, null],
            ['Al Wathba Insurance', 'Professional Services', '1405566', 'OM1405566'],
            ['Ministry of Commerce', 'Government', null, null],
            ['KPMG Oman', 'Professional Services', '1507788', 'OM1507788'],
            ['Blue Ocean Media', 'Marketing', '1609900', 'OM1609900'],
            ['Nizwa Print House', 'Marketing', '1701133', 'OM1701133'],
            ['Falcon IT Solutions', 'IT & Software', '1802244', 'OM1802244'],
            ['Muscat Pharmacy LLC', 'Medical', '1458812', 'OM1100458812'],
            ['Starcare Hospital', 'Medical', '1223344', 'OM1100223344'],
        ] as [$name, $category, $cr, $vat]) {
            Supplier::create(['name' => $name, 'category' => $category, 'commercial_registration' => $cr, 'vat_number' => $vat, 'status' => $name === 'Nizwa Print House' ? 'Inactive' : 'Active']);
        }
    }
}
