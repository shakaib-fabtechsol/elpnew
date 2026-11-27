<?php

namespace App\Services\Documents\Standard;

/**
 * The machine-readable zone of a passport or an ID card (ICAO 9303), read
 * from OCR text.
 *
 *   TD3  passports       2 lines of 44 characters
 *   TD1  ID cards        3 lines of 30 characters (the back of a civil ID)
 *
 * Every number on the zone carries a check digit, so a value that passes its
 * check was read right - the reading is trusted for it, and a value that
 * fails is still returned, with a low confidence, for the person to look at.
 */
final class Mrz
{
    /** Values of a field that passed its check digit, and of one that did not. */
    public const SURE = 98;

    public const UNSURE = 55;

    /**
     * @param  string  $text  OCR text that may hold an MRZ somewhere in it
     * @return array{format:string, fields:array<string,array{value:string,confidence:int}>, valid:bool}|null
     */
    public static function find(string $text): ?array
    {
        $lines = self::candidateLines($text);

        // TD3: two consecutive lines of 44, the first starting with P.
        for ($i = 0; $i < count($lines) - 1; $i++) {
            if (strlen($lines[$i]) === 44 && strlen($lines[$i + 1]) === 44 && $lines[$i][0] === 'P') {
                return self::td3($lines[$i], $lines[$i + 1]);
            }
        }
        // TD1: three consecutive lines of 30, the first starting with I, A or C.
        for ($i = 0; $i < count($lines) - 2; $i++) {
            if (strlen($lines[$i]) === 30 && strlen($lines[$i + 1]) === 30 && strlen($lines[$i + 2]) === 30
                && in_array($lines[$i][0], ['I', 'A', 'C'], true)) {
                return self::td1($lines[$i], $lines[$i + 1], $lines[$i + 2]);
            }
        }

        return null;
    }

    /**
     * The lines that look like MRZ: spaces OCR put in dropped, the look-alikes
     * of the filler put right, and cut or padded to the length they nearly are.
     *
     * @return list<string>
     */
    public static function candidateLines(string $text): array
    {
        $out = [];
        foreach (preg_split('/\R/', strtoupper($text)) as $line) {
            $line = preg_replace('/\s+/', '', $line);
            // OCR reads the filler < as « or as K/C runs now and then.
            $line = strtr($line, ['«' => '<<', '‹' => '<', '(' => '<', '[' => '<', '{' => '<']);
            if (substr_count($line, '<') < 2 || ! preg_match('/^[A-Z0-9<]+$/', $line)) {
                continue;
            }
            $length = strlen($line);
            foreach ([44, 30] as $size) {
                if ($length >= $size - 2 && $length <= $size + 2) {
                    $line = substr(str_pad($line, $size, '<'), 0, $size);
                    break;
                }
            }
            $out[] = $line;
        }

        return $out;
    }

    /** ICAO 9303 check digit: weights 7, 3, 1; < counts 0, A-Z count 10-35. */
    public static function checkDigit(string $value): int
    {
        $weights = [7, 3, 1];
        $sum = 0;
        foreach (str_split($value) as $i => $char) {
            $n = match (true) {
                ctype_digit($char) => (int) $char,
                ctype_alpha($char) => ord($char) - 55,
                default => 0,
            };
            $sum += $n * $weights[$i % 3];
        }

        return $sum % 10;
    }

    private static function checks(string $value, string $digit): bool
    {
        // OCR reads O for 0 in a digit position.
        $digit = strtr($digit, ['O' => '0', '<' => '0']);

        return ctype_digit($digit) && self::checkDigit($value) === (int) $digit;
    }

    private static function td3(string $one, string $two): array
    {
        [$surname, $given] = self::names(substr($one, 5, 39));
        $number = substr($two, 0, 9);
        $birth = self::digits(substr($two, 13, 6));
        $expiry = self::digits(substr($two, 21, 6));

        $numberOk = self::checks($number, $two[9]);
        $birthOk = self::checks($birth, $two[19]);
        $expiryOk = self::checks($expiry, $two[27]);
        // The composite check covers the whole line, so a pass vouches for the names' line too.
        $composite = substr($two, 0, 10).substr($two, 13, 7).substr($two, 21, 22);
        $allOk = self::checks($composite, $two[43]);

        $fields = [];
        self::put($fields, 'passportNumber', rtrim($number, '<'), $numberOk);
        self::put($fields, 'employeeName', trim($given.' '.$surname), $allOk, 90);
        self::put($fields, 'nationality', Nationality::fromCode(substr($two, 10, 3)), $allOk, 90);
        self::put($fields, 'dateOfBirth', self::date($birth, past: true), $birthOk);
        self::put($fields, 'gender', self::sex($two[20]), $allOk, 90);
        self::put($fields, 'passportExpiry', self::date($expiry, past: false), $expiryOk);

        return ['format' => 'TD3', 'fields' => $fields, 'valid' => $numberOk && $birthOk && $expiryOk];
    }

