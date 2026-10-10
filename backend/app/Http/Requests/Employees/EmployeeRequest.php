<?php

namespace App\Http\Requests\Employees;

use App\Http\Requests\ApiRequest;
use App\Models\Employee;
use Illuminate\Validation\Rule;

/**
 * The employee record. On create the few things a record cannot exist without
 * are required; on update (PATCH) only what is sent is checked and changed.
 */
class EmployeeRequest extends ApiRequest
{
    /**
     * The departments a record may name: the three the older records were
     * filed under, and the ones Add Employee now offers (lib/constants.js
     * DEPARTMENT_GROUPS).
     */
    public const DEPARTMENTS = [
        'Partner', 'Legal Services', 'Administration',
        'Litigation', 'Advisory & Contracts', 'Finance', 'Human Resources', 'Information Technology',
    ];

    /** A lawyer's level, as older records say it and as the grade on the form now says it. */
    public const PRACTICE_LEVELS = [
        'Trainee Lawyer', 'Primary Lawyer', 'Appeal Lawyer', 'Supreme Court Lawyer', 'Non-Practicing Lawyers Register',
        'Primary Court Lawyer', 'Appeal Court Lawyer', 'Non-Practicing Lawyer',
    ];

    /** Only management adds or changes a record - checked before the body is. */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('manage');
    }

    /**
     * IBAN and SWIFT codes are written in capitals; one typed in small
     * letters is the same code, so it is put into capitals rather than
     * refused.
     */
    protected function prepareForValidation(): void
    {
        foreach (['iban', 'swiftCode'] as $key) {
            if (is_string($this->input($key))) {
                $this->merge([$key => strtoupper(trim($this->input($key)))]);
            }
        }
    }

    public function rules(): array
    {
        $creating = $this->isMethod('post');
        $req = $creating ? 'required' : 'sometimes';
        $id = $this->route('employee');

        $date = ['nullable', 'date_format:Y-m-d'];
        $money = ['nullable', 'numeric', 'min:0'];
        $text = fn (int $max = 255) => ['nullable', 'string', 'max:'.$max];

        return [
            'employeeName' => [$req, 'string', 'max:255'],
            'arabicName' => $text(),
            'nationality' => $text(60),
            'gender' => ['nullable', Rule::in(['Male', 'Female'])],
            'dateOfBirth' => [...$date, 'before:today'],

            'civilId' => [...$text(40), Rule::unique('employees', 'civil_id')->ignore($id)->whereNull('deleted_at')],
            'idExpiry' => $date,
            'passportNumber' => $text(40),
            'passportExpiry' => $date,
            'visaNo' => $text(40),
            'visaExpiry' => $date,
            'workPermitNo' => $text(40),
            'workPermitExpiry' => $date,
            'lawyerCardNo' => $text(40),
            'lawyerCardExpiry' => $date,

            'dialCode' => $text(8),
            'phone' => ['nullable', 'regex:/^[0-9 -]{6,20}$/'],
            'workDialCode' => $text(8),
            'workPhone' => ['nullable', 'regex:/^[0-9 -]{6,20}$/'],
            'workEmail' => ['nullable', 'email', 'max:255', Rule::unique('employees', 'work_email')->ignore($id)->whereNull('deleted_at')],
            'personalEmail' => ['nullable', 'email', 'max:255'],
            'address' => $text(1000),
            'emergencyName' => $text(),
            'emergencyRelationship' => $text(40),
            'emergencyDialCode' => $text(8),
            'emergencyPhone' => ['nullable', 'regex:/^[0-9 -]{6,20}$/'],

            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
            'branch' => $text(60),
            'dateOfJoining' => [$creating ? 'required' : 'sometimes', 'date_format:Y-m-d'],
            'employmentType' => ['nullable', Rule::in(['Full-Time', 'Part-Time', 'Temporary'])],
            'employmentEndDate' => [...$date, Rule::when($this->filled('dateOfJoining'), 'after_or_equal:dateOfJoining')],
            'category' => $text(60),
            'jobLevel' => $text(60),
            'department' => [$req, Rule::in(self::DEPARTMENTS)],
            'occupation' => [$req, 'string', 'max:80'],
            'practiceLevel' => ['nullable', Rule::in(self::PRACTICE_LEVELS)],
            'position' => $text(80),
            'grade' => $text(40),

            // Leaving: an inactive record says when and why.
            'lastWorkingDate' => [...$date, 'required_if:status,Inactive'],
            'decisionMaker' => [...$text(40), 'required_if:status,Inactive'],
            'reasonForLeaving' => $text(80),
            'managementReason' => $text(80),

            'contractType' => ['nullable', Rule::in(['Fixed-term', 'Indefinite-term'])],
            'contractStartDate' => $date,
            'probationPeriod' => $text(20),
            'noticePeriod' => $text(20),
            'annualLeaveDays' => ['nullable', 'integer', 'between:0,365'],

            'salary' => [$creating ? 'required' : 'sometimes', 'numeric', 'gt:0'],
            'special' => $money, 'housing' => $money, 'phoneAllowance' => $money, 'transport' => $money,
            'electricity' => $money, 'water' => $money, 'loan' => $money, 'salaryAdvance' => $money,
            'disciplinary' => $money, 'otherDeduction' => $money, 'administrative' => $money,
            'salaryEffectiveDate' => $date,

            'bankName' => $text(60),
            'accountHolder' => $text(),
            'accountNumber' => ['nullable', 'regex:/^[0-9 ]{6,40}$/'],
            'iban' => ['nullable', 'regex:/^[A-Z]{2}[0-9A-Z ]{10,32}$/'],
            'swiftCode' => ['nullable', 'regex:/^[A-Z0-9]{8}([A-Z0-9]{3})?$/'],

            'socialProtection' => ['nullable', 'boolean'],
            'spRegistrationNo' => $text(40),
            'spRegistrationDate' => $date,
        ];
    }

    public function messages(): array
    {
        return [
            'lastWorkingDate.required_if' => 'An inactive employee needs a last working day.',
            'decisionMaker.required_if' => 'Say whose decision the leaving was.',
            'iban.regex' => 'Enter a valid IBAN: two letters, then 10 to 32 letters or digits (e.g. OM81 0270 3120 4567 8901 234).',
            'swiftCode.regex' => 'Enter a valid SWIFT code: 8 or 11 letters or digits (e.g. BMUSOMRX).',
            'accountNumber.regex' => 'Enter a valid account number: digits only, at least 6.',
            'phone.regex' => 'Enter a valid phone number: 6 to 20 digits.',
            'workPhone.regex' => 'Enter a valid work phone number: 6 to 20 digits.',
            'emergencyPhone.regex' => 'Enter a valid emergency phone number: 6 to 20 digits.',
        ];
    }

    /** The form calls the names employeeName / arabicName; the record name / name_ar. */
    public function columns(): array
    {
        $data = parent::columns();

        foreach (['employee_name' => 'name', 'arabic_name' => 'name_ar'] as $from => $to) {
            if (array_key_exists($from, $data)) {
                $data[$to] = $data[$from];
                unset($data[$from]);
            }
        }

        // Left alone when empty: "not answered" is not "No" (see below).
        if (isset($data['social_protection'])) {
            $data['social_protection'] = (bool) $data['social_protection'];
        }

        // These columns always hold a value. Sent empty, they are left out:
        // a new record then takes the column's default (Active, +968, 30
        // days...) and an existing one keeps what it has.
        foreach (['status', 'dial_code', 'work_dial_code', 'emergency_dial_code', 'annual_leave_days', 'social_protection'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === null) {
                unset($data[$key]);
            }
        }

        // Empty money fields are zero, not "nothing".
        foreach ([...Employee::ALLOWANCES, ...Employee::DEDUCTIONS] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === null) {
                $data[$key] = 0;
            }
        }

        return $data;
    }
}
