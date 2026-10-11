<?php

namespace App\Services\Invoices;

use Illuminate\Http\UploadedFile;

/**
 * Reads an uploaded invoice: number, date, supplier (with VAT number), what it
 * was for, its lines and totals, and how sure the reading is of each.
 *
 * AiInvoiceReader sends the file to the AI model; DemoInvoiceReader stands in
 * when no AI service is connected. Which is used is decided in
 * AppServiceProvider - the checks and the API are the same for both.
 */
interface InvoiceReader
{
    /**
     * @param  string  $kind  medical | travel | airTicket | transport
     * @param  array<string, mixed>|null  $previous  the employee's last invoice of this kind, if any
     * @return array{invoiceNo:string, invoiceDate:string, supplierName:string, supplierVat:?string, supplierCr:?string, supplierPhone:?string, supplierCategory:?string, purpose:string, items:list<array{name:string, quantity:float, amount:float}>, subtotal:float, vat:float, total:float, confidence:array<string,int>, fileName:string}
     */
    public function read(UploadedFile $file, string $kind, ?array $previous = null): array;
}
