<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\EmployeeResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/** Token sign-in for the React app (Sanctum personal access tokens). */
class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'deviceName' => ['nullable', 'string', 'max:100'],
        ]);

        $user = User::with('employee')->where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'The email or password is incorrect.']);
        }

        // An employee who has left cannot sign in.
        if ($user->employee && $user->employee->status === 'Inactive') {
            throw ValidationException::withMessages(['email' => 'This account is inactive. Contact the administration.']);
        }

        $token = $user->createToken($data['deviceName'] ?? 'web')->plainTextToken;

        return response()->json(['data' => ['token' => $token, 'user' => $this->profile($user)]]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->profile($request->user()->load('employee'))]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(null, 204);
    }

    private function profile(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'roleLabel' => $user->role->label(),
            'permissions' => [
                'manage' => $user->can('manage'),
                'pay' => $user->can('pay'),
                'seesEveryone' => $user->role->seesEveryone(),
            ],
            'employee' => $user->employee ? new EmployeeResource($user->employee) : null,
        ];
    }
}
