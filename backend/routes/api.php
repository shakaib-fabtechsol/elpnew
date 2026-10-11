<?php

use App\Http\Controllers\Api\AiOverviewController;
use App\Http\Controllers\Api\AiSearchController;
use App\Http\Controllers\Api\AssistanceRequestController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BonusController;
use App\Http\Controllers\Api\CircularController;
use App\Http\Controllers\Api\CommissionController;
use App\Http\Controllers\Api\CorrectionRequestController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\EmployeeDocumentController;
use App\Http\Controllers\Api\EntitlementRequestController;
use App\Http\Controllers\Api\FirmBankAccountController;
use App\Http\Controllers\Api\GeneralRequestController;
use App\Http\Controllers\Api\InvoiceAnalysisController;
use App\Http\Controllers\Api\LeaveController;
use App\Http\Controllers\Api\LoanController;
use App\Http\Controllers\Api\LookupController;
use App\Http\Controllers\Api\SalaryAdvanceController;
use App\Http\Controllers\Api\SalaryPaymentController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\UnifiedRequestController;
use App\Http\Controllers\Api\ViolationController;
use Illuminate\Support\Facades\Route;

/*
| SADEED API v1. Every route but sign-in needs a Sanctum token:
|   Authorization: Bearer <token>
*/

Route::prefix('v1')->group(function () {
    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('lookups', LookupController::class);

        /* ----------------------------------------------- the firm's bank accounts */
        Route::get('bank-accounts', [FirmBankAccountController::class, 'index']);
        Route::post('bank-accounts', [FirmBankAccountController::class, 'store']);
        Route::patch('bank-accounts/{bankAccount}', [FirmBankAccountController::class, 'update']);

        /* ------------------------------------------------------ employees */
        Route::get('employees/next-number', [EmployeeController::class, 'nextNumber']);
        Route::get('employees/short-name', [EmployeeController::class, 'shortName']);
        Route::apiResource('employees', EmployeeController::class);
        Route::get('employees/{employee}/requests-overview', [EmployeeController::class, 'requestsOverview']);
        Route::get('employees/{employee}/leave-balance', [LeaveController::class, 'balance']);

        Route::get('employees/{employee}/documents', [EmployeeDocumentController::class, 'index']);
        Route::post('employees/{employee}/documents', [EmployeeDocumentController::class, 'store']);
        Route::get('employees/{employee}/documents/{document}/download', [EmployeeDocumentController::class, 'download']);
        Route::delete('employees/{employee}/documents/{document}', [EmployeeDocumentController::class, 'destroy']);

        Route::get('employees/{employee}/corrections', [CorrectionRequestController::class, 'index']);
        Route::post('employees/{employee}/corrections', [CorrectionRequestController::class, 'store']);
        Route::post('corrections/{correction}/decision', [CorrectionRequestController::class, 'decide']);

        /* ------------------------------------- requests on the SADEED workflow */
        $workflow = [
            'salary-advances' => SalaryAdvanceController::class,
            'loans' => LoanController::class,
            'assistance-requests' => AssistanceRequestController::class,
            'bonuses' => BonusController::class,
            'commissions' => CommissionController::class,
            'entitlements' => EntitlementRequestController::class,
        ];

        foreach ($workflow as $uri => $controller) {
            Route::get($uri, [$controller, 'index']);
            Route::post($uri, [$controller, 'store']);
            Route::get("$uri/{id}", [$controller, 'show'])->whereNumber('id');
            // POST as well as PUT: a resubmission can carry a file, and PHP
            // only reads multipart bodies on POST.
            Route::match(['put', 'post'], "$uri/{id}", [$controller, 'update'])->whereNumber('id');
            Route::delete("$uri/{id}", [$controller, 'destroy'])->whereNumber('id');
            Route::post("$uri/{id}/decision", [$controller, 'decide'])->whereNumber('id');
            Route::post("$uri/{id}/payment", [$controller, 'pay'])->whereNumber('id');
            Route::get("$uri/{id}/history", [$controller, 'history'])->whereNumber('id');
        }

        Route::post('loans/{id}/installments', [LoanController::class, 'recordInstallment'])->whereNumber('id');
        Route::post('invoices/analyze', InvoiceAnalysisController::class)->middleware('throttle:30,1');

        /* ------------------------------------ AI readings (no record is saved) */
        Route::post('ai/overview', AiOverviewController::class)->middleware('throttle:40,1');
        Route::post('ai/search', AiSearchController::class)->middleware('throttle:30,1');

        /* ------------------------------ the unified request (free text + AI) */
        Route::post('requests/interpret', [UnifiedRequestController::class, 'interpret'])->middleware('throttle:20,1');
        Route::post('requests/revise', [UnifiedRequestController::class, 'revise'])->middleware('throttle:20,1');
        Route::post('requests/retype', [UnifiedRequestController::class, 'retype']);
        Route::post('requests/submit', [UnifiedRequestController::class, 'submit']);
        Route::get('suppliers', [SupplierController::class, 'index']);

        /* ---------------------------------------------------------- leave */
        Route::get('leaves', [LeaveController::class, 'index']);
        Route::post('leaves', [LeaveController::class, 'store']);
        Route::get('leaves/{id}', [LeaveController::class, 'show'])->whereNumber('id');
        Route::match(['put', 'post'], 'leaves/{id}', [LeaveController::class, 'update'])->whereNumber('id');
        Route::delete('leaves/{id}', [LeaveController::class, 'destroy'])->whereNumber('id');
        Route::post('leaves/{id}/department-decision', [LeaveController::class, 'departmentDecision'])->whereNumber('id');
        Route::post('leaves/{id}/decision', [LeaveController::class, 'managementDecision'])->whereNumber('id');

        /* ----------------------------------------------------- violations */
        Route::get('violations', [ViolationController::class, 'index']);
        Route::post('violations', [ViolationController::class, 'store']);
        Route::get('violations/{id}', [ViolationController::class, 'show'])->whereNumber('id');
        Route::post('violations/{id}/acknowledge', [ViolationController::class, 'acknowledge'])->whereNumber('id');
        Route::post('violations/{id}/response', [ViolationController::class, 'respond'])->whereNumber('id');
        Route::post('violations/{id}/decision', [ViolationController::class, 'decide'])->whereNumber('id');
        Route::post('violations/{id}/appeal', [ViolationController::class, 'appeal'])->whereNumber('id');
        Route::post('violations/{id}/outcome', [ViolationController::class, 'outcome'])->whereNumber('id');

        /* ------------------------------ general requests / grievances / complaints */
        Route::get('general-requests', [GeneralRequestController::class, 'index']);
        Route::post('general-requests', [GeneralRequestController::class, 'store']);
        Route::get('general-requests/{id}', [GeneralRequestController::class, 'show'])->whereNumber('id');
        Route::post('general-requests/{id}/decision', [GeneralRequestController::class, 'decide'])->whereNumber('id');

        /* -------------------------------------------------------- salaries */
        Route::get('salaries', [SalaryPaymentController::class, 'index']);
        Route::post('salaries', [SalaryPaymentController::class, 'store']);
        Route::get('salaries/{id}', [SalaryPaymentController::class, 'show'])->whereNumber('id');
        Route::post('salaries/{id}/transfer', [SalaryPaymentController::class, 'transfer'])->whereNumber('id');
        Route::post('salaries/{id}/reject', [SalaryPaymentController::class, 'reject'])->whereNumber('id');

        /* ------------------------------------------------------- circulars */
        Route::get('circulars-audit', [CircularController::class, 'audit']);
        Route::get('circulars', [CircularController::class, 'index']);
        Route::post('circulars', [CircularController::class, 'store']);
        Route::get('circulars/{id}', [CircularController::class, 'show'])->whereNumber('id');
        Route::post('circulars/{id}/revise', [CircularController::class, 'revise'])->whereNumber('id');
        Route::post('circulars/{id}/cancel', [CircularController::class, 'cancel'])->whereNumber('id');
        Route::post('circulars/{id}/acknowledge', [CircularController::class, 'acknowledge'])->whereNumber('id');
    });
});
