// ============================================================
// Vocabulary Parser — md → JSON build script
// Run: npx tsx scripts/parse-vocabulary.ts
// ============================================================
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VOCABULARY_DIR = path.resolve(__dirname, '../../vocabulary');
const OUTPUT_DIR = path.resolve(__dirname, '../public/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'vocabulary.json');

interface ExampleSentence {
  english: string;
  chinese: string;
}

interface VocabularyEntry {
  id: string;
  word: string;
  variants?: string[];
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  definitionDetail?: string[];
  exampleSentences: ExampleSentence[];
  parentNotes?: string;
  sourceDate: string;
}

// ============================================================
// Legacy format parser (Chinese label format)
// ============================================================
function parseLegacyFormat(content: string, sourceFileName: string): VocabularyEntry[] {
  const entries: VocabularyEntry[] = [];

  // Remove all separator lines first
  const cleanedContent = content.replace(/^[━]+$/gm, '');

  // Split by word entry headers: 【 N. WordName 】
  const sections = cleanedContent.split(/\n(?=【\s*\d+\.\s)/);

  for (const section of sections) {
    if (!section.trim()) continue;

    // Extract word name from header
    const titleMatch = section.match(/【\s*\d+\.\s*(.+?)\s*】/);
    if (!titleMatch) continue;

    const titleText = titleMatch[1].trim();
    const words = titleText.split(/\s*\/\s*/).map((w) => w.trim());
    const mainWord = words[0];
    const variants = words.length > 1 ? words.slice(1) : undefined;

    const entry: VocabularyEntry = {
      id: normalizeId(mainWord),
      word: mainWord,
      variants,
      phonetic: '',
      partOfSpeech: '',
      definition: '',
      exampleSentences: [],
      sourceDate: extractDate(sourceFileName),
    };

    // Remove the title line from section
    const body = section.replace(/【.+?】/, '');

    // Parse each field
    entry.phonetic = extractSingleLineField(body, '音标');
    entry.partOfSpeech = extractSingleLineField(body, '词性');

    // Definition (multi-line)
    const defSection = extractMultiLineField(body, '释义');
    if (defSection) {
      const lines = defSection.split('\n').filter((l) => l.trim() && l.trim().startsWith('-'));
      if (lines.length > 0) {
        entry.definition = lines.map((l) => l.replace(/^\s*-\s*/, '').trim()).join('；');
      } else {
        entry.definition = defSection.trim();
      }
    }

    // Parent notes (multi-line)
    const notesSection = extractMultiLineField(body, '父子笔记');
    if (notesSection) {
      entry.parentNotes = notesSection.replace(/\n/g, ' ').trim();
    }

    // Example sentences
    const examplesSection = extractMultiLineField(body, '实用例句');
    if (examplesSection) {
      const exampleLines = examplesSection.split('\n').filter((l) => {
        const trimmed = l.trim();
        return trimmed && (trimmed.startsWith('-') || trimmed.includes('('));
      });
      for (const line of exampleLines) {
        // Match: "- English text(中文翻译)"
        const match = line.match(/-\s*(.+?)[（(](.+?)[）)]\s*$/);
        if (match) {
          entry.exampleSentences.push({
            english: match[1].trim(),
            chinese: match[2].trim(),
          });
        }
      }
    }

    if (entry.word) {
      entries.push(entry);
    }
  }

  return entries;
}

function extractSingleLineField(body: string, fieldName: string): string {
  const match = body.match(new RegExp(`•\\s*${fieldName}[：:]\\s*(.+)`));
  return match ? match[1].trim() : '';
}

// ============================================================
// YAML front matter parser
// ============================================================
function parseYamlFrontMatter(content: string, sourceFileName: string): VocabularyEntry[] {
  const entries: VocabularyEntry[] = [];

  // Check for YAML front matter (--- ... ---)
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    // Fall back to legacy parser
    return parseLegacyFormat(content, sourceFileName);
  }

  // Simple YAML-like parsing (enough for our template)
  const yaml = fmMatch[1];
  const dateMatch = yaml.match(/date:\s*(.+)/);
  const sourceDate = dateMatch ? dateMatch[1].trim() : extractDate(sourceFileName);

  // Parse word entries from the YAML
  const wordSections = yaml.split(/\n\s*-\s*word:/);
  // First section before any "- word:" is metadata, skip it

  for (const section of wordSections.slice(1)) {
    const entry: VocabularyEntry = {
      id: '',
      word: '',
      phonetic: '',
      partOfSpeech: '',
      definition: '',
      exampleSentences: [],
      sourceDate,
    };

    const extractYamlField = (name: string, text: string): string => {
      const match = text.match(new RegExp(`^\\s*${name}:\\s*"?(.+?)"?\\s*$`, 'm'));
      return match ? match[1].trim().replace(/^"|"$/g, '') : '';
    };

    // The word value is the first line of the section (split removed "- word:" prefix)
    const firstLine = section.trim().split('\n')[0].trim();
    entry.word = firstLine.replace(/^"|"$/g, '');
    entry.phonetic = extractYamlField('phonetic', section);
    entry.partOfSpeech = extractYamlField('pos', section);
    entry.definition = extractYamlField('definition', section);
    entry.parentNotes = extractYamlField('notes', section) || undefined;

    if (!entry.word) continue;
    entry.id = normalizeId(entry.word);

    // Parse examples — en: and zh: are on separate lines
    const exampleBlock = section.match(/examples:\s*\n([\s\S]*)/);
    if (exampleBlock) {
      const lines = exampleBlock[1].split('\n');
      for (let i = 0; i < lines.length; i++) {
        const enMatch = lines[i].match(/en:\s*"(.+?)"/);
        if (enMatch && i + 1 < lines.length) {
          const zhMatch = lines[i + 1].match(/zh:\s*"(.+?)"/);
          if (zhMatch) {
            entry.exampleSentences.push({
              english: enMatch[1],
              chinese: zhMatch[1],
            });
            i++; // skip the zh line
          }
        }
      }
    }

    entries.push(entry);
  }

  if (entries.length === 0) {
    // Fall back to legacy parser
    return parseLegacyFormat(content, sourceFileName);
  }

  return entries;
}

