export type CreatorSourceRole = 'developer' | 'publisher';

const nameOverrides: Record<CreatorSourceRole, Record<string, string>> = {
  developer: {
    thunderful: 'Thunderful Development',
  },
  publisher: {
    thunderful: 'Thunderful Publishing',
  },
};

const companySuffixes = new Set([
  'inc', 'incorporated', 'ltd', 'limited', 'co', 'company', 'corp', 'corporation',
  'llc', 'llp', 'plc', 'gmbh', 'sa', 'srl', 'bv', 'pty', 'pte',
]);

const listTokens = (name: string, splitAnd = true): string[] =>
  name.split(splitAnd ? /(,\s*(?:and\s+|&\s*)|,\s*|\s+(?:and|&)\s+)/i : /(,\s*)/);

const isCompanySuffix = (separator: string, name: string): boolean =>
  separator.startsWith(',') && companySuffixes.has(name.trim().replaceAll('.', '').toLowerCase());

export const splitCreatorNames = (name: string, splitAnd = true): string[] => {
  const tokens = listTokens(name, splitAnd);
  const parts = [tokens[0].trim()];
  for (let i = 1; i < tokens.length; i += 2) {
    const part = tokens[i + 1].trim();
    if (isCompanySuffix(tokens[i], part)) parts[parts.length - 1] += `, ${part}`;
    else parts.push(part);
  }
  return parts;
};

export const transformCreatorNames = (names: string[], role: CreatorSourceRole): string[] =>
  names.map(name => {
    const tokens = listTokens(name);
    for (let i = 0; i < tokens.length; i += 2) {
      if (i + 2 < tokens.length && isCompanySuffix(tokens[i + 1], tokens[i + 2])) continue;
      const part = tokens[i].trim();
      const replacement = nameOverrides[role][part.toLowerCase()];
      if (replacement) tokens[i] = tokens[i].replace(part, replacement);
    }
    return tokens.join('');
  });
