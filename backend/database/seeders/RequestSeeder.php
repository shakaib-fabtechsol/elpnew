<?php

namespace Database\Seeders;

use App\Models\AssistanceRequest;
use App\Models\Bonus;
use App\Models\Circular;
use App\Models\Commission;
use App\Models\Employee;
use App\Models\EntitlementRequest;
use App\Models\GeneralRequest;
use App\Models\Leave;
use App\Models\Loan;
use App\Models\SalaryAdvance;
use App\Models\SalaryPayment;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Violation;
use App\Support\Numbering;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * The requests the app's demo shows, at every stage - most of all on
 * Aisha Al Kindi (EMP-0007), the record the client tests on.
 */
class RequestSeeder extends Seeder
{
    private array $ids = [];

    private int $admin;

    private int $accounts;

    public function run(): void
    {
        $this->ids = Employee::pluck('id', 'name')->all();
        $this->admin = User::where('email', 'admin@sadeed.om')->value('id');
        $this->accounts = User::where('email', 'accounts@sadeed.om')->value('id');

        $this->advances();
        $this->loans();
        $this->entitlements();
        $this->assistance();
        $this->bonuses();
        $this->commissions();
        $this->leaves();
        $this->violations();
        $this->generalRequests();
        $this->salaries();
        $this->circulars();

        $this->syncSequences();
    }

    /** A record saved exactly as given, numbers and statuses included. */
    private function put(string $model, string $employee, array $attributes): Model
    {
        /** @var Model $record */
        $record = new $model;
        $record->forceFill(['employee_id' => $this->ids[$employee], ...$attributes])->save();

        return $record;
    }

    private function day(int $offset): string
    {
        return now()->addDays($offset)->format('Y-m-d');
    }

    private function decided(string $decision, ?float $approved, string $comment, string $on): array
    {
        return ['decision' => $decision, 'approved_amount' => $approved, 'management_comment' => $comment, 'decided_by' => $this->admin, 'decided_at' => $on.' 10:00:00'];
    }

    private function paid(string $on, string $reference, string $account = 'Bank Muscat — •••• 6789', string $method = 'Bank Transfer'): array
    {
        return ['payment_method' => $method, 'bank_account' => $account, 'payment_date' => $on, 'payment_reference' => $reference, 'paid_by' => $this->accounts, 'paid_at' => $on.' 12:00:00'];
    }

