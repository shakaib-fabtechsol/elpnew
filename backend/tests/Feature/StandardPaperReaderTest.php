<?php

namespace Tests\Feature;

use App\Services\Documents\Standard\Mrz;
use App\Services\Documents\Standard\OcrUnavailable;
use App\Services\Documents\Standard\StandardPaperReader;
use App\Services\Documents\Standard\TextExtractor;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

/**
 * The five papers Add Employee reads without AI - Civil ID, passport, lawyer
 * card, employment contract, CV - each into the record's own fields, every
 * value with how sure the reading is.
 */
class StandardPaperReaderTest extends ApiTestCase
{
    /** The specimen passport of ICAO 9303 part 4 (check digits as published). */
    private const PASSPORT_MRZ = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10";

    /** The specimen ID card of ICAO 9303 part 5. */
    private const CARD_MRZ = "I<UTOD231458907<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<";

    private function reader(): StandardPaperReader
    {
        return app(StandardPaperReader::class);
    }

    private function value(array $read, string $key): mixed
    {
        return $read['fields'][$key]['value'] ?? null;
    }

    public function test_the_check_digit_is_the_icao_one(): void
    {
        $this->assertSame(6, Mrz::checkDigit('L898902C3'));
        $this->assertSame(2, Mrz::checkDigit('740812'));
        $this->assertSame(9, Mrz::checkDigit('120415'));
    }

    public function test_a_passport_is_read_from_its_machine_readable_zone(): void
    {
        $read = $this->reader()->readText("PASSPORT\nsome blurred print\n".self::PASSPORT_MRZ);

        $this->assertSame('passport', $read['typeKey']);
        $this->assertSame('standard', $read['engine']);
        $this->assertSame('L898902C3', $this->value($read, 'passportNumber'));
        $this->assertSame(Mrz::SURE, $read['fields']['passportNumber']['confidence']);
        $this->assertSame('Anna Maria Eriksson', $this->value($read, 'employeeName'));
        $this->assertSame('1974-08-12', $this->value($read, 'dateOfBirth'));
        $this->assertSame('2012-04-15', $this->value($read, 'passportExpiry'));
        $this->assertSame('Female', $this->value($read, 'gender'));
    }

    public function test_a_misread_mrz_value_is_kept_but_marked_unsure(): void
    {
        // One digit of the passport number misread: its check digit no longer agrees.
        $read = $this->reader()->readText(str_replace('L898902C3', 'L898962C3', self::PASSPORT_MRZ), '', 'passport');

        $this->assertSame('L898962C3', $this->value($read, 'passportNumber'));
        $this->assertSame(Mrz::UNSURE, $read['fields']['passportNumber']['confidence']);
        // The dates still pass their own checks.
        $this->assertSame(Mrz::SURE, $read['fields']['dateOfBirth']['confidence']);
    }

    public function test_a_passport_whose_mrz_cannot_be_read_is_read_from_its_labels(): void
    {
        $page = <<<'TEXT'
        PASSPORT
        Passport No: K4417290
        Surname: AL KINDI
        Given Names: AISHA SAID
        Nationality: Omani
        Date of Birth: 05/11/1990
        Sex: F
        Date of Expiry: 14/02/2031
        TEXT;

        $read = $this->reader()->readText($page, '', 'passport');

        $this->assertSame('K4417290', $this->value($read, 'passportNumber'));
        $this->assertSame('Aisha Said Al Kindi', $this->value($read, 'employeeName'));
        $this->assertSame('1990-11-05', $this->value($read, 'dateOfBirth'));
        $this->assertSame('2031-02-14', $this->value($read, 'passportExpiry'));
        $this->assertSame('Female', $this->value($read, 'gender'));
        $this->assertSame('Omani', $this->value($read, 'nationality'));
        // Read from print, not from a checked zone: below the machine-readable trust.
        $this->assertLessThan(Mrz::SURE, $read['fields']['passportNumber']['confidence']);
    }

    public function test_an_omani_passport_names_the_nationality_as_the_form_does(): void
    {
        [$number, $birth, $expiry] = ['A1234567<', '920312', '300822'];
        $line2 = $number.Mrz::checkDigit($number).'OMN'.$birth.Mrz::checkDigit($birth).'M'
            .$expiry.Mrz::checkDigit($expiry).str_repeat('<', 14).'0';
        $composite = substr($line2, 0, 10).substr($line2, 13, 7).substr($line2, 21, 22);
        $mrz = "P<OMNAL<HARTHY<<SALIM<KHALID<<<<<<<<<<<<<<<<\n".$line2.Mrz::checkDigit($composite);

        $read = $this->reader()->readText($mrz);

        $this->assertSame('Omani', $this->value($read, 'nationality'));
        $this->assertSame('Male', $this->value($read, 'gender'));
        $this->assertSame('2030-08-22', $this->value($read, 'passportExpiry'));
        $this->assertSame('Salim Khalid Al Harthy', $this->value($read, 'employeeName'));
    }

