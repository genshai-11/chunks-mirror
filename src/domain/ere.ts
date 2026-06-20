export const ERE_TOPIC_OPTIONS = Array.from({ length: 15 }, (_, index) => index + 1)

export const ERE_PART_OPTIONS = [
  'Part 1 - Vietnamese Slangs',
  'Part 2 - Vocab Check',
  'Part 3 - Phrase Check',
  'Part 4 - Sentence Check',
  'Part 5 - Monologue',
  'Part 6 - Dialogue',
  'Part 7 - 5s Review',
] as const

export type ErePart = typeof ERE_PART_OPTIONS[number]

export function topicLabel(topic: number | string) {
  return `Topic ${topic}`
}
