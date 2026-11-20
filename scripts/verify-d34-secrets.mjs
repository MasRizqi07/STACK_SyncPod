import { execSync } from 'node:child_process';

console.log('Running D34 secret fallback audit:');
console.log('Target regex: process\\.env\\.[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD)[A-Z_]* *(\\|\\||\\?\\?) *[\'"]');
console.log('Scope: apps/** packages/**\n');

try {
  const result = execSync(
    'git grep -E "process\\.env\\.[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD)[A-Z_]* *(\\|\\||\\?\\?) *[\'\\"]" -- "apps/**" "packages/**"',
    { encoding: 'utf8' },
  );
  console.log('FAIL: Matches found:\n', result);
  process.exit(1);
} catch (err) {
  // Exit code 1 means git grep found zero matches
  if (err.status === 1) {
    console.log('PASS: Zero matches found across apps and packages.');
    console.log('D34 Gate strictly satisfied: No secret, key, token, or password has inline fallback.');
    process.exit(0);
  }
  console.error('Error running git grep:', err);
  process.exit(2);
}
