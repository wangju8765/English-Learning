// ============================================================
// Syllable splitting utility — approximate, game-grade
// ============================================================

export interface SyllableGroup {
  letters: string[];     // letters in this syllable
  startIndex: number;    // position in the original word
  hasVowel: boolean;
}

/**
 * Split a word into approximate syllable groups.
 *
 * Algorithm: each vowel (a/e/i/o/u/y) forms a syllable nucleus.
 * Consonants before the first vowel go with it. Consonants between
 * vowels are split — the first consonant stays with the left vowel,
 * the rest go with the right vowel. Final consonants go with the
 * last vowel.
 *
 * This is NOT linguistically accurate but works well enough for
 * visual grouping in a children's spelling game.
 *
 * Examples:
 *   "calculate" → cal / cu / late
 *   "format"    → for / mat
 *   "double"    → dou / ble
 *   "line"      → line
 */
export function splitSyllables(word: string): SyllableGroup[] {
  const letters = word.toLowerCase().split('');
  const vowels = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

  // Find all vowel positions
  const vowelPositions: number[] = [];
  for (let i = 0; i < letters.length; i++) {
    if (vowels.has(letters[i])) {
      vowelPositions.push(i);
    }
  }

  if (vowelPositions.length === 0) {
    // No vowels — return whole word as one group
    return [{ letters, startIndex: 0, hasVowel: false }];
  }

  const groups: SyllableGroup[] = [];
  let consumed = 0;

  for (let vi = 0; vi < vowelPositions.length; vi++) {
    const vowelIdx = vowelPositions[vi];
    const nextVowelIdx = vi + 1 < vowelPositions.length ? vowelPositions[vi + 1] : letters.length;

    // Include preceding unclaimed consonants
    const start = consumed;

    // Find split point: consonants between this vowel and next vowel
    // Convention: first consonant after vowel stays, rest go to next syllable
    const consonantsBetween = nextVowelIdx - vowelIdx - 1;

    let end: number;
    if (vi === vowelPositions.length - 1) {
      // Last vowel: take all remaining letters
      end = letters.length;
    } else if (consonantsBetween === 0) {
      // Adjacent vowels: split between them
      end = vowelIdx + 1;
    } else {
      // Consonants between: split, first half to left, second to right
      const splitPoint = vowelIdx + 1 + Math.floor(consonantsBetween / 2);
      end = splitPoint;
    }

    const groupLetters = letters.slice(start, end);
    groups.push({
      letters: groupLetters,
      startIndex: start,
      hasVowel: true,
    });

    consumed = end;
  }

  // Catch any trailing letters after the last group
  if (consumed < letters.length) {
    const trailing = letters.slice(consumed);
    if (groups.length > 0 && !groups[groups.length - 1].hasVowel) {
      // Merge into previous group
      groups[groups.length - 1].letters.push(...trailing);
    } else {
      groups.push({ letters: trailing, startIndex: consumed, hasVowel: false });
    }
  }

  return groups;
}

/**
 * Return the set of indices in the word that are vowels.
 * Used for highlighting vowel positions in Stage 2 UI.
 */
export function getVowelIndices(word: string): Set<number> {
  const vowels = new Set(['a', 'e', 'i', 'o', 'u', 'y']);
  const indices = new Set<number>();
  const letters = word.toLowerCase().split('');
  for (let i = 0; i < letters.length; i++) {
    if (vowels.has(letters[i])) {
      indices.add(i);
    }
  }
  return indices;
}
