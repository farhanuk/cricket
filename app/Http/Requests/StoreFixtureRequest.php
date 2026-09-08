<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreFixtureRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'opponent' => ['required', 'string', 'max:255'],
            'played_at' => ['nullable', 'date'],
            'venue' => ['nullable', 'string', 'max:255'],
            'overs' => ['required', 'integer', 'min:1', 'max:50'],
            'balls_per_over' => ['required', 'integer', 'min:1', 'max:12'],
        ];
    }
}
