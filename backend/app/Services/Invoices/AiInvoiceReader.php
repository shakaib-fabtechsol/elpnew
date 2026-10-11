<?php

namespace App\Services\Invoices;

use App\Services\Ai\AiClient;
use App\Services\Ai\AiUnavailable;
use App\Services\Ai\Schema;
use Illuminate\Http\UploadedFile;

/**
 * The real reader: the uploaded invoice goes to the AI model, which returns
 * what is printed on it - number, date, supplier, each line, the totals - and
 * how sure it is of each. Nothing is made up: a file that is not an invoice,
 * or cannot be read, is refused rather than filled in.
 */
class AiInvoiceReader implements InvoiceReader
{
    private const CATEGORIES = ['Medical', 'Utilities', 'Telecommunications', 'Travel', 'Transport', 'Other'];

    public function __construct(private AiClient $ai) {}

    public function read(UploadedFile $file, string $kind, ?array $previous = null): array
    {
        try {
            $answer = $this->ai->json($this->instructions($kind), 'Read the attached document.', $this->schema(), $file);
        } catch (AiUnavailable $down) {
            throw new InvoiceUnreadable($down->getCode() === 429
                ? 'The AI usage limit has been reached for now. Please try again in a few minutes.'
                : 'The invoice could not be read right now. Please try again in a moment.', 0, $down);
        }

        $items = [];
        foreach ((array) ($answer['items'] ?? []) as $item) {
            if (blank($item['name'] ?? null) || ! is_numeric($item['amount'] ?? null)) {
                continue;
            }
            $items[] = [
                'name' => mb_substr((string) $item['name'], 0, 255),
                'quantity' => is_numeric($item['quantity'] ?? null) && $item['quantity'] > 0 ? (float) $item['quantity'] : 1.0,
                'amount' => round((float) $item['amount'], 3),
            ];
        }

        $total = round((float) ($answer['total'] ?? 0), 3);
        if (! ($answer['isInvoice'] ?? false) || blank($answer['invoiceNo'] ?? null) || blank($answer['supplierName'] ?? null) || ! $items || $total <= 0) {
            throw new InvoiceUnreadable('This file could not be read as an invoice. Upload a clear copy of the invoice (PDF or photo) showing its number, the supplier and the total.');
        }

        $vat = round((float) ($answer['vat'] ?? 0), 3);
        $date = (string) ($answer['invoiceDate'] ?? '');
        $percent = fn (string $key) => max(0, min(100, (int) round((float) ($answer['confidence'][$key] ?? 0))));

        return [
            'supplierName' => mb_substr((string) $answer['supplierName'], 0, 255),
            'supplierVat' => filled($answer['supplierVat'] ?? null) ? mb_substr((string) $answer['supplierVat'], 0, 30) : null,
            'supplierCr' => filled($answer['supplierCr'] ?? null) ? mb_substr((string) $answer['supplierCr'], 0, 30) : null,
            'supplierPhone' => filled($answer['supplierPhone'] ?? null) ? mb_substr((string) $answer['supplierPhone'], 0, 30) : null,
            'supplierCategory' => in_array($answer['supplierCategory'] ?? null, self::CATEGORIES, true) ? $answer['supplierCategory'] : ($kind === 'medical' ? 'Medical' : 'Other'),
            'invoiceNo' => mb_substr((string) $answer['invoiceNo'], 0, 60),
            // A date that is missing, malformed or in the future is not one
            // an invoice already paid can carry: today stands in for it.
            'invoiceDate' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) && $date <= now()->format('Y-m-d') ? $date : now()->format('Y-m-d'),
            'purpose' => mb_substr((string) ($answer['purpose'] ?? ''), 0, 255),
            'items' => $items,
            // The totals as printed; where the invoice prints no subtotal it
            // is what is left of the total once the VAT is taken off.
            'subtotal' => is_numeric($answer['subtotal'] ?? null) ? round((float) $answer['subtotal'], 3) : round($total - $vat, 3),
            'vat' => $vat,
            'total' => $total,
            'confidence' => [
                'invoiceNo' => $percent('invoiceNo'), 'supplier' => $percent('supplier'), 'amount' => $percent('amount'),
                'vat' => $percent('vat'), 'purpose' => $percent('purpose'), 'date' => $percent('date'),
            ],
            'fileName' => $file->getClientOriginalName(),
        ];
    }

    private function instructions(string $kind): string
    {
        $expected = [
            'medical' => 'a medical invoice (pharmacy, clinic, hospital, dental)',
            'travel' => 'a work-travel invoice (hotel, meals away)',
            'airTicket' => 'a flight ticket or its receipt',
            'transport' => 'a local transport receipt (fuel, taxi)',
        ][$kind] ?? 'an invoice';
        $today = now()->format('Y-m-d');

        return <<<TEXT
        You read invoices and receipts submitted by employees of a law firm in Oman for reimbursement. Today is {$today}. Amounts are in Omani rials (OMR), which have three decimals.
        The employee says this document is {$expected}.

        Rules:
        - Copy exactly what is printed. Never invent or correct a number, a date or a name. If something is not printed, return null for it.
        - "isInvoice" is false when the document is not an invoice or receipt at all, or is too unclear to read; then the other fields may be null.
        - invoiceDate is YYYY-MM-DD.
        - supplierVat is the supplier's VAT / tax registration number; supplierCr its commercial registration number; supplierPhone its phone number.
        - items: one entry per printed line, with its name, quantity (1 if not printed) and the amount of ONE unit (not the line total).
        - subtotal is the amount before VAT, vat the VAT amount, total the amount paid - each as printed.
        - purpose is a short English description of what the invoice is for (at most ten words).
        - supplierCategory is the best fit from the list.
        - confidence gives, for each of invoiceNo, supplier, amount, vat, purpose and date, how sure you are of your reading from 0 to 100. Use a low figure for anything blurred, handwritten, cut off or guessed.
        TEXT;
    }

    private function schema(): array
    {
        return Schema::object([
            'isInvoice' => Schema::boolean(),
            'invoiceNo' => Schema::string(nullable: true),
            'invoiceDate' => Schema::string(nullable: true),
            'supplierName' => Schema::string(nullable: true),
            'supplierVat' => Schema::string(nullable: true),
            'supplierCr' => Schema::string(nullable: true),
            'supplierPhone' => Schema::string(nullable: true),
            'supplierCategory' => Schema::string(nullable: true, enum: self::CATEGORIES),
            'purpose' => Schema::string(nullable: true),
            'items' => Schema::list(Schema::object([
                'name' => Schema::string(),
                'quantity' => Schema::number(),
                'amount' => Schema::number(),
            ])),
            'subtotal' => Schema::number(nullable: true),
            'vat' => Schema::number(nullable: true),
            'total' => Schema::number(nullable: true),
            'confidence' => Schema::object([
                'invoiceNo' => Schema::number(), 'supplier' => Schema::number(), 'amount' => Schema::number(),
                'vat' => Schema::number(), 'purpose' => Schema::number(), 'date' => Schema::number(),
            ]),
        ]);
    }
}
