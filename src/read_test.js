import fs from 'fs';
const raw = fs.readFileSync('test_output.txt');
// Try utf16le
try {
  const txt = raw.toString('utf16le');
  console.log(txt);
} catch {
  console.log(raw.toString());
}
