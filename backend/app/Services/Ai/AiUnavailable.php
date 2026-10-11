<?php

namespace App\Services\Ai;

use RuntimeException;

/**
 * The AI service could not be asked, or answered with something unusable.
 * The code is the HTTP status where there was one: 429 is the usage limit,
 * 0 means no AI service is switched on at all.
 */
class AiUnavailable extends RuntimeException {}
