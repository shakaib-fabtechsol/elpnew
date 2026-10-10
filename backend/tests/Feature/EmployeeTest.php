<?php

namespace Tests\Feature;

class EmployeeTest extends ApiTestCase
{
    public function test_management_lists_everyone_with_worked_out_pay(): void
    {
        $this->as('admin')->getJson($this->api('employees?perPage=50'))
            ->assertOk()
            ->assertJsonCount(25, 'data')
            ->assertJsonPath('data.6.empNo', 'EMP-0007')
            ->assertJsonPath('data.6.employeeName', 'Aisha Al Kindi')
            // 1800 + 216 + 90 + 54 allowances - 126 administrative
            ->assertJsonPath('data.6.netSalary', 2034);
    }

    public function test_an_employee_sees_only_their_own_record(): void
    {
        $this->as('aisha')->getJson($this->api('employees'))->assertOk()->assertJsonCount(1, 'data');
        $this->as('aisha')->getJson($this->api('employees/1'))->assertForbidden();
        $this->as('aisha')->getJson($this->api('employees/7'))->assertOk();
    }

    public function test_adding_an_employee_hands_out_the_next_number(): void
    {
        $this->as('admin')->getJson($this->api('employees/next-number'))->assertJsonPath('data.empNo', 'EMP-0026');

        $this->as('admin')->postJson($this->api('employees'), [
            'employeeName' => 'Said Al Amri',
            'arabicName' => 'سعيد العامري',
            'dateOfJoining' => '2026-10-01',
            'department' => 'Legal Services',
            'occupation' => 'Lawyer',
            'practiceLevel' => 'Trainee Lawyer',
            'salary' => 900,
            'housing' => 100,
            'iban' => 'OM12 0123 4567 8901 2345',
        ])->assertCreated()
            ->assertJsonPath('data.empNo', 'EMP-0026')
            ->assertJsonPath('data.name', 'Said Al Amri')
            ->assertJsonPath('data.netSalary', 1000);
    }

    public function test_add_employee_takes_the_departments_and_grades_the_form_offers(): void
    {
        $this->as('admin')->postJson($this->api('employees'), [
            'employeeName' => 'Salma Al Harthy',
            'dateOfJoining' => '2026-10-15',
            'department' => 'Litigation',
            'occupation' => 'Lawyer',
            'practiceLevel' => 'Primary Court Lawyer',
            'salary' => 900,
        ])->assertCreated()
            ->assertJsonPath('data.department', 'Litigation')
            ->assertJsonPath('data.practiceLevel', 'Primary Court Lawyer');

        $this->as('admin')->patchJson($this->api('employees/7'), ['department' => 'Marketing'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['department']);
    }

    public function test_bank_codes_in_small_letters_are_taken_and_bad_ones_say_why(): void
    {
        $this->as('admin')->patchJson($this->api('employees/7'), [
            'iban' => 'om81 0270 3120 4567 8901 234',
            'swiftCode' => 'bmusomrx',
            'phone' => '9123-4567',
        ])->assertOk()
            ->assertJsonPath('data.iban', 'OM81 0270 3120 4567 8901 234')
            ->assertJsonPath('data.swiftCode', 'BMUSOMRX')
            ->assertJsonPath('data.phone', '9123-4567');

        $this->as('admin')->patchJson($this->api('employees/7'), ['accountNumber' => '123', 'iban' => 'OM12', 'swiftCode' => 'BMUS'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.accountNumber.0', 'Enter a valid account number: digits only, at least 6.')
            ->assertJsonValidationErrors(['iban', 'swiftCode']);
    }

    public function test_fields_left_empty_take_their_defaults_instead_of_failing(): void
    {
        // What the form sends when Annual Leave Days, Status and the dial
        // codes are left empty: null. The record is still made.
        $this->as('admin')->postJson($this->api('employees'), [
            'employeeName' => 'Noor Al Said', 'dateOfJoining' => '2026-10-01', 'department' => 'Finance',
            'occupation' => 'Accountant', 'salary' => 700,
            'annualLeaveDays' => null, 'status' => null, 'dialCode' => null, 'workDialCode' => null,
            'emergencyDialCode' => null, 'socialProtection' => null, 'housing' => null,
        ])->assertCreated()
            ->assertJsonPath('data.annualLeaveDays', 30)
            ->assertJsonPath('data.status', 'Active')
            ->assertJsonPath('data.dialCode', '+968')
            ->assertJsonPath('data.socialProtection', true)
            ->assertJsonPath('data.housing', 0);

        // On an edit, an empty one keeps what the record has.
        $this->as('admin')->patchJson($this->api('employees/7'), ['annualLeaveDays' => null, 'status' => null])
            ->assertOk()
            ->assertJsonPath('data.annualLeaveDays', 30)
            ->assertJsonPath('data.status', 'Active');
    }

    public function test_only_management_adds_or_changes_employees(): void
    {
        $this->as('aisha')->postJson($this->api('employees'), ['employeeName' => 'X'])->assertForbidden();
        $this->as('aisha')->patchJson($this->api('employees/7'), ['salary' => 99999])->assertForbidden();
    }

    public function test_an_inactive_record_must_say_when_and_why(): void
    {
        $this->as('admin')->patchJson($this->api('employees/7'), ['status' => 'Inactive'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['lastWorkingDate', 'decisionMaker']);
    }

    public function test_requests_overview_counts_each_kind_by_status(): void
    {
        $this->as('aisha')->getJson($this->api('employees/7/requests-overview'))
            ->assertOk()
            // SA-12 pending, SA-13 approved, SA-14 returned, SA-15 paid
            ->assertJsonPath('data.financing.salaryAdvance', ['total' => 4, 'approved' => 2, 'pending' => 1, 'returned' => 1, 'rejected' => 0])
            ->assertJsonPath('data.financing.loan.pending', 1)
            ->assertJsonPath('data.eligibility.loan.canRequest', false);
    }
}
