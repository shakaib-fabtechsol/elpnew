<?php

namespace App\Http\Requests;

use App\Support\Keys;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A request body as the app sends it (camelCase), validated, then handed to
 * the model in the database's own snake_case. Authorisation is done by the
 * controller's policies, so every form request here simply passes it.
 */
abstract class ApiRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** The validated input, keyed for the database. */
    public function columns(): array
    {
        return Keys::snake($this->validated());
    }
}
