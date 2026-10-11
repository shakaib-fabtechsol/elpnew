<?php

namespace App\Services\Invoices;

use RuntimeException;

/** The file could not be read as an invoice; the message is for the employee. */
class InvoiceUnreadable extends RuntimeException {}
