import type { SnippetDraft, SnippetKind } from '@/types/reference';

export type ExtractionProgress = {
    page: number;
    total: number;
    snippets: number;
};

export type ExtractionResult = {
    snippets: SnippetDraft[];
    textStatus: 'ready' | 'empty';
    textPages: number;
    chars: number;
};

type Section = {
    title: string;
    page: number;
};

type ClassifiedLine = {
    kind: SnippetKind | null;
    text: string;
};

const MAX_SNIPPETS = 1500;
const MAX_BLOCK_LINES = 40;

const COMMAND_WORDS =
    'sudo|docker|docker-compose|kubectl|helm|minikube|kind|git|npm|npx|yarn|pnpm|composer|php|artisan|chmod|chown|ls|cd|mkdir|rmdir|rm|cp|mv|ps|grep|egrep|find|tar|gzip|gunzip|ssh|scp|rsync|systemctl|service|apt|apt-get|yum|dnf|pacman|useradd|usermod|groupadd|passwd|mount|umount|df|du|top|htop|kill|pkill|curl|wget|cat|echo|export|source|ln|touch|head|tail|less|more|awk|sed|sort|uniq|xargs|env|which|whoami|id|ip|ifconfig|ping|netstat|ss|openssl|journalctl|crontab|make|cmake|gcc|g\\+\\+|python|python3|pip|pip3|node|mysql|psql|sqlite3|redis-cli|mongo|mongosh|terraform|ansible|vagrant|packer';

