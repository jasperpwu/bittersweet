#!/usr/bin/env node
/**
 * Verify every locale JSON matches en.json's key set, allowing for the fact
 * that plural suffixes are locale-specific: Japanese needs only `_other`,
 * Russian needs `_one/_few/_many/_other`, Arabic all six. A flat comparison
 * would report all of those as errors.
 *
 * Also reports values still identical to English, which is the signal for
 * "seeded from en.json but not translated yet".
 *
 * Usage (from the project root):
 *   node scripts/i18n-parity.js [locale ...]
 */
const fs = require('fs');
const path = require('path');

const LOCALES = [
  'es', 'fr', 'de', 'pt-BR', 'ja', 'ko', 'zh-Hans',
  'hi', 'bn', 'ru', 'ar', 'ur',
];

const LOCALES_DIR = path.join(process.cwd(), 'src/i18n/locales');
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/**
 * Scripts that must never appear in a given locale. Catches a character typed
 * from the wrong keyboard layout mid-string — a stray CJK word inside a Russian
 * sentence renders fine and reads as nonsense, so nothing else would flag it.
 * Latin is allowed everywhere (brand names, placeholders, interpolations).
 */
const FOREIGN_SCRIPT = {
  hi: /[\p{Script=Bengali}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}]/u,
  bn: /[\p{Script=Devanagari}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}]/u,
  ru: /[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Arabic}\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}]/u,
  ar: /[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}]/u,
  ur: /[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}]/u,
};

function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, full, out);
    else out[full] = value;
  }
  return out;
}

const read = (l) => flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${l}.json`), 'utf8')));

const en = read('en');
const enKeys = Object.keys(en);
const pluralBases = new Set(
  enKeys.filter((k) => PLURAL_SUFFIX.test(k)).map((k) => k.replace(PLURAL_SUFFIX, ''))
);
const plainKeys = enKeys.filter((k) => !PLURAL_SUFFIX.test(k));

const targets = process.argv.slice(2).length ? process.argv.slice(2) : LOCALES;

let failed = false;
console.log(`en: ${enKeys.length} keys (${plainKeys.length} plain, ${pluralBases.size} plural bases)\n`);

for (const locale of targets) {
  const flat = read(locale);
  const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;

  const missing = plainKeys.filter((k) => !(k in flat));
  // Each plural base must supply exactly the categories this language uses.
  const badPlurals = [];
  for (const base of pluralBases) {
    for (const cat of categories) {
      if (!(`${base}_${cat}` in flat)) badPlurals.push(`${base}_${cat}`);
    }
  }
  const extra = Object.keys(flat).filter((k) => {
    if (k in en) return false;
    const base = k.replace(PLURAL_SUFFIX, '');
    return !(PLURAL_SUFFIX.test(k) && pluralBases.has(base));
  });

  const untranslated = plainKeys.filter(
    (k) => k in flat && flat[k] === en[k] && /[a-zA-Z]{4}/.test(String(en[k]))
  );

  const foreign = FOREIGN_SCRIPT[locale]
    ? Object.keys(flat).filter((k) => FOREIGN_SCRIPT[locale].test(String(flat[k])))
    : [];

  const broken = missing.length || badPlurals.length || extra.length || foreign.length;
  if (broken) failed = true;

  console.log(
    `${locale.padEnd(8)} ${(broken ? 'FAIL' : 'ok').padEnd(5)} ` +
      `plurals=[${categories.join(',')}]` +
      (missing.length ? ` missing=${missing.length}` : '') +
      (badPlurals.length ? ` missing-plural=${badPlurals.length}` : '') +
      (extra.length ? ` extra=${extra.length}` : '') +
      (foreign.length ? ` WRONG-SCRIPT=${foreign.length}` : '') +
      ` same-as-en=${untranslated.length}`
  );
  for (const k of foreign.slice(0, 5)) console.log(`   wrong-script: ${k} -> ${flat[k]}`);
  if (missing.length) console.log(`   missing: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ' …' : ''}`);
  if (badPlurals.length) console.log(`   plural:  ${badPlurals.slice(0, 6).join(', ')}${badPlurals.length > 6 ? ' …' : ''}`);
  if (extra.length) console.log(`   extra:   ${extra.slice(0, 6).join(', ')}${extra.length > 6 ? ' …' : ''}`);
}

process.exit(failed ? 1 : 0);
