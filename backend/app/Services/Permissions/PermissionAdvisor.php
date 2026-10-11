<?php

namespace App\Services\Permissions;

use App\Models\Employee;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiUnavailable;
use App\Services\Ai\Schema;

/**
 * The AI side of System Permissions: an instruction in plain words ("give
 * her read-only access to payroll for two weeks", "set him up as a junior
 * accountant") turned into a concrete change to the permissions.
 *
 * It proposes and nothing more. The proposal is shown on the page, checked
 * against the catalogue here (a permission that does not exist is dropped)
 * and saved only when the administrator saves it.
 *
 * With no key, or when the service does not answer, plain rules read the
 * instruction instead and the answer says so.
 */
final class PermissionAdvisor
{
    public function __construct(private AiClient $ai) {}

    /**
     * @param  array{template:string,grants:list<string>,scope:string,departments:list<string>,approvalLimit:?float,paymentLimit:?float}  $state
     * @return array{engine:string,explanation:string,grant:list<string>,revoke:list<string>,scope:?string,departments:?list<string>,approvalLimit:mixed,paymentLimit:mixed,setLimits:list<string>,temporaryDays:?int,notes:list<string>}
     */
    public function advise(Employee $employee, array $state, ?string $instruction): array
    {
        $instruction = trim((string) $instruction);
        $notes = [];

        if ($this->ai->available()) {
            try {
                return $this->checked($this->ask($employee, $state, $instruction), $state, $this->ai->engine(), $notes);
            } catch (AiUnavailable $down) {
                $notes[] = $down->getCode() === 429
                    ? 'The AI usage limit has been reached for now, so the instruction was read with basic rules.'
                    : 'The AI service could not be reached, so the instruction was read with basic rules.';
            }
        } else {
            $notes[] = 'AI is not switched on, so the instruction was read with basic rules.';
        }

        return $this->checked($this->rules($employee, $state, $instruction), $state, 'rules', $notes);
    }

    /** Only real permissions, and only actual changes, come back. */
    private function checked(array $answer, array $state, string $engine, array $notes): array
    {
        $grant = array_values(array_diff(PermissionCatalog::clean($answer['grant'] ?? []), $state['grants']));
        $revoke = array_values(array_intersect(PermissionCatalog::clean($answer['revoke'] ?? []), $state['grants']));
        $scope = isset(PermissionCatalog::SCOPES[$answer['scope'] ?? '']) ? $answer['scope'] : null;
        $departments = is_array($answer['departments'] ?? null)
            ? array_values(array_intersect(PermissionCatalog::departments(), $answer['departments']))
            : null;
        $days = (int) ($answer['temporaryDays'] ?? 0);

        // A limit is only changed when the answer says so: null alone would
        // read as "remove the ceiling".
        $setLimits = array_values(array_intersect(['approvalLimit', 'paymentLimit'], $answer['setLimits'] ?? []));
        $money = fn (string $key) => in_array($key, $setLimits, true) && is_numeric($answer[$key] ?? null) ? round((float) $answer[$key], 3) : null;

        // Asked for something they already have (or do not have to lose).
        $asked = ($answer['grant'] ?? []) || ($answer['revoke'] ?? []);
        $nothing = $asked && ! $grant && ! $revoke && ! $setLimits && ($scope === null || $scope === $state['scope']);

        return [
            'engine' => $engine,
            'explanation' => $nothing
                ? 'Nothing to change: this employee already has exactly that.'
                : mb_substr(trim((string) ($answer['explanation'] ?? '')), 0, 600),
            'grant' => $grant,
            'revoke' => $revoke,
            'scope' => $scope !== $state['scope'] ? $scope : null,
            'departments' => $departments ?: null,
            'approvalLimit' => $money('approvalLimit'),
            'paymentLimit' => $money('paymentLimit'),
            'setLimits' => $setLimits,
            'temporaryDays' => $days > 0 ? min($days, 365) : null,
            'notes' => $notes,
        ];
    }

