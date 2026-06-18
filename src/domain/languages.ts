export const LANG_NAME: Record<string, string> = {
  vi:  'Vietnamese',
  en:  'English',
  fr:  'French',
  zh:  'Chinese',
  ja:  'Japanese',
  ko:  'Korean',
  es:  'Spanish',
  de:  'German',
  it:  'Italian',
  pt:  'Portuguese',
  ru:  'Russian',
  ar:  'Arabic',
  hi:  'Hindi',
  th:  'Thai',
  id:  'Indonesian',
  nl:  'Dutch',
  tr:  'Turkish',
  pl:  'Polish',
  sv:  'Swedish',
  el:  'Greek',
  uk:  'Ukrainian',
  ro:  'Romanian',
  cs:  'Czech',
  fil: 'Filipino',
}

export function langName(code: string): string {
  return LANG_NAME[code] ?? code
}
