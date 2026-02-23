function cleanText(text) {
  return text
    .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove non-printable control characters (except \t \n \r)
    .replace(/\r\n/g, '\n') // Normalize CRLF to LF
    .replace(/\r/g, '\n') // Normalize CR to LF
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .trim(); // Remove leading/trailing whitespace
}

// Test Cases
const tests = [
  { name: 'NBSP', input: 'Hello\u00A0World', expected: 'Hello World' },
  { name: 'Control Chars', input: 'Hello\x00World', expected: 'HelloWorld' },
  { name: 'CRLF', input: 'Line1\r\nLine2', expected: 'Line1\nLine2' },
  { name: 'Excessive Newlines', input: 'Line1\n\n\n\nLine2', expected: 'Line1\n\nLine2' },
  { name: 'Trim', input: '  Hello  ', expected: 'Hello' },
  { name: 'Complex', input: '  Line1\u00A0\r\n\x00\n\n\nLine2  ', expected: 'Line1 \n\nLine2' }
];

let failed = false;
tests.forEach(test => {
  const result = cleanText(test.input);
  if (result !== test.expected) {
    console.error(`Test '${test.name}' FAILED. Expected '${JSON.stringify(test.expected)}', got '${JSON.stringify(result)}'`);
    failed = true;
  } else {
    console.log(`Test '${test.name}' PASSED`);
  }
});

if (failed) process.exit(1);
