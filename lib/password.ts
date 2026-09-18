/** 읽기 쉬운 임시 비밀번호 (헷갈리는 0/O/1/l/I 제외). 형식: 단어-단어-숫자 */
const WORDS = [
  'sky', 'tree', 'lake', 'moon', 'star', 'wind', 'rain', 'leaf', 'rock', 'sand',
  'bird', 'fish', 'wolf', 'bear', 'deer', 'lion', 'frog', 'swan', 'crow', 'hawk',
  'blue', 'gold', 'pink', 'gray', 'teal', 'lime', 'rose', 'jade', 'ruby', 'opal',
];

export function generateTempPassword(): string {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = 100 + Math.floor(Math.random() * 900);
  return `${pick()}-${pick()}-${num}`; // 예: lake-gold-483 (12자 내외, 8자 이상)
}
