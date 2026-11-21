export const shareLinkBaseCases = [
  ['https://example.invalid', true],
  ['https://example.invalid/', true],
  ['https://example.invalid/base', false],
  ['https://example.invalid?x=1', false],
  ['https://example.invalid#f', false],
  ['https://example.invalid?', false],
  ['https://example.invalid#', false],
  ['http://example.invalid', false],
  ['https://user:pw@example.invalid', false],
  ['not a url', false],
  ['', false],
] as const;
