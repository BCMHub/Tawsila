import { randomUUID } from 'expo-crypto';
// Match PostgreSQL btrim(text) and char_length rather than JS whitespace trimming.
const trim = (value: string) => value.replace(/^ +| +$/g, '');
const length = (value: string) => Array.from(value).length;
const arabic = 'ءآأؤإئابتثجحخدذرزسشصضطظعغفقكلمنهويىة';
const namePattern = new RegExp(`^[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz${arabic} '-]+$`);
const platePattern = new RegExp(`^(?:[0123456789]{1,4}|[${arabic}]{1,4}[0123456789]{1,4}|[0123456789]{1,4}[${arabic}]{1,4})$`);
export const normalizeName = trim;
export function validateName(value: string): boolean {
 const normalized = normalizeName(value);
 return length(normalized) >= 1 && length(normalized) <= 50 && namePattern.test(normalized) && !normalized.includes('\n');
}
export function normalizePlate(value: string): string {
 return value.normalize('NFKC').replace(/[ \-ـ]/g, '').replace(/[٠١٢٣٤٥٦٧٨٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}
export function validatePlate(value: string): boolean {
 const normalized = normalizePlate(value);
 return platePattern.test(normalized) && !normalized.includes('\n');
}
export function validateYear(value: number, currentYear = new Date().getFullYear()): boolean {
 return Number.isInteger(value) && value >= 1980 && value <= currentYear + 1;
}
export type CarSelection = { brandId: string | null; brandOther: string | null; modelId: string | null; modelOther: string | null; typeId: string | null };
type Entry = { id: string; active: boolean };
export type CarCatalogue = { brands: Entry[]; models: (Entry & { brand_id: string })[]; types: Entry[] };
export function validateCarSelection(value: CarSelection, catalogue: CarCatalogue): boolean {
 const { brandId, brandOther, modelId, modelOther, typeId } = value;
 const freeText = (text: string | null) => text === null || (length(trim(text)) >= 1 && length(trim(text)) <= 50);
 return (brandId === null) !== (brandOther === null) && (modelId === null) !== (modelOther === null)
  && freeText(brandOther) && freeText(modelOther)
  && (brandId === null || catalogue.brands.some(row => row.id === brandId && row.active))
  && (modelId === null || (brandId !== null && catalogue.models.some(row => row.id === modelId && row.brand_id === brandId && row.active)))
  && catalogue.types.some(row => row.id === typeId && row.active);
}
export function newSubmissionKey(random: () => string = randomUUID): string { return random(); }