    public function test_a_civil_id_is_read_from_its_labels_and_the_card_mrz(): void
    {
        $front = <<<'TEXT'
        SULTANATE OF OMAN
        سلطنة عمان
        RESIDENT CARD
        Civil Number: 12345678
        Name: SALIM KHALID AL HARTHI
        الاسم: سالم خالد الحارثي
        Date of Birth: 12/03/1992
        Expiry Date: 22/08/2029
        Sex: M
        Nationality: Omani
        TEXT;

        $read = $this->reader()->readText($front, '', 'civilId');

        $this->assertSame('12345678', $this->value($read, 'civilId'));
        $this->assertSame(90, $read['fields']['civilId']['confidence']);
        $this->assertSame('Salim Khalid Al Harthi', $this->value($read, 'employeeName'));
        $this->assertSame('سالم خالد الحارثي', $this->value($read, 'arabicName'));
        $this->assertSame('1992-03-12', $this->value($read, 'dateOfBirth'));
        $this->assertSame('2029-08-22', $this->value($read, 'idExpiry'));
        $this->assertSame('Male', $this->value($read, 'gender'));
        $this->assertSame('Omani', $this->value($read, 'nationality'));

        // The back of a card: its MRZ alone is enough to know it and read it.
        $back = $this->reader()->readText(self::CARD_MRZ);
        $this->assertSame('civilId', $back['typeKey']);
        $this->assertSame('D23145890', $this->value($back, 'civilId'));
        $this->assertSame('2012-04-15', $this->value($back, 'idExpiry'));
    }

    public function test_a_lawyer_card_gives_the_number_the_expiry_and_the_court_level(): void
    {
        $card = <<<'TEXT'
        OMAN BAR ASSOCIATION
        Lawyer Card
        Name: Fatima Said Al Rashdi
        Registration No: LC-2041/17
        Court: Appeal Court
        Valid Until: 31-12-2027
        TEXT;

        $read = $this->reader()->readText($card);

        $this->assertSame('lawyerCard', $read['typeKey']);
        $this->assertSame('LC-2041/17', $this->value($read, 'lawyerCardNo'));
        $this->assertSame('2027-12-31', $this->value($read, 'lawyerCardExpiry'));
        $this->assertSame('Fatima Said Al Rashdi', $this->value($read, 'employeeName'));
        $this->assertSame('Appeal Court Lawyer', $this->value($read, 'practiceLevel'));
        $this->assertSame('Appeal Court Lawyer', $this->value($read, 'grade'));
        $this->assertSame('Judicial', $this->value($read, 'department'));
    }

    public function test_an_employment_contract_gives_the_job_the_pay_and_the_terms(): void
    {
        $contract = <<<'TEXT'
        EMPLOYMENT CONTRACT
        This contract is made between the Firm (First Party) and
        Employee Name: Ahmed Salim Al Balushi
        Civil ID No: 87654321
        Position: Legal Consultant
        Commencement Date: 1 March 2026
        This is an indefinite term contract on a full-time basis.
        Basic Salary: OMR 1,200.000 per month
        Housing Allowance: OMR 250
        Transport Allowance: 100.000
        Either party may end this contract by giving one (1) month written notice.
        TEXT;

        $read = $this->reader()->readText($contract);

        $this->assertSame('contract', $read['typeKey']);
        $this->assertSame('Ahmed Salim Al Balushi', $this->value($read, 'employeeName'));
        $this->assertSame('87654321', $this->value($read, 'civilId'));
        $this->assertSame('Legal Consultant', $this->value($read, 'occupation'));
        $this->assertSame('Judicial', $this->value($read, 'department'));
        $this->assertSame('2026-03-01', $this->value($read, 'dateOfJoining'));
        $this->assertSame('Indefinite-term', $this->value($read, 'contractType'));
        $this->assertSame('Full-Time', $this->value($read, 'employmentType'));
        $this->assertSame('1200.000', $this->value($read, 'salary'));
        $this->assertSame('250.000', $this->value($read, 'housing'));
        $this->assertSame('100.000', $this->value($read, 'transport'));
        $this->assertSame('1 Month', $this->value($read, 'noticePeriod'));
    }