    private static function td1(string $one, string $two, string $three): array
    {
        $number = substr($one, 5, 9);
        $optional = rtrim(substr($one, 15, 15), '<');
        $birth = self::digits(substr($two, 0, 6));
        $expiry = self::digits(substr($two, 8, 6));
        [$surname, $given] = self::names($three);

        $numberOk = self::checks($number, $one[14]);
        $birthOk = self::checks($birth, $two[6]);
        $expiryOk = self::checks($expiry, $two[14]);

        $fields = [];
        // On an Omani card the civil number is the optional data when it is
        // there; otherwise the document number is the one on the card.
        $civil = preg_match('/^\d{6,10}$/', $optional) ? $optional : rtrim($number, '<');
        self::put($fields, 'civilId', $civil, $numberOk, 85);
        self::put($fields, 'employeeName', trim($given.' '.$surname), $birthOk && $expiryOk, 85);
        self::put($fields, 'nationality', Nationality::fromCode(substr($two, 15, 3)), $birthOk, 85);
        self::put($fields, 'dateOfBirth', self::date($birth, past: true), $birthOk);
        self::put($fields, 'gender', self::sex($two[7]), $birthOk, 90);
        self::put($fields, 'idExpiry', self::date($expiry, past: false), $expiryOk);

        return ['format' => 'TD1', 'fields' => $fields, 'valid' => $numberOk && $birthOk && $expiryOk];
    }

    /** "ERIKSSON<<ANNA<MARIA" -> ["ERIKSSON", "ANNA MARIA"], in title case. */
    private static function names(string $zone): array
    {
        // Parts of a name are joined by one < (and surname from given names
        // by two); a name never goes on after three or more. What follows
        // such a run is filler that OCR read as letters ("<<<<CKKKKK").
        $zone = preg_replace('/<{3,}[A-Z<]*$/', '', $zone);
        $zone = rtrim($zone, '<');
        [$surname, $given] = array_pad(explode('<<', $zone, 2), 2, '');
        $clean = fn ($part) => ucwords(strtolower(trim(implode(' ', array_filter(
            explode('<', preg_replace('/[^A-Z<]/', '', $part)),
            // A "word" that is one letter over and over is misread filler.
            fn ($word) => $word !== '' && ! preg_match('/^(.)\1{2,}$/', $word)
        )))));

        return [$clean($surname), $clean($given)];
    }

    /** OCR reads O for 0 and I for 1 where only digits belong. */
    private static function digits(string $value): string
    {
        return strtr($value, ['O' => '0', 'Q' => '0', 'D' => '0', 'I' => '1', 'L' => '1', 'Z' => '2', 'S' => '5', 'B' => '8']);
    }

    /** YYMMDD as YYYY-MM-DD: a birth date is in the past, an expiry within the next 30 years. */
    private static function date(string $yymmdd, bool $past): ?string
    {
        if (! preg_match('/^(\d{2})(\d{2})(\d{2})$/', $yymmdd, $m)) {
            return null;
        }
        $year = (int) $m[1];
        $now = (int) date('y');
        $century = $past ? ($year > $now ? 1900 : 2000) : ($year > $now + 30 ? 1900 : 2000);
        $date = sprintf('%04d-%02d-%02d', $century + $year, $m[2], $m[3]);

        return checkdate((int) $m[2], (int) $m[3], $century + $year) ? $date : null;
    }

    private static function sex(string $char): ?string
    {
        return ['M' => 'Male', 'F' => 'Female'][$char] ?? null;
    }

    private static function put(array &$fields, string $key, ?string $value, bool $checked, int $sure = self::SURE): void
    {
        if ($value === null || $value === '') {
            return;
        }
        $fields[$key] = ['value' => $value, 'confidence' => $checked ? $sure : self::UNSURE];
    }
}
