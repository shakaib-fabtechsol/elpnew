<?php

namespace App\Services\Requests;

use RuntimeException;

/** The AI service could not be reached or answered with something unusable. */
class InterpreterUnavailable extends RuntimeException {}
