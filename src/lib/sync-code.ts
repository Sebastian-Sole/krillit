/** "AB12CD34" → "AB12-CD34", easier to read aloud and copy. Safe on client and server. */
export const formatCode = (code: string) => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);
