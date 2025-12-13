require('dotenv').config({ path: '.env.local' });

const required = [
  'VITE_GOOGLE_CLIENT_ID',
  'VITE_ONEDRIVE_CLIENT_ID'
];

const missing = required.filter(k => !process.env[k] && !process.env[k + '_FILE']);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables (required for build):\n' + missing.map(s => `  - ${s}`).join('\n'));
  console.error('\nYou can set them in CI or export them locally before building.');
  process.exit(1);
}
console.log('✔ environment variables check passed');
process.exit(0);