    private function advances(): void
    {
        $returned = 'The requested amount is higher than the permitted limit. Please adjust the amount and resubmit the request.';
        $medical = 'Requesting a salary advance due to urgent family medical expenses. My father is scheduled for a medical procedure and I need to cover the treatment costs and related expenses.';
        $booking = ['expense_type' => 'Employee Expenses', 'category' => 'Salary', 'subcategory' => 'Salary Advance'];

        foreach ([
            ['SA-2026-00001', 'Mohammed Al Yahyaei', '2026-03-04', 500, 'April', 'Education Expenses', 'School fees for the new term.', 'Paid', [...$this->decided('full', 500, 'Approved.', '2026-03-05'), ...$this->paid('2026-03-06', 'TRX-2026-00101'), ...$booking]],
            ['SA-2026-00002', 'Priya Sharma', '2026-04-12', 200, 'May', 'Family Expenses', 'Flights home for a family wedding.', 'Paid', [...$this->decided('full', 200, 'Approved.', '2026-04-13'), ...$this->paid('2026-04-14', 'TRX-2026-00140'), ...$booking]],
            ['SA-2026-00003', 'Mohammed Al Yahyaei', '2026-05-19', 400, 'June', 'Emergency Case', 'Car repairs after an accident.', 'Rejected', $this->decided('reject', null, 'An advance was already granted this quarter.', '2026-05-20')],
            ['SA-2026-00004', 'Fatima Al Rashdi', '2026-06-08', 350, 'July', 'Other (Please specify)', 'Deposit on a new flat.', 'Paid', [...$this->decided('full', 350, 'Approved.', '2026-06-09'), ...$this->paid('2026-06-10', 'TRX-2026-00233'), ...$booking, 'purpose_other' => 'Housing deposit']],
            ['SA-2026-00005', 'Mohammed Al Yahyaei', '2026-07-21', 600, 'August', 'Medical Expenses', 'Medical treatment not covered by insurance.', 'Paid', [...$this->decided('full', 600, 'Approved.', '2026-07-22'), ...$this->paid('2026-07-23', 'TRX-2026-00320'), ...$booking]],
            ['SA-2026-00006', 'Mohammed Al Yahyaei', '2026-09-08', 300, 'October', 'Education Expenses', 'University fees for the autumn term.', 'Pending', []],
            ['SA-2026-00007', 'Mohammed Al Yahyaei', '2026-10-01', 400, 'October', 'Emergency Case', $medical, 'Returned', $this->decided('return', null, $returned, '2026-10-03')],
            ['SA-2026-00008', 'Ahmed Al Balushi', '2026-10-03', 400, 'October', 'Emergency Case', $medical, 'Pending', []],
            ['SA-2026-00009', 'Mohammed Al Yahyaei', '2026-10-04', 150, 'November', 'Medical Expenses', 'Dental treatment not covered by insurance.', 'Pending', []],
            ['SA-2026-00010', 'Ahmed Al Balushi', '2026-10-02', 400, 'October', 'Family Expenses', 'Travel costs for a family emergency.', 'Approved', $this->decided('partial', 300, 'Approved partially due to the nature of the case.', '2026-10-04')],
            ['SA-2026-00011', 'Ahmed Al Balushi', '2026-10-03', 400, 'October', 'Emergency Case', $medical, 'Returned', $this->decided('return', null, $returned, '2026-10-03')],
            ['SA-2026-00012', 'Aisha Al Kindi', '2026-10-03', 400, 'October', 'Emergency Case', $medical, 'Pending', []],
            ['SA-2026-00013', 'Aisha Al Kindi', '2026-10-02', 400, 'October', 'Family Expenses', 'Travel costs for a family emergency.', 'Approved', $this->decided('partial', 300, 'Approved partially due to the nature of the case.', '2026-10-04')],
            ['SA-2026-00014', 'Aisha Al Kindi', '2026-10-01', 900, 'November', 'Education Expenses', "University fees for my son's first semester.", 'Returned', $this->decided('return', null, $returned, '2026-10-03')],
            ['SA-2026-00015', 'Aisha Al Kindi', '2026-08-12', 250, 'September', 'Medical Expenses', 'Dental treatment not covered by insurance.', 'Paid', [...$this->decided('full', 250, 'Approved.', '2026-08-14'), ...$this->paid('2026-08-16', 'TRX-2026-00412'), ...$booking]],
        ] as [$no, $who, $on, $amount, $month, $purpose, $reason, $status, $extra]) {
            $this->put(SalaryAdvance::class, $who, [
                'request_no' => $no, 'requested_on' => $on, 'amount' => $amount, 'deduct_month' => $month,
                'deduct_year' => 2026, 'purpose' => $purpose, 'reason' => $reason, 'status' => $status, ...$extra,
            ]);
        }
    }

    private function loans(): void
    {
        $loans = [
            ['LNR-001', 'Mohammed Al Yahyaei', 7000, 0, 700, '2026-08-26', '2026-09-30', [['2026-09-30', 700], ['2026-10-31', 700, true], ['2026-11-30', 0, false, true]]],
            ['LNR-002', 'Mohammed Al Yahyaei', 5000, 2000, 1000, '2026-07-10', '2026-08-31', [['2026-08-31', 1000], ['2026-09-30', 500]]],
            ['LNR-003', 'Mohammed Al Yahyaei', 8500, 0, 850, '2026-05-18', '2026-06-30', [['2026-06-30', 850], ['2026-07-31', 850], ['2026-08-31', 850]]],
            ['LNR-004', 'Priya Sharma', 600, 0, 50, '2026-06-20', '2026-07-31', [['2026-07-31', 50], ['2026-08-31', 50]]],
            ['LNR-005', 'Aisha Al Kindi', 3000, 0, 300, '2026-07-01', '2026-07-31', [['2026-07-31', 300], ['2026-08-31', 300], ['2026-09-30', 300]]],
        ];

        foreach ($loans as [$no, $who, $amount, $merged, $monthly, $disbursed, $firstDue, $payments]) {
            $employee = Employee::find($this->ids[$who]);
            /** @var Loan $loan */
            $loan = $this->put(Loan::class, $who, [
                'request_no' => $no, 'requested_on' => now()->parse($disbursed)->subDays(5)->format('Y-m-d'),
                'kind' => Loan::NEW_LOAN, 'loan_amount' => $amount, 'merged' => $merged, 'monthly' => $monthly,
                'first_due' => $firstDue, 'disbursement_date' => $disbursed,
                'bank_name' => $employee->bank_name, 'account_number' => $employee->account_number,
                'status' => 'Paid', ...$this->decided('full', $amount, 'Approved.', now()->parse($disbursed)->subDays(2)->format('Y-m-d')),
                ...$this->paid($disbursed, 'TRX-LN-'.substr($no, -3)),
                'expense_type' => 'Employee Expenses', 'category' => 'Loan', 'subcategory' => Loan::NEW_LOAN,
            ]);

            foreach ($payments as $p) {
                // Only what has actually come due is recorded as repaid.
                if ($p[0] > now()->format('Y-m-d') && ! ($p[3] ?? false)) {
                    continue;
                }
                $loan->payments()->create(['due_date' => $p[0], 'amount' => $p[1], 'paid_on' => ($p[3] ?? false) ? null : $p[0], 'deferred' => $p[3] ?? false]);
            }
        }

        $aisha = Employee::find($this->ids['Aisha Al Kindi']);
        $this->put(Loan::class, 'Aisha Al Kindi', [
            'request_no' => 'LNR-006', 'requested_on' => '2026-10-05', 'kind' => Loan::INCREASE,
            'loan_amount' => 1500, 'merged' => 0, 'monthly' => 150, 'first_due' => '2026-11-30',
            'bank_name' => $aisha->bank_name, 'account_number' => $aisha->account_number,
            'comment' => 'Home repairs after the rains.', 'status' => 'Pending',
        ]);
    }

