/**
 * Грубая транслитерация латиницы в кириллицу.
 * Не идеальна (не заменяет "ъ", путает "y"→"ы"/"й"),
 * но покрывает ~90% типичных случаев транслита.
 */
export function transliterateToCyrillic(text: string): string {
    if (!text) return text;

    // Порядок важен: сначала многосимвольные, потом одиночные
    const rules: Array<[string, string]> = [
        // Триграфы и диграфы
        ['shch', 'щ'],
        ['sch', 'щ'],
        ['shh', 'щ'],
        ['yo', 'ё'],
        ['ya', 'я'],
        ['yu', 'ю'],
        ['ye', 'е'],
        ['zh', 'ж'],
        ['kh', 'х'],
        ['ts', 'ц'],
        ['ch', 'ч'],
        ['sh', 'ш'],
        ['ay', 'ай'],
        ['ey', 'ей'],
        ['oy', 'ой'],
        ['uy', 'уй'],
        ['iy', 'ий'],
        // Одиночные
        ['a', 'а'],
        ['b', 'б'],
        ['v', 'в'],
        ['g', 'г'],
        ['d', 'д'],
        ['e', 'е'],
        ['z', 'з'],
        ['i', 'и'],
        ['j', 'й'],
        ['k', 'к'],
        ['l', 'л'],
        ['m', 'м'],
        ['n', 'н'],
        ['o', 'о'],
        ['p', 'п'],
        ['r', 'р'],
        ['s', 'с'],
        ['t', 'т'],
        ['u', 'у'],
        ['f', 'ф'],
        ['h', 'х'],
        ['c', 'к'],
        ['y', 'ы'],
        ['w', 'в'],
        ['x', 'кс'],
        ['q', 'к'],
    ];

    let result = text;
    for (const [lat, cyr] of rules) {
        const re = new RegExp(lat, 'gi');
        result = result.replace(re, (match) => {
            // Все буквы заглавные (например, "SH" → "Ш")
            if (match === match.toUpperCase() && match.length > 1) {
                return cyr.toUpperCase();
            }
            // Первая буква заглавная (например, "Sh" → "Ш")
            if (
                match[0] === match[0].toUpperCase() &&
                match[0] !== match[0].toLowerCase()
            ) {
                return cyr[0].toUpperCase() + cyr.slice(1);
            }
            return cyr;
        });
    }
    return result;
}