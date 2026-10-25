import type { SearchParams, Professor } from "../types";

const safeUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
};

export const fetchProfessorDetailsStream = async (
  params: SearchParams,
  onProfessorFound: (professor: Professor) => void,
  onError: (error: Error) => void
): Promise<void> => {
  const criteria = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, value.trim()]));
  if (!Object.values(criteria).some(Boolean)) {
    throw new Error("Please provide an institute, department, or keyword to start the search.");
  }
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch('/api/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(criteria),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || `Search failed (HTTP ${response.status}). Please try again.`);
    }
    if (!response.body) throw new Error("The server returned an empty response.");
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    const seen = new Set<string>();
    let buffer = '';
    let invalidLines = 0;
    const processLine = (line: string) => {
      if (!line.trim()) return;
      let item: Record<string, unknown>;
      try { item = JSON.parse(line); } catch { invalidLines++; return; }
      if (!item || typeof item !== 'object' || Array.isArray(item)) { invalidLines++; return; }
      if (typeof item.error === 'string') throw new Error(item.error);
      if (typeof item.Name !== 'string' || !item.Name.trim() || typeof item.Designation !== 'string' || !item.Designation.trim() || typeof item.Institute !== 'string' || !item.Institute.trim()) {
        invalidLines++; return;
      }
      const key = `${item.Name.trim()}|${item.Institute.trim()}`.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const text = (key: string) => typeof item[key] === 'string' ? (item[key] as string).trim() : '';
      const email = text('Email');
      onProfessorFound({
        Name: text('Name'), Designation: text('Designation'), Institute: text('Institute'),
        Email: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null,
        LinkedIn: safeUrl(item.LinkedIn), 'Institute Website': safeUrl(item['Institute Website']) || 'Link not working',
        Summary: text('Summary'), 'Research Interests': text('Research Interests'),
        'Internship/Outreach': text('Internship/Outreach') || null,
      });
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // A broken upstream response should not grow memory without a bound.
      if (buffer.length > 1_000_000) throw new Error('The search response was too large. Narrow your search.');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach(processLine);
    }
    buffer += decoder.decode();
    processLine(buffer);
    if (invalidLines) throw new Error('Some search results could not be read. Any valid results are shown; retry to complete the shortlist.');
  } catch (error: unknown) {
    onError(error instanceof Error ? error : new Error('Search failed. Please try again.'));
  } finally { reader?.releaseLock(); }
};
