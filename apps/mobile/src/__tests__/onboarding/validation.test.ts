import { expect, test, jest } from '@jest/globals';
import { normalizeName, validateName, normalizePlate, validatePlate, validateYear, validateCarSelection, newSubmissionKey } from '../../features/onboarding/validation';
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000002') }));
test('normalizes names using the server space trim', () => { expect(normalizeName(' Ali ')).toBe('Ali'); });
test.each(['Ali', 'أحمد', "O'Neil", 'Anne-Marie', 'A B', 'a'.repeat(50)])('accepts name %s', value => expect(validateName(value)).toBe(true));
test.each(['', ' ', 'a'.repeat(51), 'Ali1', 'A@', 'أَ', '\tAli\t', 'Émile', '😀'])('rejects name %s', value => expect(validateName(value)).toBe(false));
test('normalizes plate', () => expect(normalizePlate(' ﺏـ -١٢ ')).toBe('ب12'));
test.each(['1', '1234', 'ب1', 'ابتث1234', '1ب', '1234ابتث', 'ءأؤإ١', ' ب-١ـ '])('accepts plate %s', value => expect(validatePlate(value)).toBe(true));
test.each(['', '12345', 'ابتثج1', '1ابتثج', 'abc1', 'بَ1', 'ب', 'ب1ت', '1ب2', '۱۲۳۴۵', 'بَ۱', '۱ب۲', '1\t', '1!'])('rejects plate %s', value => expect(validatePlate(value)).toBe(false));
test.each([1980, 2026, 2027])('accepts year %s', year => expect(validateYear(year, 2026)).toBe(true));
test.each([1979, 2028, 2000.5, NaN, Infinity])('rejects year %s', year => expect(validateYear(year, 2026)).toBe(false));
const base = { brandId: 'brand', brandOther: null, modelId: 'model', modelOther: null, typeId: 'type' };
const catalogue = { brands: [{ id: 'brand', active: true }], models: [{ id: 'model', brand_id: 'brand', active: true }], types: [{ id: 'type', active: true }] };
test('catalogue selection and Other combinations', () => {
 expect(validateCarSelection(base, catalogue)).toBe(true);
 expect(validateCarSelection({ ...base, modelId: null, modelOther: 'other' }, catalogue)).toBe(true);
 expect(validateCarSelection({ ...base, brandId: null, brandOther: ' other ', modelId: null, modelOther: 'x'.repeat(50) }, catalogue)).toBe(true);
});
test.each([
 { brandOther: 'other' }, { brandId: null }, { modelOther: 'other' }, { modelId: null }, { typeId: null },
 { brandId: null, brandOther: 'other' }, { brandId: 'missing' }, { modelId: 'missing' }, { typeId: 'missing' },
 { modelId: null, modelOther: ' ' }, { modelId: null, modelOther: 'a'.repeat(51) },
 { brandId: null, brandOther: ' ', modelId: null, modelOther: 'x' },
])('rejects invalid selection %j', patch => expect(validateCarSelection({ ...base, ...patch }, catalogue)).toBe(false));
test('rejects inactive and mismatched catalogue entries', () => {
 expect(validateCarSelection(base, { ...catalogue, models: [{ id: 'model', brand_id: 'other', active: true }] })).toBe(false);
 for (const key of ['brands', 'models', 'types'] as const) expect(validateCarSelection(base, { ...catalogue, [key]: catalogue[key].map(row => ({ ...row, active: false })) })).toBe(false);
});
test('submission keys use an injectable UUID source', () => {
 const key = '00000000-0000-4000-8000-000000000001';
 expect(newSubmissionKey(() => key)).toBe(key);
 expect(newSubmissionKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('normalizes smart apostrophes before name validation', () => {
 expect(normalizeName(' O’Neil ')).toBe("O'Neil");
 expect(validateName('O’Neil')).toBe(true);
 expect(validateName('A’1')).toBe(false);
 expect(validateName('A'.repeat(50) + '’')).toBe(false);
});
test('normalizes both Arabic digit sets identically', () => {
 expect(normalizePlate('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹')).toBe('01234567890123456789');
 for (const value of ['۱', '۱۲۳۴', 'ب۱۲', '۱۲ب', ' بـ-۱٢ ']) expect(validatePlate(value)).toBe(true);
});
