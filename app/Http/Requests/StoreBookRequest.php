<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreBookRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'author' => ['nullable', 'string', 'max:255'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'cover' => ['nullable', 'string'],  // ← base64 dataURL
            'file' => [
                'required',
                'file',
                'mimetypes:application/pdf',
                'max:102400',
            ],
            'pdf_metadata' => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.mimetypes' => 'Можно загружать только PDF-файлы.',
            'file.max' => 'Файл слишком большой (максимум 100 МБ).',
        ];
    }
}