    private function entitlements(): void
    {
        $booking = fn (string $kind) => ['expense_type' => 'Employee Expenses', 'category' => 'Allowance Request', 'subcategory' => EntitlementRequest::KINDS[$kind][1]];
        $starcare = Supplier::where('name', 'Starcare Hospital')->value('id');
        $pharmacy = Supplier::where('name', 'Muscat Pharmacy LLC')->value('id');

        $rows = [
            ['leaveEncashment', 'Mohammed Al Yahyaei', 'LER-001', 'ENT-001', '2026-06-12', 416.667, 'Encashing part of this year\'s annual leave.', 'Paid', ['year' => 2026, 'leave_type' => 'Annual Leave', 'days' => 5, ...$this->decided('full', 416.667, 'Approved.', '2026-06-13'), ...$this->paid('2026-06-15', 'TRX-2026-00190'), ...$booking('leaveEncashment')]],
            ['transport', 'Mohammed Al Yahyaei', 'TRA-002', 'ENT-002', '2026-08-10', 25, 'Travel between the Muscat and Sohar offices for the month.', 'Paid', [...$this->decided('full', 25, 'Approved as claimed.', '2026-08-12'), ...$this->paid('2026-08-15', 'TRX-2026-00418'), ...$booking('transport')]],
            ['transport', 'Mohammed Al Yahyaei', 'TRA-003', null, '2026-09-19', 25, 'Client meetings in Sohar over three days.', 'Pending', ['attachment' => 'fuel-receipts.pdf']],
            ['transport', 'Priya Sharma', 'TRA-004', 'ENT-003', '2026-07-28', 18, 'Daily travel to the court registry.', 'Paid', [...$this->decided('partial', 15, 'Approved at the standard monthly rate.', '2026-07-30'), ...$this->paid('2026-08-01', 'TRX-2026-00377'), ...$booking('transport')]],
            ['transport', 'Priya Sharma', 'TRA-005', null, '2026-09-20', 25, 'Document filing runs for the month of September.', 'Pending', ['attachment' => 'transport-claim.pdf']],
            ['medical', 'Aisha Al Kindi', 'MAR-006', null, '2026-09-25', 120, 'Prescription and consultation not covered by insurance.', 'Pending', [
                'attachment' => 'medical-receipt.pdf', 'invoice_no' => 'SC-INV-30544', 'supplier_id' => $starcare,
                'invoice' => ['invoiceNo' => 'SC-INV-30544', 'invoiceDate' => '2026-09-23', 'supplierName' => 'Starcare Hospital', 'supplierVat' => 'OM1100223344', 'purpose' => 'Consultation and prescription',
                    'items' => [['name' => 'General consultation', 'quantity' => 1, 'amount' => 25], ['name' => 'Augmentin 625mg (14 tablets)', 'quantity' => 1, 'amount' => 7.4], ['name' => 'Physiotherapy session', 'quantity' => 1, 'amount' => 87.6]],
                    'subtotal' => 120, 'vat' => 0, 'total' => 120],
                'risk' => ['level' => 'high', 'reasons' => ['Same medication claimed before: Augmentin 625mg (14 tablets) (in ENT-008).'], 'notes' => [], 'repeated' => [['item' => 'Augmentin 625mg (14 tablets)', 'requestNo' => 'ENT-008', 'date' => '2026-06-14']], 'duplicateOf' => ''],
            ]],
            ['transport', 'Aisha Al Kindi', 'TRA-007', 'ENT-007', '2026-08-28', 30, 'Court visits in Salalah for the month.', 'Paid', [...$this->decided('full', 30, 'Approved as claimed.', '2026-08-30'), ...$this->paid('2026-09-02', 'TRX-2026-00455'), ...$booking('transport')]],
            ['medical', 'Aisha Al Kindi', 'MAR-008', 'ENT-008', '2026-06-14', 9.8, 'Antibiotics prescribed after a throat infection.', 'Paid', [
                ...$this->decided('full', 9.8, 'Approved as claimed.', '2026-06-16'), ...$this->paid('2026-06-18', 'TRX-2026-00211'), ...$booking('medical'),
                'invoice_no' => 'MP-2026-07310', 'supplier_id' => $pharmacy,
                'invoice' => ['invoiceNo' => 'MP-2026-07310', 'invoiceDate' => '2026-06-12', 'supplierName' => 'Muscat Pharmacy LLC', 'supplierVat' => 'OM1100458812', 'purpose' => 'Prescription medication',
                    'items' => [['name' => 'Augmentin 625mg (14 tablets)', 'quantity' => 1, 'amount' => 7.4], ['name' => 'Panadol Extra (24 tablets)', 'quantity' => 1, 'amount' => 2.4]],
                    'subtotal' => 9.8, 'vat' => 0, 'total' => 9.8],
                'risk' => ['level' => 'low', 'reasons' => [], 'notes' => [], 'repeated' => [], 'duplicateOf' => ''],
            ]],
        ];

        foreach ($rows as [$kind, $who, $no, $ent, $on, $amount, $reason, $status, $extra]) {
            $this->put(EntitlementRequest::class, $who, ['kind' => $kind, 'request_no' => $no, 'entitlement_no' => $ent, 'request_date' => $on, 'amount' => $amount, 'reason' => $reason, 'status' => $status, ...$extra]);
        }
    }

