export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => String(item).trim())
      .filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index);
  } catch {
    return [];
  }
}

export function stringifyTags(tags: string[]): string {
  const uniqueTags = tags
    .map((item) => item.trim())
    .filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index);
  return JSON.stringify(uniqueTags);
}

export function toNullableIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}
