export const slugify = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const uniqueSlug = (text) => {
  const base = slugify(text);
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${base}-${suffix}`;
};