    private function assistance(): void
    {
        foreach ([
            ['ASR-001', 'Mohammed Al Yahyaei', '2026-08-15', 'Employee (Self)', 'Social Assistance', 'House damaged by flooding', 700, 'Pending', [], 'assistance_150826.pdf', 'Family emergency aid'],
            ['ASR-002', 'Mohammed Al Yahyaei', '2026-08-26', 'Employee (Self)', 'Social Assistance', 'Marriage of the employee', 500, 'Paid', [...$this->decided('full', 500, 'Approved.', '2026-08-26'), ...$this->paid('2026-08-26', 'TRX-AS-002', 'Bank Muscat (1234)')], 'assistance_260826.pdf', 'Marriage contract attached'],
            ['ASR-003', 'Priya Sharma', '2026-08-20', 'Father', 'Medical Assistance', "Hospital treatment for the employee's father", 300, 'Paid', [...$this->decided('full', 300, 'Approved.', '2026-08-20'), ...$this->paid('2026-08-20', 'TRX-AS-003', 'NBO (5678)')], 'assistance_200826.png', 'Medical support'],
            ['ASR-004', 'Priya Sharma', '2026-08-05', 'Son', 'Education Assistance', 'School fees for the new term', 400, 'Paid', [...$this->decided('full', 400, 'Approved.', '2026-08-05'), ...$this->paid('2026-08-05', 'TRX-AS-004', 'Oman Arab Bank (9012)')], 'assistance_050826.pdf', 'Student tuition support'],
            ['ASR-005', 'Mohammed Al Yahyaei', '2026-07-28', 'Employee (Self)', 'Other Assistance', 'Car maintenance support', 350, 'Rejected', $this->decided('reject', null, 'Car maintenance is not covered by the assistance policy.', '2026-07-30'), null, 'Car maintenance support'],
            ['ASR-006', 'Priya Sharma', '2026-07-12', 'Mother', 'Social Assistance', "Funeral of the employee's mother", 600, 'Paid', [...$this->decided('full', 600, 'Condolences from the firm.', '2026-07-12'), ...$this->paid('2026-07-12', 'TRX-AS-006', 'Sohar Bank (3344)')], 'assistance_120726.pdf', 'Condolences from the firm'],
            ['ASR-007', 'Aisha Al Kindi', '2026-09-18', 'Father', 'Medical Assistance', "Surgery for the employee's father", 450, 'Pending', [], 'assistance_180926.pdf', 'Hospital estimate attached'],
            ['ASR-008', 'Aisha Al Kindi', '2026-06-02', 'Employee (Self)', 'Social Assistance', 'Marriage of the employee', 500, 'Paid', [...$this->decided('full', 500, 'Approved.', '2026-06-03'), ...$this->paid('2026-06-05', 'TRX-AS-008', 'National Bank of Oman (4567)')], 'assistance_020626.pdf', 'Marriage contract attached'],
        ] as [$no, $who, $on, $beneficiary, $type, $purpose, $amount, $status, $extra, $proof, $notes]) {
            $booking = $status === 'Paid' ? ['expense_type' => 'Employee Expenses', 'category' => 'Assistance', 'subcategory' => $type] : [];
            $this->put(AssistanceRequest::class, $who, ['request_no' => $no, 'request_date' => $on, 'beneficiary' => $beneficiary, 'assistance_type' => $type, 'purpose' => $purpose, 'amount' => $amount, 'status' => $status, 'proof' => $proof, 'notes' => $notes, ...$extra, ...$booking]);
        }
    }

