import http from 'http';

const PORT = process.env.PORT || '5000';
const URL = `http://localhost:${PORT}/api/v1/compression-test-payload`;

console.log(`Checking compression on: ${URL}`);

http.get(URL, { headers: { 'Accept-Encoding': 'gzip' } }, (res) => {
  const enc = res.headers['content-encoding'];
  const len = res.headers['content-length'];
  const vary = res.headers['vary'];
  const nosniff = res.headers['x-content-type-options'];

  console.log('Content-Encoding:', enc || 'NONE');
  console.log('Content-Length:', len || '(chunked)');
  console.log('Vary:', vary || 'NONE');
  console.log('X-Content-Type-Options:', nosniff || 'NONE');

  if (enc !== 'gzip') {
    console.error('❌ FAIL: Response is not compressed with gzip');
    process.exit(1);
  }

  if (!vary || !vary.includes('Accept-Encoding')) {
    console.error('❌ FAIL: Vary: Accept-Encoding header is missing or incorrect');
    process.exit(1);
  }

  if (nosniff !== 'nosniff') {
    console.error('❌ FAIL: X-Content-Type-Options: nosniff header is missing');
    process.exit(1);
  }

  console.log('✅ PASS: Compression active with correct headers');
  process.exit(0);
}).on('error', (err) => {
  console.error('❌ FAIL: Connection error:', err.message);
  process.exit(1);
});