    public function test_a_cv_gives_the_person_their_education_languages_and_summary(): void
    {
        $cv = <<<'TEXT'
        Sarah Ahmed Al Lawati
        Legal Consultant
        sarah.lawati@example.com | +968 9123 4567
        Address: Al Khuwair, Muscat

        PROFILE
        Legal consultant with eight years of experience in commercial litigation
        and contract drafting before the courts of appeal.

        EDUCATION
        Master of Laws (LLM) in Commercial Law, 2018
        University of London
        Bachelor of Law, 2015

        LANGUAGES
        Arabic, English, French
        TEXT;

        $read = $this->reader()->readText($cv, '', 'cv');

        $this->assertSame('Sarah Ahmed Al Lawati', $this->value($read, 'employeeName'));
        $this->assertSame('sarah.lawati@example.com', $this->value($read, 'personalEmail'));
        // The country code is the form's own box; the number is the rest.
        $this->assertSame('9123 4567', $this->value($read, 'phone'));
        $this->assertSame('Al Khuwair, Muscat', $this->value($read, 'address'));
        $this->assertSame('Legal Consultant', $this->value($read, 'occupation'));
        $this->assertSame("Master's Degree", $this->value($read, 'highestEducation'));
        $this->assertSame(['Arabic', 'English', 'French'], $this->value($read, 'languages'));
        $this->assertStringStartsWith('Legal consultant with eight years', $this->value($read, 'cvSummary'));
        $this->assertSame('Commercial Law', $read['qualification']['specialization']);
        $this->assertSame('University of London', $read['qualification']['institution']);
        $this->assertSame('2018', $read['qualification']['year']);
    }

    public function test_a_lawyers_cv_is_known_by_its_sections_and_not_taken_for_a_lawyer_card(): void
    {
        $cv = "Hamad Nasser Al Habsi\nLawyer\nPROFILE\nLawyer admitted before the Primary Courts.\nEXPERIENCE\nLawyer, Muscat - 2020 to present\nLegal Associate, Muscat - 2018 to 2020\nEDUCATION\nBachelor of Law, 2018";

        $read = $this->reader()->readText($cv);

        $this->assertSame('cv', $read['typeKey']);
        $this->assertSame('Hamad Nasser Al Habsi', $this->value($read, 'employeeName'));
        // The title held now (top), not an earlier one further down.
        $this->assertSame('Lawyer', $this->value($read, 'occupation'));
        $this->assertSame('Primary Court Lawyer', $this->value($read, 'practiceLevel'));
    }

    public function test_mrz_filler_misread_as_letters_is_not_taken_for_a_name(): void
    {
        $mrz = str_replace('ERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<<<CKKKKKKK', self::PASSPORT_MRZ);

        $read = $this->reader()->readText($mrz);

        $this->assertSame('Anna Maria Eriksson', $this->value($read, 'employeeName'));
    }

    public function test_nothing_is_made_up_for_a_paper_that_says_nothing(): void
    {
        $read = $this->reader()->readText("a blank page\nwith nothing on it", '', 'civilId');

        $this->assertSame('civilId', $read['typeKey']);
        $this->assertSame([], $read['fields']);
    }

    public function test_the_endpoint_reads_the_five_papers_without_ai_and_says_when_ocr_is_missing(): void
    {
        Http::fake();
        config(['services.gemini.key' => 'test-key']);
        $this->app->instance(TextExtractor::class, new class extends TextExtractor
        {
            public function extract(UploadedFile $file): array
            {
                return ['text' => "PASSPORT\n".StandardPaperReaderTest::mrz(), 'mrzText' => '', 'method' => 'ocr'];
            }
        });

        $this->as('admin')->post($this->api('employees/papers/read'), ['file' => UploadedFile::fake()->image('passport.jpg')], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.available', true)
            ->assertJsonPath('data.typeKey', 'passport')
            ->assertJsonPath('data.engine', 'standard')
            ->assertJsonPath('data.method', 'ocr')
            ->assertJsonPath('data.fields.passportNumber.value', 'L898902C3');
        // Read without the AI, though one is connected.
        Http::assertNothingSent();

        $this->app->instance(TextExtractor::class, new class extends TextExtractor
        {
            public function extract(UploadedFile $file): array
            {
                throw new OcrUnavailable('tesseract is not installed on the server.');
            }
        });
        $this->as('admin')->post($this->api('employees/papers/read'), ['file' => UploadedFile::fake()->image('id.jpg'), 'typeKey' => 'civilId'], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('message', fn ($message) => str_contains($message, 'not set up on the server'));
    }

    public static function mrz(): string
    {
        return self::PASSPORT_MRZ;
    }
}