    private function bonuses(): void
    {
        foreach ([
            ['BON-001', 'Mohammed Al Yahyaei', 'Annual Bonus', null, 1500, -250, 'Paid', 'Annual bonus for 2025.'],
            ['BON-002', 'Mohammed Al Yahyaei', 'Business Development', null, 600, -60, 'Paid', 'Two corporate clients brought to the firm.'],
            ['BON-003', 'Fatima Al Rashdi', 'Completion of a Case or Task', null, 350, -35, 'Paid', "Execution file 21 closed in the firm's favour."],
            ['BON-004', 'Fatima Al Rashdi', 'Performance and Excellence', null, 250, -120, 'Paid', 'Recognised for the quarter.'],
            ['BON-005', 'Aisha Al Kindi', 'Collection', null, 420, -15, 'Paid', 'Overdue fees collected on three files.'],
            ['BON-006', 'Aisha Al Kindi', 'Other', 'Ramadan bonus', 200, -190, 'Paid', 'Paid to everyone in the Muscat office.'],
            ['BON-007', 'Priya Sharma', 'Annual Bonus', null, 620, -245, 'Paid', 'Annual bonus for 2025.'],
            ['BON-008', 'Priya Sharma', 'Performance and Excellence', null, 150, -120, 'Paid', 'Filing kept clear through the busiest quarter.'],
            ['BON-009', 'Priya Sharma', 'Completion of a Case or Task', null, 90, -58, 'Paid', 'Archive of closed files completed ahead of time.'],
            ['BON-010', 'Priya Sharma', 'Exceptional Bonus', null, 200, -6, 'Pending', 'Covered the front desk for two weeks single-handed.'],
            ['BON-011', 'Priya Sharma', 'Collection', null, 150, -20, 'Rejected', 'Fees collected on the Al Madina file.'],
            ['BON-012', 'Aisha Al Kindi', 'Performance and Excellence', null, 400, -3, 'Pending', 'Won the appeal on file 47 ahead of schedule.'],
        ] as [$no, $who, $sub, $type, $amount, $offset, $status, $notes]) {
            $on = $this->day($offset);
            $extra = match ($status) {
                'Paid' => [...$this->decided('full', $amount, 'Approved.', $on), ...$this->paid($this->day($offset + 2), 'TRX-'.$no), 'expense_type' => 'Employee Expenses', 'category' => 'Bonus', 'subcategory' => $sub],
                'Rejected' => $this->decided('reject', null, 'Collection bonuses are paid at year end.', $this->day($offset + 2)),
                default => [],
            };
            $this->put(Bonus::class, $who, ['request_no' => $no, 'recorded_on' => $on, 'bonus_subcategory' => $sub, 'bonus_type' => $type, 'amount' => $amount, 'status' => $status, 'notes' => $notes, ...$extra]);
        }
    }

