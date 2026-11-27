<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ai\AiUnavailable;
use App\Services\Documents\EmployeePaperReader;
use App\Services\Documents\Standard\OcrUnavailable;
use App\Services\Documents\Standard\StandardPaperReader;
use App\Services\Permissions\Access;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

/**
 * POST /employees/papers/read
 *
 * Document Intake on Add Employee: one uploaded paper read into the fields of
 * the record, for the person adding the employee to review, change and save.
 * The file is read and let go - it is filed with the employee only when the
 * record is saved.
 *
 * The Civil ID, passport, lawyer card, employment contract and CV - and a
 * paper uploaded without saying which it is - are read the standard way:
 * PDF text or OCR, the passport's machine-readable zone, and rules
 * (StandardPaperReader). Other papers (a degree, a bank letter) are read by
 * AI where one is connected, and otherwise filed with nothing filled in.
 */
class EmployeePaperController extends Controller
{
    public function __invoke(Request $request, StandardPaperReader $standard, EmployeePaperReader $ai): JsonResponse
    {
        abort_unless(Access::allows($request->user(), 'employees.create', 'employees.edit'), 403);
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
            'typeKey' => ['nullable', Rule::in(EmployeePaperReader::TYPES)],
        ]);
        $typeKey = $data['typeKey'] ?? null;
        $file = $request->file('file');

        try {
            if ($typeKey === null || StandardPaperReader::reads($typeKey)) {
                $read = $standard->read($file, $typeKey);
            } elseif ($ai->available()) {
                $read = $ai->read($file, $typeKey);
            } else {
                $read = ['typeKey' => $typeKey, 'fields' => [], 'qualification' => null, 'engine' => 'none'];
            }
        } catch (OcrUnavailable $missing) {
            Log::warning('Paper reading unavailable', ['reason' => $missing->getMessage()]);

            return response()->json(['message' => 'Document reading is not set up on the server yet. Fill the fields in by hand for now.'], 422);
        } catch (AiUnavailable $down) {
            return response()->json(['message' => $down->getCode() === 429
                ? 'The AI usage limit has been reached for now. Try this paper again in a few minutes, or fill the fields in by hand.'
                : 'This paper could not be read right now. Try it again, or fill the fields in by hand.'], 422);
        }

        // Somebody already on file with this civil ID is said now, not at the last step.
        $existing = EmployeePaperReader::alreadyOnFile($read['fields']['civilId']['value'] ?? null);

        return response()->json(['data' => [
            'available' => true,
            ...$read,
            'duplicateOf' => $existing ? ['id' => $existing->id, 'empNo' => $existing->emp_no, 'name' => $existing->name] : null,
        ]]);
    }
}