    private function ask(Employee $employee, array $state, string $instruction): array
    {
        $catalogue = '';
        foreach (PermissionCatalog::groups() as $group) {
            $catalogue .= $group['label'].":\n";
            foreach ($group['modules'] as $module) {
                $catalogue .= '- '.$module['key'].' ('.$module['label'].': '.$module['note'].') actions: '.implode(', ', $module['actions'])."\n";
            }
        }
        $templates = '';
        foreach (PermissionCatalog::TEMPLATES as $key => $label) {
            $templates .= '- '.$label.': '.implode(', ', PermissionCatalog::template($key)['grants'])."\n";
        }
        $departments = implode(', ', PermissionCatalog::departments());

        $system = <<<TEXT
        You help the administrator of SADEED, the management system of a law firm in Oman, set one employee's system permissions.
        A permission is "module.action". These are the only ones that exist:
        {$catalogue}
        Record access ("scope") is one of: own (their own records only), department (people in chosen departments), all (every employee). Departments: {$departments}.
        approvalLimit and paymentLimit are the most the employee may approve or pay on a single request, in OMR.

        The usual starting points:
        {$templates}
        Rules:
        - Give the least access that does the job the administrator describes. Never add something that was not asked for or clearly needed for it.
        - Keep duties separate: do not let one person both approve and pay the same module unless told to in so many words.
        - "grant" lists permissions to add, "revoke" permissions to remove; leave out anything that does not change.
        - Change scope, departments or a limit only if the instruction calls for it. List the limits you are changing in "setLimits"; to remove a limit, list it there and give null.
        - If the access is meant for a limited time ("for two weeks", "until he is back"), put the number of days in temporaryDays and list the permissions in "grant"; otherwise leave temporaryDays null.
        - With no instruction, recommend the right permissions for this employee's job and department.
        - "explanation" tells the administrator, in two or three plain English sentences, what you changed and why, and names any risk they should know about.
        TEXT;

        $current = json_encode([
            'employee' => ['occupation' => $employee->occupation, 'department' => $employee->department, 'jobLevel' => $employee->job_level, 'position' => $employee->position],
            'template' => $state['template'], 'grants' => $state['grants'], 'scope' => $state['scope'], 'departments' => $state['departments'],
            'approvalLimit' => $state['approvalLimit'], 'paymentLimit' => $state['paymentLimit'],
        ], JSON_UNESCAPED_UNICODE);

        return $this->ai->json(
            $system,
            "The employee's permissions now:\n{$current}\n\nThe administrator's instruction:\n".($instruction !== '' ? $instruction : '(none - recommend the right set for this job)'),
            Schema::object([
                'explanation' => Schema::string(),
                'grant' => Schema::list(Schema::string(enum: PermissionCatalog::keys())),
                'revoke' => Schema::list(Schema::string(enum: PermissionCatalog::keys())),
                'scope' => Schema::string(nullable: true, enum: array_keys(PermissionCatalog::SCOPES)),
                'departments' => Schema::list(Schema::string(enum: PermissionCatalog::departments())),
                'approvalLimit' => Schema::number(nullable: true),
                'paymentLimit' => Schema::number(nullable: true),
                'setLimits' => Schema::list(Schema::string(enum: ['approvalLimit', 'paymentLimit'])),
                'temporaryDays' => Schema::number(nullable: true),
            ]),
        );
    }