    private function commissions(): void
    {
        foreach ([
            ['COM-2024-001', 'Mohammed Al Yahyaei', 'Partners', Commission::FIXED, '1', 'ABC Holdings LLC', null, null, 10, '2024-01-01', null],
            ['COM-2024-002', 'Fatima Al Rashdi', 'Lawyers', Commission::INVOICE_LINKED, '1', 'ABC Holdings LLC', '21', 'INV-2024-011', 5, '2024-05-01', '2024-12-31'],
            ['COM-2024-003', 'Amina Al Farsi', 'Consultants', Commission::FIXED, '3', 'Al Madina Trading', null, null, 7.5, '2024-07-01', null],
        ] as [$no, $who, $class, $type, $clientNo, $client, $case, $invoice, $rate, $from, $to]) {
            $this->put(Commission::class, $who, ['commission_no' => $no, 'classification' => $class, 'type' => $type, 'client_no' => $clientNo, 'client_name' => $client, 'case_file_no' => $case, 'invoice_no' => $invoice, 'rate' => $rate, 'period_from' => $from, 'period_to' => $to, 'status' => 'Approved', ...$this->decided('full', null, 'Agreed.', $from)]);
        }
    }

    private function leaves(): void
    {
        foreach ([
            ['LEV-001', 'Mohammed Al Yahyaei', 'Annual Leave', -8, -4, 'Family vacation', 'Approved', -15, 'Approved as requested.'],
            ['LEV-002', 'Mohammed Al Yahyaei', 'Sick Leave', 33, 35, 'Medical treatment', 'Pending', null, null],
            ['LEV-003', 'Mohammed Al Yahyaei', 'Maternity Leave', 72, 92, 'Maternity leave', 'Rejected', 70, 'The requested period exceeds the available entitlement.'],
            ['LEV-004', 'Mohammed Al Yahyaei', 'Hajj Leave', -400, -386, 'Pilgrimage', 'Approved', -420, 'Taken in full.'],
            ['LEV-005', 'Fatima Al Rashdi', 'Annual Leave', -40, -34, 'Travelling abroad', 'Approved', -48, 'Cover arranged with the Muscat office.'],
            ['LEV-006', 'Fatima Al Rashdi', 'Marriage Leave', 20, 22, 'Wedding', 'Pending', null, null],
            ['LEV-007', 'Ahmed Al Balushi', 'Sick Leave', -3, 4, 'Surgery and recovery', 'Approved', -6, 'Medical report on file.'],
            ['LEV-008', 'Ahmed Al Balushi', 'Annual Leave', -120, -111, 'Annual holiday', 'Approved', -130, null],
            ['LEV-009', 'Sarah Al Lawati', 'Annual Leave', 45, 52, 'Family visit abroad', 'Pending', null, null],
            ['LEV-010', 'Sarah Al Lawati', 'Paternity Leave', -200, -194, 'New baby', 'Rejected', -205, 'Paternity leave is for the father.'],
            ['LEV-011', 'Khalid Al Hinai', 'Hajj Leave', 60, 74, 'Pilgrimage', 'Approved', -2, 'Granted once in service.'],
            ['LEV-012', 'Aisha Al Kindi', 'Annual Leave', -15, -9, 'Rest days', 'Approved', -25, null],
            ['LEV-013', 'Omar Al Maskari', 'Annual Leave', -2, 8, 'Annual holiday', 'Approved', -12, 'Hearings covered by Maryam Al Harthi.'],
            ['LEV-014', 'Layla Al Habsi', 'Study / Examination Leave', 30, 36, 'Final examinations', 'Pending', null, null],
            ['LEV-015', 'Aisha Al Kindi', 'Annual Leave', -90, -68, 'Summer holiday', 'Approved', -100, 'Remaining annual leave taken in full.'],
        ] as [$no, $who, $type, $from, $to, $reason, $status, $decidedOffset, $comments]) {
            $start = $this->day($from);
            $this->put(Leave::class, $who, [
                'leave_no' => $no, 'category' => Leave::categoryOf($type), 'type' => $type,
                'starts_on' => $start, 'ends_on' => $this->day($to), 'year' => (int) substr($start, 0, 4),
                'reason' => $reason, 'status' => $status, 'stage' => $status === 'Pending' ? 'department' : 'management',
                'comments' => $comments, 'decided_by' => $decidedOffset !== null ? $this->admin : null,
                'decided_at' => $decidedOffset !== null ? $this->day($decidedOffset).' 09:00:00' : null,
            ]);
        }
    }

