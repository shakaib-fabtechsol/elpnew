<?php

namespace App\Services\Invoices;

use Illuminate\Http\UploadedFile;

/**
 * DEMO reader - there is no AI service yet. A file is read as one of a few
 * sample invoices, chosen by its name so the same file always reads the same
 * way. A file named with "dup", "duplicate" or "repeat" is read as a copy of
 * the employee's last invoice, so the duplicate alerts can be seen.
 *
 * Same samples as the app's src/pages/employees/invoiceAI.js.
 */
class DemoInvoiceReader implements InvoiceReader
{
    public const VAT_RATE = 0.05;

    private const SAMPLES = [
        'medical' => [
            ['supplier' => ['Muscat Pharmacy LLC', 'OM1100458812', '1458812', '+968 2412 5566', 'Medical'], 'invoiceNo' => 'MP-2026-08841', 'invoiceDate' => '2026-10-02', 'purpose' => 'Prescription medication', 'vatRate' => 0,
                'items' => [['Augmentin 625mg (14 tablets)', 1, 7.4], ['Panadol Extra (24 tablets)', 2, 2.4]]],
            ['supplier' => ['Starcare Hospital', 'OM1100223344', '1223344', '+968 2455 7000', 'Medical'], 'invoiceNo' => 'SC-INV-31207', 'invoiceDate' => '2026-10-04', 'purpose' => 'Outpatient consultation and blood tests', 'vatRate' => 0,
                'items' => [['Specialist consultation', 1, 35], ['Complete blood count (CBC)', 1, 12], ['Vitamin D test', 1, 18]]],
            ['supplier' => ['Al Nahda Hospital', 'OM1100778899', '1778899', '+968 2483 1255', 'Medical'], 'invoiceNo' => 'AN-55902', 'invoiceDate' => '2026-09-29', 'purpose' => 'Dental treatment', 'vatRate' => 0,
                'items' => [['Dental filling', 2, 40], ['Dental X-ray', 1, 10]]],
        ],
        'travel' => [
            ['supplier' => ['Crowne Plaza Salalah', 'OM1100665544', '1665544', '+968 2323 5333', 'Other'], 'invoiceNo' => 'CPS-77120', 'invoiceDate' => '2026-09-30', 'purpose' => 'Hotel stay for the Salalah court hearing', 'vatRate' => self::VAT_RATE,
                'items' => [['Room - 2 nights', 2, 90], ['Meals', 1, 24]]],
        ],
        'airTicket' => [
            ['supplier' => ['Oman Air', 'OM1100100100', '1100100', '+968 2453 1111', 'Other'], 'invoiceNo' => 'WY-910-2266', 'invoiceDate' => '2026-09-26', 'purpose' => 'Return ticket Muscat - Salalah', 'vatRate' => 0,
                'items' => [['Economy return ticket MCT-SLL-MCT', 1, 64]]],
        ],
        'transport' => [
            ['supplier' => ['Shell Oman Marketing', 'OM1100300300', '1300300', '+968 2457 0100', 'Other'], 'invoiceNo' => 'SHL-4418-0921', 'invoiceDate' => '2026-10-01', 'purpose' => 'Fuel for court and client visits', 'vatRate' => self::VAT_RATE,
                'items' => [['Fuel - M91', 1, 22]]],
        ],
    ];

    public function read(UploadedFile $file, string $kind, ?array $previous = null): array
    {
        $name = $file->getClientOriginalName();
        $pool = self::SAMPLES[$kind] ?? self::SAMPLES['medical'];

        if ($previous && preg_match('/dup|duplicate|repeat/i', $name)) {
            $items = $previous['items'];
            $subtotal = (float) ($previous['subtotal'] ?? 0);

            return $this->shape([
                'supplierName' => $previous['supplierName'], 'supplierVat' => $previous['supplierVat'] ?? null,
                'supplierCr' => $previous['supplierCr'] ?? null, 'supplierPhone' => $previous['supplierPhone'] ?? null, 'supplierCategory' => 'Medical',
                'invoiceNo' => $previous['invoiceNo'], 'invoiceDate' => $previous['invoiceDate'], 'purpose' => $previous['purpose'],
                'items' => $items, 'vatRate' => $subtotal ? ((float) $previous['vat']) / $subtotal : 0,
            ], $name);
        }

        $sample = $pool[$this->hash($name.$file->getSize()) % count($pool)];
        [$supplier, $vat, $cr, $phone, $category] = $sample['supplier'];

        return $this->shape([
            'supplierName' => $supplier, 'supplierVat' => $vat, 'supplierCr' => $cr, 'supplierPhone' => $phone, 'supplierCategory' => $category,
            'invoiceNo' => $sample['invoiceNo'], 'invoiceDate' => $sample['invoiceDate'], 'purpose' => $sample['purpose'],
            'items' => array_map(fn ($i) => ['name' => $i[0], 'quantity' => $i[1], 'amount' => $i[2]], $sample['items']),
            'vatRate' => $sample['vatRate'],
        ], $name);
    }

    private function shape(array $invoice, string $fileName): array
    {
        $subtotal = round(array_sum(array_map(fn ($i) => $i['amount'] * $i['quantity'], $invoice['items'])), 3);
        $vat = round($subtotal * $invoice['vatRate'], 3);
        unset($invoice['vatRate']);

        return [
            ...$invoice,
            'subtotal' => $subtotal,
            'vat' => $vat,
            'total' => round($subtotal + $vat, 3),
            // How sure the reading is of each field (demo figures).
            'confidence' => ['invoiceNo' => 98, 'supplier' => 96, 'amount' => 99, 'vat' => 97, 'purpose' => 91, 'date' => 95],
            'fileName' => $fileName,
        ];
    }

    private function hash(string $text): int
    {
        $sum = 7;
        foreach (mb_str_split($text) as $ch) {
            $sum = ($sum * 31 + mb_ord($ch)) % 100003;
        }

        return $sum;
    }
}
