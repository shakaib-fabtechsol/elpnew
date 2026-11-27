<?php

namespace App\Services\Documents\Standard;

use Illuminate\Http\UploadedFile;
use Symfony\Component\Process\Process;

/**
 * The text on an uploaded paper, without AI.
 *
 *   PDF with text in it   pdftotext (poppler), as laid out on the page
 *   scanned PDF           its first pages rendered (pdftoppm), then OCR
 *   photo / scan          OCR with Tesseract, English and Arabic
 *
 * OCR is run a second time restricted to the characters of a
 * machine-readable zone, which reads a passport's or ID card's MRZ far more
 * cleanly than the general pass does.
 *
 * The programs are set in config/services.php (ocr.*) and installed on the
 * server with: apt install tesseract-ocr tesseract-ocr-ara poppler-utils
 */
class TextExtractor
{
    /** Below this many characters a PDF is taken for a scan and read by OCR. */
    private const PDF_TEXT_MIN = 40;

    private const MRZ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

    /**
     * @return array{text:string, mrzText:string, method:string}
     *
     * @throws OcrUnavailable
     */
    public function extract(UploadedFile $file): array
    {
        $path = $file->getRealPath();
        $isPdf = $file->getMimeType() === 'application/pdf' || strtolower($file->getClientOriginalExtension()) === 'pdf';

        if ($isPdf) {
            $text = $this->pdfText($path);
            if (mb_strlen(trim($text)) >= self::PDF_TEXT_MIN) {
                return ['text' => $text, 'mrzText' => $text, 'method' => 'pdf-text'];
            }
            $images = $this->pdfPages($path);
        } else {
            $images = [$path];
        }

        $text = '';
        $mrz = '';
        try {
            foreach ($images as $image) {
                $prepared = $this->prepare($image);
                // Page mode 4 (one column of lines of any size) keeps a card's
                // label and its value on the same line, where the default
                // layout analysis splits them into two columns.
                $text .= $this->ocr($prepared, $this->languages(), 4)."\n";
                $mrz .= $this->ocr($prepared, 'eng', 6, self::MRZ_CHARS)."\n";
                if ($prepared !== $image) {
                    @unlink($prepared);
                }
            }
        } finally {
            if ($isPdf) {
                array_map(fn ($page) => @unlink($page), $images);
            }
        }

        return ['text' => $text, 'mrzText' => $mrz, 'method' => 'ocr'];
    }

    private function pdfText(string $path): string
    {
        return $this->run([config('services.ocr.pdftotext', 'pdftotext'), '-layout', '-enc', 'UTF-8', $path, '-'], 'pdftotext');
    }

    /** @return list<string> the first pages as PNG files */
    private function pdfPages(string $path): array
    {
        $prefix = tempnam(sys_get_temp_dir(), 'sadeed-page-');
        @unlink($prefix);
        $this->run([config('services.ocr.pdftoppm', 'pdftoppm'), '-r', '300', '-png', '-f', '1', '-l', '3', $path, $prefix], 'pdftoppm');

        return glob($prefix.'*.png') ?: [];
    }

    /**
     * A photo of a card made easier to read: grey, evened out, and large
     * enough that small print is several pixels tall. Left as it is when
     * Imagick is not there.
     */
    private function prepare(string $image): string
    {
        if (! class_exists(\Imagick::class)) {
            return $image;
        }
        try {
            $picture = new \Imagick($image);
            $picture->autoOrient();
            $picture->setImageColorspace(\Imagick::COLORSPACE_GRAY);
            if ($picture->getImageWidth() < 2000) {
                $scale = 2000 / max(1, $picture->getImageWidth());
                $picture->resizeImage((int) ($picture->getImageWidth() * $scale), (int) ($picture->getImageHeight() * $scale), \Imagick::FILTER_LANCZOS, 1);
            }
            $picture->normalizeImage();
            $picture->setImageFormat('png');
            $out = tempnam(sys_get_temp_dir(), 'sadeed-ocr-').'.png';
            $picture->writeImage($out);
            $picture->clear();

            return $out;
        } catch (\Throwable) {
            return $image;
        }
    }

    private function ocr(string $image, string $languages, int $pageMode, ?string $whitelist = null): string
    {
        $command = [config('services.ocr.tesseract', 'tesseract'), $image, 'stdout', '-l', $languages, '--psm', (string) $pageMode];
        if ($whitelist) {
            array_push($command, '-c', 'tessedit_char_whitelist='.$whitelist);
        }

        return $this->run($command, 'tesseract');
    }

    /** English, with Arabic as well where its language data is installed. */
    private function languages(): string
    {
        static $languages = null;
        if ($languages === null) {
            $list = $this->run([config('services.ocr.tesseract', 'tesseract'), '--list-langs'], 'tesseract');
            $languages = preg_match('/^ara$/m', $list) ? 'eng+ara' : 'eng';
        }

        return $languages;
    }

    /** @throws OcrUnavailable */
    private function run(array $command, string $program): string
    {
        $process = new Process($command, null, ['OMP_THREAD_LIMIT' => '1']);
        $process->setTimeout(60);
        try {
            $process->run();
        } catch (\Throwable $e) {
            throw new OcrUnavailable($program.' could not be run: '.$e->getMessage());
        }
        // 127: the program is not installed.
        if ($process->getExitCode() === 127 || str_contains($process->getErrorOutput(), 'not found')) {
            throw new OcrUnavailable($program.' is not installed on the server.');
        }

        return $process->getOutput();
    }
}
