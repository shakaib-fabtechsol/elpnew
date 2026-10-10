<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with the demo the app shows.
     *
     * Model events stay on: they hand out the request numbers.
     */
    public function run(): void
    {
        $this->call([
            EmployeeSeeder::class,
            FirmSeeder::class,
            RequestSeeder::class,
        ]);
    }
}
