<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/** A loan with its schedule, what has been repaid and what is still owed. */
class LoanResource extends MoneyRequestResource
{
    protected function moduleFields(Request $request): array
    {
        if (! $this->relationLoaded('payments')) {
            return [];
        }

        $rows = $this->scheduleRows();
        $today = now()->format('Y-m-d');
        $open = array_values(array_filter($rows, fn ($row) => $row['status'] !== 'Paid'));

        return [
            'total' => $this->total(),
            'installment' => $this->installment(),
            'paid' => $this->paid(),
            'remaining' => $this->remaining(),
            'start' => $this->disbursement_date?->format('Y-m-d') ?? $this->first_due?->format('Y-m-d'),
            'end' => $rows ? end($rows)['due'] : null,
            'next_installment' => $open[0] ?? null,
            'overdue' => count(array_filter($open, fn ($row) => $row['due'] < $today)),
            'schedule' => $rows,
        ];
    }
}