    private function violations(): void
    {
        $this->put(Violation::class, 'Mohammed Al Yahyaei', [
            'type' => 'Attendance', 'date' => '2026-09-16', 'description' => 'Arrived after 09:30 on three days in the same week without notice.',
            'investigation_start' => '2026-09-16', 'investigator' => 'Ahmed Al Balushi', 'status' => 'Under Investigation',
        ]);
        $this->put(Violation::class, 'Priya Sharma', [
            'violation_no' => 'VIO-002', 'type' => 'Attendance', 'date' => '2026-09-02', 'description' => 'Left the front desk unattended without arranging cover.',
            'investigation_start' => '2026-09-03', 'investigator' => 'Ahmed Al Balushi', 'response' => 'Acknowledged, and apologised to the office.',
            'acknowledged_at' => '2026-09-04 10:00:00', 'investigation_result' => 'Guilty', 'penalty_type' => Violation::DEDUCTION_PENALTY,
            'deduction_amount' => 25, 'decision_reasons' => 'A first deduction, at the lowest step.', 'penalty_date' => '2026-09-10',
            'approved_by' => $this->admin, 'status' => 'Closed',
        ]);
    }

    private function generalRequests(): void
    {
        foreach ([
            ['general', 'GR-2026-001', 'Mohammed Al Yahyaei', 'Administrative Request', 'Request for additional internet allowance.', '2026-08-15', 'Rejected', '2026-08-18', 'Not applicable.'],
            ['general', 'GR-2026-002', 'Mohammed Al Yahyaei', 'Administrative Request', 'Request to replace office chair.', '2026-08-20', 'Approved', '2026-08-22', 'Item ordered.'],
            ['general', 'GR-2026-003', 'Mohammed Al Yahyaei', 'Other Requests', 'Request for gym membership reimbursement.', '2026-09-01', 'Approved', '2026-09-03', 'Approved as per policy.'],
            ['general', 'GR-2026-004', 'Mohammed Al Yahyaei', 'Administrative Request', 'Please issue a parking access card for the employee vehicle.', '2026-09-10', 'Pending', null, null],
            ['general', 'GR-2026-005', 'Mohammed Al Yahyaei', 'Suggestions', 'Suggest moving the weekly case review to Sunday mornings.', '2026-09-14', 'Pending', null, null],
            ['grievance', 'GRV-2026-001', 'Aisha Al Kindi', 'Workload & Hours', 'Weekend court duty has been assigned three weeks running without rotation.', '2026-08-24', 'Approved', '2026-08-27', 'Rota revised; weekend duty now rotates across the team.'],
            ['grievance', 'GRV-2026-002', 'Aisha Al Kindi', 'Pay & Benefits', 'Overtime for September has not been reflected in the payslip.', '2026-09-29', 'Pending', null, null],
            ['grievance', 'GRV-2026-003', 'Mohammed Al Yahyaei', 'Working Conditions', 'The air conditioning in the second-floor meeting room has been out for two weeks.', '2026-09-18', 'Rejected', '2026-09-21', 'Maintenance is already scheduled; raised with facilities instead.'],
            ['complaint', 'CMP-2026-001', 'Aisha Al Kindi', 'Health & Safety', 'The archive room fire exit is blocked by stored case boxes.', '2026-09-05', 'Approved', '2026-09-06', 'Boxes moved and the exit cleared the same day.'],
            ['complaint', 'CMP-2026-002', 'Aisha Al Kindi', 'Misconduct', "A visitor was given access to a client file without the partner's approval.", '2026-10-01', 'Pending', null, null],
            ['complaint', 'CMP-2026-003', 'Mohammed Al Yahyaei', 'Other Complaint', 'The shared printer on the first floor jams on every double-sided job.', '2026-09-12', 'Pending', null, null],
        ] as [$kind, $no, $who, $type, $comment, $on, $status, $decidedOn, $remarks]) {
            $this->put(GeneralRequest::class, $who, ['kind' => $kind, 'request_no' => $no, 'request_type' => $type, 'comment' => $comment, 'date' => $on, 'status' => $status, 'decision_date' => $decidedOn, 'remarks' => $remarks, 'reviewed_by' => $decidedOn ? $this->admin : null]);
        }
    }

