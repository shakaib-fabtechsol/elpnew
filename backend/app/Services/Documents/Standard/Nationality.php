<?php

namespace App\Services\Documents\Standard;

/**
 * A nationality as the employee form names it ("Omani", "Indian"), from the
 * three-letter code on a machine-readable zone or from the word printed on a
 * card. Only nationalities the form offers are returned; anything else is
 * left for the person to choose.
 */
final class Nationality
{
    private const CODES = [
        'OMN' => 'Omani', 'ARE' => 'Emirati', 'SAU' => 'Saudi', 'QAT' => 'Qatari', 'KWT' => 'Kuwaiti', 'BHR' => 'Bahraini',
        'IND' => 'Indian', 'PAK' => 'Pakistani', 'BGD' => 'Bangladeshi', 'LKA' => 'Sri Lankan', 'NPL' => 'Nepalese',
        'PHL' => 'Filipino', 'EGY' => 'Egyptian', 'JOR' => 'Jordanian', 'SYR' => 'Syrian', 'LBN' => 'Lebanese',
        'SDN' => 'Sudanese', 'YEM' => 'Yemeni', 'IRQ' => 'Iraqi', 'IRN' => 'Iranian', 'TUN' => 'Tunisian',
        'MAR' => 'Moroccan', 'DZA' => 'Algerian', 'GBR' => 'British', 'USA' => 'American', 'CAN' => 'Canadian',
        'AUS' => 'Australian', 'FRA' => 'French', 'DEU' => 'German', 'D<<' => 'German', 'ITA' => 'Italian',
        'ESP' => 'Spanish', 'NLD' => 'Dutch', 'IRL' => 'Irish', 'ZAF' => 'South African', 'KEN' => 'Kenyan',
        'NGA' => 'Nigerian', 'ETH' => 'Ethiopian', 'UGA' => 'Ugandan', 'TZA' => 'Tanzanian', 'IDN' => 'Indonesian',
        'MYS' => 'Malaysian', 'CHN' => 'Chinese', 'TUR' => 'Turkish', 'AFG' => 'Afghan', 'RUS' => 'Russian',
    ];

    /** Arabic words a card prints for the commonest nationalities. */
    private const ARABIC = [
        'عماني' => 'Omani', 'عمانية' => 'Omani', 'هندي' => 'Indian', 'هندية' => 'Indian', 'باكستاني' => 'Pakistani',
        'بنغلاديشي' => 'Bangladeshi', 'مصري' => 'Egyptian', 'مصرية' => 'Egyptian', 'أردني' => 'Jordanian',
        'سوداني' => 'Sudanese', 'يمني' => 'Yemeni', 'فلبيني' => 'Filipino', 'سريلانكي' => 'Sri Lankan',
    ];

    public static function fromCode(string $code): ?string
    {
        return self::CODES[strtoupper($code)] ?? null;
    }

    /** The first nationality named in free text, in English or Arabic. */
    public static function inText(string $text): ?string
    {
        foreach (array_unique(self::CODES) as $name) {
            if (preg_match('/\b'.preg_quote($name, '/').'\b/i', $text)) {
                return $name;
            }
        }
        foreach (self::ARABIC as $word => $name) {
            if (mb_strpos($text, $word) !== false) {
                return $name;
            }
        }

        return null;
    }
}
