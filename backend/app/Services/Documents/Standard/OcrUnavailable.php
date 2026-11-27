<?php

namespace App\Services\Documents\Standard;

use RuntimeException;

/** The programs that read a paper (Tesseract, poppler) are missing or failed. */
final class OcrUnavailable extends RuntimeException {}
