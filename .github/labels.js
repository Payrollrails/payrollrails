/**
 * Creates 5 labels on the PayrollRails GitHub repo.
 * Run: node .github/labels.js <YOUR_GITHUB_TOKEN>
 */

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('Usage: node labels.js <token>'); process.exit(1); }

const REPO  = 'Payrollrails/payrollrails';
const API   = `https://api.github.com/repos/${REPO}/labels`;

const LABELS = [
  { name: 'bug',         color: 'ee0701', description: 'Something is broken'              },
  { name: 'enhancement', color: '84b6eb', description: 'New feature or improvement'       },
  { name: 'good first issue', color: '7057ff', description: 'Good for newcomers'          },
  { name: 'security',    color: 'e4e669', description: 'Security vulnerability or concern' },
  { name: 'stellar',     color: '0075ca', description: 'Related to Stellar / USDC logic'  },
];

for (const label of LABELS) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(label),
  });

  const data = await res.json();
  if (res.ok) {
    console.log(`✅ Created: ${label.name}`);
  } else if (data.errors?.[0]?.code === 'already_exists') {
    console.log(`⏭  Exists:  ${label.name}`);
  } else {
    console.error(`❌ Failed:  ${label.name} —`, data.message);
  }
}
