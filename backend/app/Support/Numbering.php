<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Hands out request numbers: SA-2026-00012, LNR-007, EMP-0026...
 *
 * Each series is one row in `sequences`, read and moved on inside a
 * transaction with the row locked, so two requests filed at the same moment
 * can never be given the same number - which a "highest number + 1" read off
 * the table cannot promise.
 */
final class Numbering
{
    /** The next value in a series, starting from 1. */
    public static function next(string $series): int
    {
        return DB::transaction(function () use ($series): int {
            DB::table('sequences')->insertOrIgnore(['series' => $series, 'value' => 0]);

            $current = (int) DB::table('sequences')
                ->where('series', $series)
                ->lockForUpdate()
                ->value('value');

            DB::table('sequences')->where('series', $series)->update(['value' => $current + 1]);

            return $current + 1;
        });
    }

    /** Moves a series on to at least `$value` - used by seeders after importing records. */
    public static function atLeast(string $series, int $value): void
    {
        DB::table('sequences')->insertOrIgnore(['series' => $series, 'value' => 0]);
        DB::table('sequences')
            ->where('series', $series)
            ->where('value', '<', $value)
            ->update(['value' => $value]);
    }

    /** "LNR-007": prefix, dash, the next value padded to `$width`. */
    public static function code(string $prefix, int $width = 3, ?string $series = null): string
    {
        return $prefix.'-'.str_pad((string) self::next($series ?? $prefix), $width, '0', STR_PAD_LEFT);
    }

    /** "SA-2026-00012": a run that starts again every year. */
    public static function yearly(string $prefix, int $width = 3, ?int $year = null): string
    {
        $year ??= (int) now()->format('Y');

        return $prefix.'-'.$year.'-'.str_pad((string) self::next($prefix.'-'.$year), $width, '0', STR_PAD_LEFT);
    }

    /** The number part of a code: "LNR-007" -> 7, "SA-2026-00012" -> 12. */
    public static function serialOf(?string $code): int
    {
        if (! $code || ! preg_match('/(\d+)$/', $code, $m)) {
            return 0;
        }

        return (int) $m[1];
    }
}