const KNOWN_COMMAND_RE = new RegExp(`^(?:${COMMAND_WORDS})(?:\\s|$)`);
const PROMPT_RE = /^(?:\$|>)\s+\S/;
const HASH_PROMPT_RE = /^#\s+(.+)$/;
const SQL_RE =
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|EXPLAIN|ANALYZE|VACUUM|BEGIN|COMMIT|ROLLBACK|GRANT|REVOKE|TRUNCATE|COPY)\b/;
const CODE_START_RE =
    /^(?:function|class|interface|type|enum|def|async\s+def|import|from|package|namespace|using|#include|#define|const|let|var|public|private|protected|static|final|return|throw|new\s+\w+|echo|print|console\.|System\.|Console\.|fmt\.|func\s+\w+|fn\s+\w+|impl\s+\w+|struct\s+\w+|if\s*\(|for\s*\(|while\s*\(|switch\s*\(|try\s*\{|catch\s*\(|<\?php|<!DOCTYPE|<html|SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/;
const INI_SECTION_RE = /^\[[A-Za-z0-9_.-]*[A-Za-z][A-Za-z0-9_.-]*\]$/;
const KEY_VALUE_RE = /^[A-Za-z_][A-Za-z0-9_.-]{0,39}\s*=\s*\S+/;

const AMBIGUOUS_COMMANDS = new Set([
    'make',
    'find',
    'sort',
    'head',
    'tail',
    'cat',
    'echo',
    'id',
    'ip',
    'top',
    'less',
    'more',
    'source',
    'export',
    'kill',
    'curl',
    'wget',
    'node',
    'python',
    'python3',
    'php',
    'mount',
    'ping',
    'kind',
    'ssh',
    'sed',
    'awk',
    'grep',
    'which',
]);

function looksLikeCommandLine(line: string): boolean {
    const command = line
        .split(/\s+/)[0]
        .replace(/[,:;.)\]]+$/, '');
    const hasArgumentSignal =
        /(?:\s-{1,2}\w|\/|\\|\$|~|["'`]|\d|\.\w|\bartisan\b)/.test(line);

    if (!KNOWN_COMMAND_RE.test(line)) return false;
    if (line.length > 160 || /[.!?]$/.test(line)) return false;

    if (AMBIGUOUS_COMMANDS.has(command)) {
        return hasArgumentSignal;
    }

    return true;
}

function classifyLine(raw: string): SnippetKind | null {
    const line = raw.trim();
    if (!line || line.length > 240) return null;

    // Оглавления и предметные указатели с точками-выносками.
    if (/\.{4,}/.test(line) || /…\s*\d+/.test(line)) return null;

    // Строки вида «ls — содержимое каталога» — это описания, не команды.
    if (/^[A-Za-z0-9_.+-]+\s+[—–]\s+\S/.test(line)) return null;

    // «sudo, чтобы…» — проза, а не команда.
    if (/^[A-Za-z0-9_.+-]+,\s+[а-яё]/.test(line)) return null;

    // «tail с флагом…», «journalctl это…» — проза, а не команда.
    if (
        /^[A-Za-z0-9_.+-]+\s+(с|это|из|по|как|для|на|в|и|или|можно|котор|чтобы|если)\b/i.test(
            line,
        )
    ) {
        return null;
    }

    // Приглашения вида «bash-3.2$», «user@host:~$», «host:~#».
    if (/^(?=[^\s$#]*[.:~@\d-])[^\s$#]{1,40}[$#]\s+\S/.test(line)) {
        return 'command';
    }

    if (PROMPT_RE.test(line)) return 'command';

    const hash = line.match(HASH_PROMPT_RE);
    if (hash) {
        const rest = hash[1].trim();
        if (KNOWN_COMMAND_RE.test(rest)) return 'command';
        if (/^(\/|\.\/|\.\.\/)/.test(rest)) return 'command';
        return null;
    }

    if (SQL_RE.test(line)) {
        if (line === line.toUpperCase() || /[;()*,]/.test(line)) {
            return 'sql';
        }
    }

    if (INI_SECTION_RE.test(line)) return 'config';

    if (looksLikeCommandLine(line)) return 'command';

    const cyrillicWords = (line.match(/[А-Яа-яЁё]{2,}/g) || []).length;
    if (
        cyrillicWords >= 3 &&
        !CODE_START_RE.test(line) &&
        !/[={}]/.test(line)
    ) {
        return null;
    }

    const wordCount = (line.match(/[A-Za-zА-Яа-яЁё]{2,}/g) || []).length;
    if (
        wordCount >= 8 &&
        !/[={}]/.test(line) &&
        !line.includes('=>') &&
        !line.includes('->')
    ) {
        return null;
    }

    if (
        /[.!?]$/.test(line) &&
        !/[=(){}]/.test(line) &&
        !/;$/.test(line)
    ) {
        return null;
    }

    // Обрывки прозы в скобках и одиночные вызовы без контекста.
    if (/^\([^)]{0,60}\);?$/.test(line)) return null;
    if (/^[A-Za-z0-9_]+\);$/.test(line)) return null;

    if (KEY_VALUE_RE.test(line) && !/[.!?]\s/.test(line)) {
        return 'config';
    }

    if (CODE_START_RE.test(line)) return 'code';

    if (
        (line.endsWith(';') && /[=(){}\[\]]/.test(line)) ||
        line.includes('=>') ||
        line.includes('->') ||
        line.includes('</') ||
        line.includes('/>')
    ) {
        return 'code';
    }

    if (
        /^[{}]/.test(line) ||
        line === '}' ||
        (line.includes('{') && line.includes('}'))
    ) {
        return 'code';
    }

    return null;
}

function looksLikeStrongCode(line: string): boolean {
    const text = line.trim();
    return (
        CODE_START_RE.test(text) ||
        (text.endsWith(';') && /[=(){}\[\]]/.test(text)) ||
        text.includes('=>') ||
        text.includes('->') ||
        text.includes('</') ||
        text.includes('/>') ||
        /^[{}]/.test(text)
    );
}

/**
 * В книгах команда и её описание часто стоят на одной строке:
 * «rm файл Удалить файл с именем файл». Оставляем только команду.
 * Кавычки учитываем, чтобы не резать строки внутри аргументов.
 */
function splitCommandDescription(text: string): string {
    const lines = text.split('\n').map((line) => {
        let quote: string | null = null;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"' || char === "'" || char === '`') {
                if (quote === char) quote = null;
                else if (!quote) quote = char;
                continue;
            }

            if (!quote && i > 0 && /[А-ЯЁ]/.test(char)) {
                const rest = line.slice(i);
                const words = rest.match(/[А-Яа-яЁё]{2,}/g) ?? [];
                if (words.length >= 2) {
                    return line.slice(0, i).trim();
                }
            }
        }

        return line.trim();
    });

    return lines.join('\n').trim();
}

function inferLanguage(kind: SnippetKind, text: string): string {
    if (kind === 'command') return 'bash';
    if (kind === 'sql') return 'sql';
    if (kind === 'config') return 'ini';

    if (text.includes('<?php')) return 'php';
    if (text.includes('#include') || text.includes('std::')) return 'cpp';
    if (text.includes('using System') || text.includes('Console.')) return 'csharp';
    if (text.includes('def ') || text.includes('import ')) return 'python';
    if (
        text.includes('function ') ||
        text.includes('const ') ||
        text.includes('let ') ||
        text.includes('export ')
    ) {
        return 'javascript';
    }
    if (text.startsWith('SELECT') || text.startsWith('CREATE')) return 'sql';
    if (text.includes('FROM ') && text.includes('WHERE ')) return 'sql';

    return 'text';
}

/** Переводит элементы текстового слоя pdf.js в строки. */
function textContentToLines(textContent: any): string[] {
    const lines: string[] = [];
    let current = '';
    let lastY: number | null = null;

    for (const item of textContent.items ?? []) {
        if (typeof item.str !== 'string') continue;

        const y = item.transform ? Math.round(item.transform[5]) : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
            if (current.trim()) lines.push(current.replace(/\s+$/, ''));
            current = '';
        }

        current += item.str;

        if (item.hasEOL) {
            if (current.trim()) lines.push(current.replace(/\s+$/, ''));
            current = '';
        }

        lastY = y;
    }

    if (current.trim()) lines.push(current.replace(/\s+$/, ''));

    return lines;
}

async function resolveDestinationPage(
    pdf: any,
    destination: any,
): Promise<number | null> {
    try {
        const dest =
            typeof destination === 'string'
                ? await pdf.getDestination(destination)
                : destination;

        if (!Array.isArray(dest) || dest.length === 0) return null;

        const ref = dest[0];
        if (typeof ref === 'number') return ref + 1;

        const pageIndex = await pdf.getPageIndex(ref);

        return pageIndex + 1;
    } catch {
        return null;
    }
}

async function buildSections(pdf: any): Promise<Section[]> {
    try {
        const outline = await pdf.getOutline();
        if (!Array.isArray(outline) || outline.length === 0) return [];

        const sections: Section[] = [];

        const walk = async (items: any[], depth: number): Promise<void> => {
            for (const item of items) {
                if (item?.title) {
                    const page = await resolveDestinationPage(pdf, item.dest);
                    if (page) sections.push({ title: item.title, page });
                }

                if (depth < 3 && Array.isArray(item?.items)) {
                    await walk(item.items, depth + 1);
                }
            }
        };

        await walk(outline, 0);

        return sections.sort((a, b) => a.page - b.page);
    } catch {
        return [];
    }
}

function sectionForPage(sections: Section[], page: number): string | null {
    let title: string | null = null;
    for (const section of sections) {
        if (section.page <= page) title = section.title;
        else break;
    }

    return title;
}

function pushSnippet(
    snippets: SnippetDraft[],
    seen: Set<string>,
    snippet: SnippetDraft,
) {
    if (snippets.length >= MAX_SNIPPETS) return;

    const key = `${snippet.page}|${snippet.kind}|${snippet.text.replace(/\s+/g, ' ')}`;
    if (seen.has(key)) return;
    seen.add(key);
    snippets.push(snippet);
}

/**
 * Извлекает из PDF команды, код, SQL и конфиги.
 * Работает полностью в браузере через уже загруженный pdf.js.
 */
export async function extractBookSnippets(
    pdf: any,
    onProgress?: (progress: ExtractionProgress) => void,
    isCancelled?: () => boolean,
    yieldToUi = true,
): Promise<ExtractionResult | null> {
    const total = pdf.numPages;
    const snippets: SnippetDraft[] = [];
    const seen = new Set<string>();
    let textPages = 0;
    let chars = 0;

    const sections = await buildSections(pdf);

    for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
        if (isCancelled?.()) return null;

        try {
            const page = await pdf.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const lines = textContentToLines(textContent);
            const pageText = lines.join('\n').trim();

            if (pageText.length > 0) {
                textPages++;
                chars += pageText.length;
            }

            const classified: ClassifiedLine[] = lines.map((line) => ({
                kind: classifyLine(line),
                text: line,
            }));

            for (let i = 0; i < classified.length; i++) {
                const current = classified[i];
                if (!current.kind) continue;

                const block = [current.text];
                let j = i + 1;

                while (j < classified.length && block.length < MAX_BLOCK_LINES) {
                    const next = classified[j];

                    if (next.kind === current.kind) {
                        block.push(next.text);
                        j++;
                        continue;
                    }

                    if (
                        next.text.trim() === '' &&
                        j + 1 < classified.length &&
                        classified[j + 1].kind === current.kind
                    ) {
                        block.push('');
                        j++;
                        continue;
                    }

                    break;
                }

                const rawText = block.join('\n').trim();
                const text = (
                    current.kind === 'command'
                        ? splitCommandDescription(rawText)
                        : rawText
                ).slice(0, 4000);

                const strong =
                    current.kind === 'command' ||
                    current.kind === 'sql' ||
                    current.kind === 'config' ||
                    looksLikeStrongCode(current.text);

                const onlyPunctuation = /^[{}();,]+$/.test(
                    text.replace(/\s+/g, ''),
                );

                if (
                    text &&
                    (strong || block.length >= 2) &&
                    !(current.kind === 'code' && onlyPunctuation) &&
                    !(current.kind === 'command' && /^[$#>]$/.test(text))
                ) {
                    pushSnippet(snippets, seen, {
                        page: pageNumber,
                        kind: current.kind,
                        language: inferLanguage(current.kind, text),
                        text,
                        section: sectionForPage(sections, pageNumber),
                    });
                }

                i = j - 1;
            }
        } catch (error) {
            console.warn(`Snippet extraction: page ${pageNumber} failed`, error);
        }

        onProgress?.({ page: pageNumber, total, snippets: snippets.length });

        // Даём браузеру перерисовать прогресс (для фонового batch можно отключить).
        if (yieldToUi && pageNumber % 8 === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
    }

    return {
        snippets,
        textStatus: textPages > 0 ? 'ready' : 'empty',
        textPages,
        chars,
    };
}
