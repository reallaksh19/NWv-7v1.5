import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const manifestPath = new URL('./certification_manifest.json', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (!Array.isArray(manifest.commands) || manifest.commands.length === 0) {
  throw new Error('certification_manifest.json has no commands[]');
}

// --- Parse --profile flag ---
const args = process.argv.slice(2);
const profileFlagIndex = args.indexOf('--profile');
const requestedProfile = profileFlagIndex !== -1 ? args[profileFlagIndex + 1] : 'full';

const knownProfiles = Object.keys(manifest.profiles || { full: 'All tests' });
if (!knownProfiles.includes(requestedProfile) && requestedProfile !== 'full') {
  console.error(`Unknown profile: "${requestedProfile}". Available: ${knownProfiles.join(', ')}`);
  process.exit(1);
}

// --- Filter commands by profile ---
function commandMatchesProfile(entry, profile) {
  if (profile === 'full') return true;
  if (Array.isArray(entry.requiredFor)) return entry.requiredFor.includes(profile);
  // Legacy entries without requiredFor are included only in full
  return false;
}

const allCommands = manifest.commands.map(entry => {
  if (!entry.id || !entry.cmd || !Array.isArray(entry.args)) {
    throw new Error(`Invalid certification manifest entry: ${JSON.stringify(entry)}`);
  }
  return entry;
});

const commands = allCommands.filter(entry => commandMatchesProfile(entry, requestedProfile));

if (commands.length === 0) {
  console.log(`Profile "${requestedProfile}" matched 0 commands — nothing to run.`);
  process.exit(0);
}

console.log(`\nCERTIFICATION GATE — profile: ${requestedProfile} (${commands.length}/${allCommands.length} steps)`);
if (manifest.profiles?.[requestedProfile]) {
  console.log(`Description: ${manifest.profiles[requestedProfile]}`);
}
console.log(`Manifest version: ${manifest.manifestVersion}`);

const results = [];

for (const entry of commands) {
  const { id, cmd, args: cmdArgs } = entry;
  const label = `${cmd} ${cmdArgs.join(' ')}`;

  console.log(`\n\nCERTIFICATION STEP [${id}]: ${label}`);
  console.log('='.repeat(80));

  const result = spawnSync(cmd, cmdArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const ok = result.status === 0;

  results.push({
    id,
    command: label,
    status: ok ? 'PASS' : 'FAIL',
    exitCode: result.status,
  });

  if (!ok) {
    console.error(`\nCERTIFICATION FAILED [${id}]: ${label}`);
    console.error(JSON.stringify({
      status: 'FAIL',
      profile: requestedProfile,
      failedStepId: id,
      failedCommand: label,
      manifestVersion: manifest.manifestVersion,
      results,
    }, null, 2));
    process.exit(result.status || 1);
  }
}

console.log('\n\nCERTIFICATION RESULT');
console.log('='.repeat(80));
console.log(JSON.stringify({
  status: 'PASS',
  profile: requestedProfile,
  checked: `NWv-7 certification gate (${requestedProfile})`,
  manifestVersion: manifest.manifestVersion,
  commandCount: commands.length,
  results,
}, null, 2));

console.log(`PASS: Certification gate (${requestedProfile})`);