// ============================================================
// Helpers
// ============================================================

function extractMultiLineField(block: string, fieldName: string): string | null {
  // Find the field header: • fieldName:
  const startMatch = block.match(new RegExp(`•\\s*${fieldName}[：:]\\s*`));
  if (!startMatch || startMatch.index === undefined) return null;

  const startIdx = startMatch.index + startMatch[0].length;
  let content = block.slice(startIdx);

  // Stop at the next • field or end of block
  const nextFieldMatch = content.match(/\n\s*•\s+[^\n]+[：:]/);
  if (nextFieldMatch && nextFieldMatch.index !== undefined) {
    content = content.slice(0, nextFieldMatch.index);
  }

  return content.trim();
}

function extractDate(fileName: string): string {
  // Try "YYYY-MM-DD" format
  const match1 = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match1) return match1[0];

  // Try Chinese date: "2026年6月3日"
  const match2 = fileName.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match2) {
    const y = match2[1];
    const m = match2[2].padStart(2, '0');
    const d = match2[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return new Date().toISOString().slice(0, 10);
}

function normalizeId(word: string): string {
  return word.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ============================================================
// Main
// ============================================================
function main() {
  console.log('🔍 Scanning vocabulary directory:', VOCABULARY_DIR);

  if (!fs.existsSync(VOCABULARY_DIR)) {
    console.error('❌ Vocabulary directory not found!');
    process.exit(1);
  }

  const files = fs.readdirSync(VOCABULARY_DIR).filter(
    (f) => f.endsWith('.md') && f !== 'template.md'
  );

  console.log(`📄 Found ${files.length} vocabulary file(s):`, files);

  const allEntries: VocabularyEntry[] = [];
  const seenIds = new Set<string>();
  const warnings: string[] = [];

  for (const file of files) {
    console.log(`\n📖 Parsing: ${file}`);
    const filePath = path.join(VOCABULARY_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Detect format and parse
    let entries: VocabularyEntry[];
    if (content.includes('---\n') && content.includes('\n---')) {
      console.log('   Format: YAML front matter');
      entries = parseYamlFrontMatter(content, file);
    } else {
      console.log('   Format: Legacy (Chinese labels)');
      entries = parseLegacyFormat(content, file);
    }

    console.log(`   Entries parsed: ${entries.length}`);

    // Validate and deduplicate
    for (const entry of entries) {
      if (!entry.id) {
        warnings.push(`[${file}] Entry has no valid ID: "${entry.word}"`);
        continue;
      }
      if (!entry.phonetic) {
        warnings.push(`[${file}] "${entry.word}" missing phonetic`);
      }
      if (!entry.definition) {
        warnings.push(`[${file}] "${entry.word}" missing definition`);
      }
      if (entry.exampleSentences.length === 0) {
        warnings.push(`[${file}] "${entry.word}" has no example sentences`);
      }

      if (seenIds.has(entry.id)) {
        console.log(`   ⚠️  Duplicate "${entry.word}" — using latest definition`);
        const existingIdx = allEntries.findIndex((e) => e.id === entry.id);
        if (existingIdx >= 0) {
          allEntries[existingIdx] = entry; // Replace with latest
        }
      } else {
        seenIds.add(entry.id);
        allEntries.push(entry);
      }
    }
  }

  // Generate content hash
  const contentStr = JSON.stringify(allEntries);
  const contentHash = crypto.createHash('md5').update(contentStr).digest('hex').slice(0, 8);

  const manifest = {
    version: 1,
    contentHash,
    generatedAt: new Date().toISOString(),
    entries: allEntries,
  };

  // Write output
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`\n✅ Generated ${OUTPUT_FILE}`);
  console.log(`   Total entries: ${allEntries.length}`);
  console.log(`   Content hash: ${contentHash}`);

  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} warning(s):`);
    for (const w of warnings) {
      console.log(`   ${w}`);
    }
  }

  // Summary by source date
  const byDate: Record<string, number> = {};
  for (const e of allEntries) {
    byDate[e.sourceDate] = (byDate[e.sourceDate] || 0) + 1;
  }
  console.log('\n📊 Entries by date:');
  for (const [date, count] of Object.entries(byDate).sort()) {
    console.log(`   ${date}: ${count} words`);
  }
}

main();
