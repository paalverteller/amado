export function cleanPlainTextOutput(input: string): string {
  let text = input ?? ''

  // 1. Remove closed think tags
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
  
  // 2. Remove unclosed think tags (lop off everything after the open tag)
  if (text.toLowerCase().includes('<think>')) {
    text = text.replace(/<think>[\s\S]*$/i, '')
  }

  // 3. Remove fenced code blocks
  text = text.replace(/```[\w-]*\n?/g, '')
  text = text.replace(/```/g, '')

  // 4. Replace common HTML layout tags with newlines
  text = text.replace(/<\/?(?:p|br|div|span|strong|em|b|i|h[1-6]|ul|ol|li|article|section|blockquote)[^>]*>/gi, '\n')
  text = text.replace(/<[^>]+>/g, '')

  // 5. Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')

  // 6. Aggressive Markdown strip: headers, bold, italics, code, lists
  text = text
    .replace(/^\s{0,3}#{1,6}\s+(.*)$/gm, '$1') // Convert headings to plain text
    .replace(/\*\*([^*]+)\*\*/g, '$1')         // Remove bold
    .replace(/__([^_]+)__/g, '$1')             // Remove bold alt
    .replace(/\*([^*\n]+)\*/g, '$1')           // Remove italic
    .replace(/_([^_\n]+)_/g, '$1')             // Remove italic alt
    .replace(/`([^`]+)`/g, '$1')               // Remove inline code
    .replace(/^\s*[-*+]\s+/gm, '— ')           // Convert lists to em dash
    .replace(/^\s*\d+\.\s+/gm, '')             // Remove numbered lists

  // 7. Remove model meta-comments
  text = text.replace(/^\s*(ok|certo|vamos|preciso|devo|primeiro)\b.*$/gim, '')

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function assertPlainTextOutput(input: string): string {
  const cleaned = cleanPlainTextOutput(input)
  if (!cleaned) return ''
  return cleaned
}
