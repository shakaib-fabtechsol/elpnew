<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ai\AiUnavailable;
use App\Services\Documents\EmployeePaperReader;
use App\Services\Permissions\Access;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * POST /employees/papers/read
 *
 * Document Intake on Add Employee: one uploaded paper read by AI into the
 * fields of the record, for the person adding the employee to review. The
 * file is read and let go - it is filed with the employee only when the
 * record is saved.
 *
 * With no AI connected the answer says so (`available: false`) and the
 * screen falls back to its sample reading, marked as one.
 */
class EmployeePaperController extends Controller
{
    public function __invoke(Request $request, EmployeePaperReader $reader): JsonResponse
    {
        abort_unless(Access::allows($request->user(), 'employees.create', 'employees.edit'), 403);
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
            'typeKey' => ['nullable', Rule::in(EmployeePaperReader::TYPES)],
        ]);

        if (! $reader->available()) {
            return response()->json(['data' => ['available' => false]]);
        }

        try {
            $read = $reader->read($request->file('file'), $data['typeKey'] ?? null);
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