    /** Without AI: a template named outright, or modules and actions named in the instruction. */
    private function rules(Employee $employee, array $state, string $instruction): array
    {
        $plain = mb_strtolower($instruction);

        if ($plain === '') {
            $template = Access::templateFor($employee);
            $wanted = PermissionCatalog::template($template);

            return [
                'explanation' => 'Recommended from the '.PermissionCatalog::TEMPLATES[$template].' starting point, which fits this employee\'s job ('.($employee->occupation ?: 'not stated').').',
                'grant' => $wanted['grants'],
                'revoke' => array_values(array_diff($state['grants'], $wanted['grants'])),
                'scope' => $wanted['scope'],
            ];
        }

        foreach (PermissionCatalog::TEMPLATES as $key => $label) {
            $name = mb_strtolower(explode(' ', str_replace(['/', '('], ' ', $label))[0]);
            if (preg_match('/\b(as|like|same as|template)\b.*\b'.preg_quote($name, '/').'/', $plain)) {
                $wanted = PermissionCatalog::template($key);

                return [
                    'explanation' => 'Set from the '.$label.' starting point.',
                    'grant' => $wanted['grants'],
                    'revoke' => array_values(array_diff($state['grants'], $wanted['grants'])),
                    'scope' => $wanted['scope'],
                ];
            }
        }

        // The modules and the actions the instruction names.
        $modules = [];
        foreach (PermissionCatalog::modules() as $module => [$label]) {
            $words = array_filter(preg_split('/[^a-z]+/', mb_strtolower($label)), fn ($word) => strlen($word) > 3 && ! in_array($word, ['requests', 'records', 'details', 'information', 'system'], true));
            foreach ($words as $word) {
                if (str_contains($plain, rtrim($word, 's'))) {
                    $modules[] = $module;
                    break;
                }
            }
        }
        $readOnly = (bool) preg_match('/read[- ]only|view[- ]only|only (see|view|read)/', $plain);
        $actions = $readOnly ? ['view'] : array_values(array_filter(array_keys(PermissionCatalog::ACTIONS), fn ($action) => str_contains($plain, $action)));
        if (preg_match('/\bfull\b|\ball access\b|everything/', $plain)) {
            $actions = array_keys(PermissionCatalog::ACTIONS);
        }
        if (preg_match('/\b(see|read|access)\b/', $plain) && ! $actions) {
            $actions = ['view'];
        }

        $keys = [];
        foreach ($modules as $module) {
            foreach ($actions as $action) {
                $keys[] = $module.'.'.$action;
            }
        }
        $keys = PermissionCatalog::clean($keys);
        $removing = (bool) preg_match('/\b(remove|revoke|take away|no longer|stop|deny|withdraw)\b/', $plain);

        $days = null;
        if (preg_match('/(\d+)\s*(day|week|month)/', $plain, $m)) {
            $days = (int) $m[1] * ['day' => 1, 'week' => 7, 'month' => 30][$m[2]];
        }

        $answer = [
            'grant' => $removing ? [] : $keys,
            // "Read-only" also takes away whatever else they held there.
            'revoke' => $removing ? $keys : ($readOnly ? array_values(array_filter($state['grants'], fn ($key) => in_array(explode('.', $key)[0], $modules, true) && ! str_ends_with($key, '.view'))) : []),
            'temporaryDays' => $removing ? null : $days,
            'setLimits' => [],
        ];

        if (preg_match('/(approval|approve)[a-z ]*limit[a-z ]*?([\d,]+(?:\.\d+)?)/', $plain, $m)) {
            $answer['approvalLimit'] = (float) str_replace(',', '', $m[2]);
            $answer['setLimits'][] = 'approvalLimit';
        }
        if (preg_match('/(payment|pay)[a-z ]*limit[a-z ]*?([\d,]+(?:\.\d+)?)/', $plain, $m)) {
            $answer['paymentLimit'] = (float) str_replace(',', '', $m[2]);
            $answer['setLimits'][] = 'paymentLimit';
        }

        $changed = $keys || $answer['setLimits'];
        $answer['explanation'] = $changed
            ? ($keys ? ($removing ? 'Removes' : 'Adds').' what the instruction names' : 'Sets the limit given').($days && ! $removing ? ' for '.$days.' days' : '').($keys && $answer['setLimits'] ? ', and sets the limit given' : '').'. Check it before saving.'
            : 'Nothing in the instruction could be matched to a module or an action. Name the module and what they should be able to do - for example "view and approve leave requests".';

        return $answer;
    }
}