    private function salaries(): void
    {
        foreach ([[4, 0, 'Social insurance contribution'], [5, 80, 'Social insurance contribution'], [6, 120, 'Social insurance contribution'], [7, 120, 'Social insurance contribution'], [8, 120, 'Social insurance and unpaid leave (1 day)'], [9, 120, 'Social insurance contribution']] as $i => [$month, $loan, $reason]) {
            $this->put(SalaryPayment::class, 'Mohammed Al Yahyaei', [
                'request_no' => 'REQ-'.str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT), 'salary_no' => 'SAL-'.str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT),
                'month' => $month, 'year' => 2026, 'basic' => 2500, 'allowances' => 580, 'loan_deducted' => $loan, 'administrative' => 175,
                'administrative_reason' => $reason, 'status' => SalaryPayment::TRANSFERRED, 'payment_method' => 'Bank Transfer',
                'bank_account' => 'Bank Muscat — •••• 6789', 'payment_reference' => 'TRX-2026-00'.(412 + $i * 111),
                'payment_date' => now()->setDate(2026, $month, 1)->endOfMonth()->format('Y-m-d'), 'paid_by' => $this->accounts,
            ]);
        }
    }

    private function circulars(): void
    {
        $first = Circular::forceCreate(['circular_no' => 'CIR-2026-001', 'branch' => 'general', 'date' => '2026-01-12', 'target_group' => 'All Employees', 'file_name' => 'circular-2026-001.pdf', 'content' => 'Office hours over Ramadan will be 09:00 to 14:00. Court attendance is unaffected.', 'status' => Circular::COMPLETED, 'issued_by' => $this->admin]);
        $second = Circular::forceCreate(['circular_no' => 'CIR-2026-004', 'branch' => 'general', 'date' => '2026-01-20', 'target_group' => 'All Employees', 'file_name' => 'circular-2026-004.pdf', 'content' => 'Office hours over Ramadan will be 09:00 to 15:00. Court attendance is unaffected. This replaces CIR-2026-001.', 'status' => Circular::ACTIVE, 'supersedes_id' => $first->id, 'issued_by' => $this->admin]);
        Circular::forceCreate(['circular_no' => 'CIR-2026-002', 'branch' => 'Muscat', 'date' => '2026-02-03', 'target_group' => 'Lawyers', 'content' => 'All pleadings must be filed through the case file, not by direct email to the court registry.', 'status' => Circular::ACTIVE, 'issued_by' => $this->admin]);
        Circular::forceCreate(['circular_no' => 'CIR-2026-003', 'branch' => 'general', 'date' => '2026-03-18', 'target_group' => 'Administration', 'file_name' => 'circular-2026-003.pdf', 'content' => "Expense claims raised after the 25th of a month will be settled in the following month's run.", 'status' => Circular::ACTIVE, 'issued_by' => $this->admin]);

        foreach (['Mohammed Al Yahyaei' => '2026-01-12 09:40', 'Fatima Al Rashdi' => '2026-01-12 10:02', 'Ahmed Al Balushi' => '2026-01-12 11:18'] as $who => $at) {
            $first->acknowledgements()->create(['employee_id' => $this->ids[$who], 'acknowledged_at' => $at]);
        }
        $second->acknowledgements()->create(['employee_id' => $this->ids['Fatima Al Rashdi'], 'acknowledged_at' => '2026-01-20 08:55']);
    }

    /** Moves every numbering series past the numbers the demo already uses. */
    private function syncSequences(): void
    {
        $columns = [
            'salary_advances' => ['request_no'], 'loans' => ['request_no'], 'assistance_requests' => ['request_no'],
            'bonuses' => ['request_no'], 'commissions' => ['commission_no'], 'entitlement_requests' => ['request_no', 'entitlement_no'],
            'leaves' => ['leave_no'], 'violations' => ['violation_no'], 'general_requests' => ['request_no'],
            'salary_payments' => ['request_no', 'salary_no'], 'circulars' => ['circular_no'], 'suppliers' => ['supplier_no'],
        ];

        foreach ($columns as $table => $cols) {
            foreach ($cols as $col) {
                foreach (DB::table($table)->whereNotNull($col)->pluck($col) as $code) {
                    if (preg_match('/^(.*)-(\d+)$/', $code, $m)) {
                        Numbering::atLeast($m[1], (int) $m[2]);
                    }
                }
            }
        }
    }
}
