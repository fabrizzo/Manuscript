<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'C++',           'slug' => 'cpp'],
            ['name' => 'C#',            'slug' => 'csharp'],
            ['name' => 'PHP',           'slug' => 'php'],
            ['name' => 'JavaScript',    'slug' => 'javascript'],
            ['name' => 'TypeScript',    'slug' => 'typescript'],
            ['name' => 'Python',        'slug' => 'python'],
            ['name' => 'Java',          'slug' => 'java'],
            ['name' => 'Go',            'slug' => 'go'],
            ['name' => 'Rust',          'slug' => 'rust'],
            ['name' => 'SQL',           'slug' => 'sql'],
            ['name' => 'Laravel',       'slug' => 'laravel'],
            ['name' => 'React',         'slug' => 'react'],
            ['name' => 'Vue',           'slug' => 'vue'],
            ['name' => 'Docker',        'slug' => 'docker'],
            ['name' => 'Linux',         'slug' => 'linux'],
            ['name' => 'Алгоритмы',     'slug' => 'algorithms'],
            ['name' => 'Архитектура',   'slug' => 'architecture'],
            ['name' => 'Базы данных',   'slug' => 'databases'],
        ];

        foreach ($categories as $cat) {
            Category::firstOrCreate(
                ['slug' => $cat['slug']],
                ['name' => $cat['name']],
            );
        }
    }
}