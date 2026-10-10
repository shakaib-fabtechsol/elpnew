<?php

namespace App\Services\Invoices;

use App\Models\EntitlementRequest;
use App\Models\Supplier;
use Carbon\CarbonImmutable;

/**
 * The checks a read invoice goes through against what is on record. These
 * run for real today; only the reading is a demo.
 *
 * - The same invoice number claimed before, by anyone           -> high risk
 * - Medical: the same medication / service this employee claimed -> high risk
 * - VAT that does not add up to 0% or Oman's 5%                  -> high risk
 * - An invoice more than 90 days old                             -> high risk
 * - A supplier the firm has not registered -> noted; registered on submit
 *
 * "high" shows red to management, "low" green.
 */
final class InvoiceRiskChecker
{
    public const MAX_AGE_DAYS = 90;

    public function check(array $invoice, string $kind, int $employeeId, ?int $exceptId = null): array
    {
        $reasons = [];
        $notes = [];

        $sameNumber = EntitlementRequest::query()
            ->with('employee:id,name')
            ->whereRaw('lower(invoice_no) = ?', [mb_strtolower((string) $invoice['invoiceNo'])])
            ->when($exceptId, fn ($q) => $q->whereKeyNot($exceptId))
            ->whereNotIn('status', ['Rejected', 'Cancelled'])
            ->first();

        if ($sameNumber) {
            $reasons[] = 'Duplicate invoice number '.$invoice['invoiceNo'].' - already claimed in '
                .($sameNumber->entitlement_no ?: $sameNumber->request_no)
                .($sameNumber->employee_id !== $employeeId ? ' by '.$sameNumber->employee->name : '').'.';
        }

        $repeated = [];
        if ($kind === 'medical') {
            $earlier = EntitlementRequest::query()
                ->where('employee_id', $employeeId)
                ->where('kind', 'medical')
                ->whereNotNull('invoice')
                ->when($exceptId, fn ($q) => $q->whereKeyNot($exceptId))
                ->when($sameNumber, fn ($q) => $q->whereKeyNot($sameNumber->id))
                ->whereNotIn('status', ['Rejected', 'Cancelled'])
                ->orderByDesc('request_date')
                ->get();

            foreach ($invoice['items'] as $item) {
                $key = self::itemKey($item['name']);
                $before = $earlier->first(fn ($row) => collect($row->invoice['items'] ?? [])->contains(fn ($old) => self::itemKey($old['name']) === $key));
                if ($before) {
                    $repeated[] = ['item' => $item['name'], 'requestNo' => $before->entitlement_no ?: $before->request_no, 'date' => $before->request_date->format('Y-m-d')];
                    $reasons[] = 'Same medication claimed before: '.$item['name'].' (in '.($before->entitlement_no ?: $before->request_no).').';
                }
            }
        }

        $subtotal = (float) $invoice['subtotal'];
        $vat = (float) $invoice['vat'];
        $rate = $subtotal ? $vat / $subtotal : 0;
        $validRate = abs($rate) < 0.001 || abs($rate - DemoInvoiceReader::VAT_RATE) < 0.001;
        if (abs(round($subtotal + $vat, 3) - (float) $invoice['total']) > 0.01 || ! $validRate) {
            $reasons[] = 'VAT and total do not add up to a valid VAT rate.';
        }

        $age = CarbonImmutable::parse($invoice['invoiceDate'])->diffInDays(CarbonImmutable::today(), false);
        if ($age > self::MAX_AGE_DAYS) {
            $reasons[] = 'Invoice is more than '.self::MAX_AGE_DAYS.' days old.';
        }

        $supplier = Supplier::matching($invoice['supplierVat'] ?? null, $invoice['supplierName']);
        if (! $supplier) {
            $notes[] = 'New supplier - will be registered automatically with its VAT number.';
        }

        return [
            'level' => $reasons ? 'high' : 'low',
            'reasons' => $reasons,
            'notes' => $notes,
            'repeated' => $repeated,
            'duplicateOf' => $sameNumber ? ($sameNumber->entitlement_no ?: $sameNumber->request_no) : '',
            'supplier' => $supplier ? ['id' => $supplier->id, 'supplierNo' => $supplier->supplier_no, 'name' => $supplier->name, 'vatNumber' => $supplier->vat_number] : null,
        ];
    }

    /** The words a line is known by: "Augmentin 625mg (14 tablets)" -> "augmentin 625mg". */
    public static function itemKey(string $name): string
    {
        $plain = preg_replace('/\(.*?\)/', '', mb_strtolower($name));
        $plain = trim(preg_replace('/[^a-z0-9]+/', ' ', $plain));

        return implode(' ', array_slice(explode(' ', $plain), 0, 2));
    }
}
