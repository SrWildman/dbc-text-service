// Usage: node scripts/send.js --body "text" [--only "Sam Wildman"] [--send --confirm N]
// Default is a DRY RUN: nothing is sent unless --send and --confirm <count> match.
require('dotenv').config?.();
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = n => args.includes(`--${n}`);
const val = n => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);

const body = val('body');
if (!body) { console.error('--body is required'); process.exit(1); }

const rows = fs.readFileSync(path.join(__dirname, '..', 'recipients.csv'), 'utf8')
  .trim().split('\n').slice(1).map(l => {
    const [status, name, cell] = l.split(',');
    return { status, name, cell: (cell || '').trim() };
  });

const toE164 = raw => {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d[0] === '1') return `+${d}`;
  return null;
};

const only = val('only');
const seen = new Set();
const recipients = [];
const skipped = [];
for (const r of rows) {
  if (only && r.name !== only) continue;
  const num = toE164(r.cell);
  if (!num) { skipped.push(`${r.name} (${r.cell ? 'bad number' : 'no number'})`); continue; }
  if (seen.has(num)) { skipped.push(`${r.name} (duplicate)`); continue; }
  seen.add(num);
  recipients.push({ name: r.name, num });
}

const mask = n => n.slice(0, 5) + '***' + n.slice(-2);
console.log(`Recipients: ${recipients.length}   Skipped: ${skipped.length}`);
console.log(`Body (${body.length} chars):\n${body}\n`);
console.log('Skipped:', skipped.join('; ') || 'none');
console.log('Sending to:', recipients.map(r => `${r.name} ${mask(r.num)}`).join(', '));

if (!flag('send')) { console.log('\nDRY RUN: nothing sent.'); process.exit(0); }
if (Number(val('confirm')) !== recipients.length) {
  console.error(`\nRefusing: --confirm must equal recipient count (${recipients.length}).`);
  process.exit(1);
}

const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const sids = [];
(async () => {
  for (const r of recipients) {
    try {
      const m = await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: r.num, body });
      console.log(`sent ${r.name} ${m.sid} ${m.status}`);
      sids.push([r.name, m.sid]);
    } catch (e) {
      console.error(`FAILED ${r.name}: ${e.message}`);
    }
  }
  // Report delivery status after carriers have had a moment.
  await new Promise(res => setTimeout(res, 15000));
  const counts = {};
  for (const [name, sid] of sids) {
    const m = await client.messages(sid).fetch();
    counts[m.status] = (counts[m.status] || 0) + 1;
    if (!['delivered', 'sent'].includes(m.status)) console.log(`${name}: ${m.status} ${m.errorCode || ''}`);
  }
  console.log('Status summary:', counts);
})();
