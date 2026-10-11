<?php

namespace App\Support;

use App\Models\Employee;

/**
 * An employee's short name: the first name and the family name, out of a
 * full name that may run to four or five.
 *
 *   Mohammed Abdullah Saeed Al Yahyai   ->  Mohammed Al Yahyai
 *   محمد عبدالله سعيد اليحيائي           ->  محمد اليحيائي
 *
 * A name is not split on spaces alone. "Al Yahyai", "bin Saeed" and "Abu
 * Bakr" are each one name, as are "Abdul Rahman" and "عبد الله": a word that
 * only introduces the next one stays with it.
 *
 * Where two people would share a short name, middle names are added back one
 * at a time until it is theirs alone - the shortest name that tells them
 * apart.
 */
final class ShortName
{
    /** Words that introduce the name after them (family, tribe or lineage). */
    private const LINKS = [
        'al', 'el', 'aal', 'bin', 'ibn', 'bint', 'ben', 'abu', 'abou', 'bu', 'bani', 'ould', 'umm',
        'van', 'von', 'de', 'da', 'di', 'del', 'della', 'der', 'den', 'ter', 'le', 'la', 'st', 'st.',
        'آل', 'ال', 'بن', 'ابن', 'بنت', 'أبو', 'ابو', 'بو', 'بني', 'ولد', 'أم', 'ام',
    ];

    /** Words that open a compound given name: Abdul Rahman, Abd Al Aziz, عبد الله. */
    private const SERVANT = ['abdul', 'abd', 'abdel', 'abdal', 'عبد'];

    /** The short name for a full name, ignoring who else may share it. */
    public static function from(?string $fullName): ?string
    {
        return self::candidates($fullName)[0] ?? null;
    }

    /**
     * The shortest form of the name nobody else is using.
     *
     * @param  string  $column  short_name or short_name_ar
     */
    public static function unique(?string $fullName, string $column = 'short_name', ?int $exceptId = null): ?string
    {
        $candidates = self::candidates($fullName);
        if (! $candidates) {
            return null;
        }

        $taken = Employee::query()
            ->when($exceptId, fn ($query) => $query->whereKeyNot($exceptId))
            ->whereNotNull($column)
            ->pluck($column)
            ->map(fn ($name) => self::key($name))
            ->flip();

        foreach ($candidates as $candidate) {
            if (! $taken->has(self::key($candidate))) {
                return $candidate;
            }
        }

        // Two people with the very same full name: nothing shorter tells
        // them apart, so it is left for somebody to settle by hand.
        return end($candidates);
    }

    /** Whoever else already goes by this short name, if anybody. */
    public static function heldBy(string $shortName, string $column = 'short_name', ?int $exceptId = null): ?Employee
    {
        return Employee::query()
            ->when($exceptId, fn ($query) => $query->whereKeyNot($exceptId))
            ->whereNotNull($column)
            ->get(['id', 'name', 'name_ar', 'emp_no', $column])
            ->first(fn (Employee $employee) => self::key($employee->{$column}) === self::key($shortName));
    }

    /**
     * Every form of the name from shortest to fullest: first and family
     * name, then with one middle name, then two, and so on.
     *
     * @return list<string>
     */
    public static function candidates(?string $fullName): array
    {
        $names = self::names($fullName);
        if (! $names) {
            return [];
        }
        if (count($names) <= 2) {
            return [implode(' ', $names)];
        }

        $first = array_shift($names);
        $family = array_pop($names);

        $candidates = [];
        for ($middle = 0; $middle <= count($names); $middle++) {
            $candidates[] = implode(' ', [$first, ...array_slice($names, 0, $middle), $family]);
        }

        return $candidates;
    }

    /**
     * The full name as the names it is made of, each kept whole:
     * ["Mohammed", "Abdullah", "Saeed", "Al Yahyai"].
     *
     * @return list<string>
     */
    private static function names(?string $fullName): array
    {
        $words = preg_split('/\s+/u', trim((string) $fullName), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $names = [];
        $carry = [];

        foreach ($words as $index => $word) {
            $carry[] = $word;
            $plain = mb_strtolower($word);
            $last = $index === count($words) - 1;

            // A word that only introduces the next one waits for it. "Abdul"
            // also waits through a following "Al": Abd Al Rahman.
            $opens = in_array($plain, self::LINKS, true)
                || (count($carry) === 1 && in_array($plain, self::SERVANT, true));

            if ($opens && ! $last) {
                continue;
            }

            $names[] = implode(' ', $carry);
            $carry = [];
        }

        return $names;
    }

    /** How two names are compared: case, spacing and hyphens aside. */
    private static function key(?string $name): string
    {
        return preg_replace('/[\s\-]+/u', ' ', mb_strtolower(trim((string) $name)));
    }
}
