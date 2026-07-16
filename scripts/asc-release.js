#!/usr/bin/env node
/**
 * Promote a finished TestFlight build to a PUBLIC App Store release via the ASC
 * API — create the version, attach the build, set "What's New", clear export
 * compliance, and submit for review. Uses the same eas-submit ASC key (no
 * interactive Apple-ID login).
 *
 *   node scripts/asc-release.js <versionString> <buildNumber> ["What's New text"] [--submit]
 *
 * Without --submit it stops BEFORE the irreversible review submission and prints
 * a summary (dry-ish). With --submit it also submits to Apple review.
 * Release type is AFTER_APPROVAL (auto-release once Apple approves).
 */
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const KEY_ID = 'P4F4X7WXXW';
const ISSUER_ID = '8b7aa06e-9951-41f6-80f9-e877a63c4bf8';
const APP_ID = '6760282723';
const P8 = path.join(__dirname, '..', 'AuthKey_P4F4X7WXXW.p8');

function tok() {
  const key = fs.readFileSync(P8, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const si =
    b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) +
    '.' +
    b64({ iss: ISSUER_ID, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const s = crypto.createSign('SHA256');
  s.update(si);
  return si + '.' + s.sign({ key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}
function api(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      'https://api.appstoreconnect.apple.com' + p,
      { method, headers: { Authorization: 'Bearer ' + tok(), 'Content-Type': 'application/json' } },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          if (res.statusCode >= 400) return reject(new Error(`${method} ${p} → ${res.statusCode}: ${d.slice(0, 500)}`));
          resolve(d ? JSON.parse(d) : {});
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const [versionString, buildNumber, whatsNew] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const doSubmit = process.argv.includes('--submit');
  if (!versionString || !buildNumber) {
    console.error('usage: node scripts/asc-release.js <version> <buildNumber> ["notes"] [--submit]');
    process.exit(2);
  }

  // 1. Find the build by build number (must be VALID / processed).
  const builds = await api('GET', `/v1/builds?filter[app]=${APP_ID}&filter[version]=${buildNumber}&limit=1&fields[builds]=version,processingState,usesNonExemptEncryption`);
  const build = (builds.data || [])[0];
  if (!build) throw new Error(`build ${buildNumber} not found in ASC`);
  console.log(`• build ${buildNumber}: ${build.attributes.processingState}, encryption=${build.attributes.usesNonExemptEncryption}`);

  // 2. Export compliance: if unset, declare non-exempt=false (matches app.json ITSAppUsesNonExemptEncryption=false).
  if (build.attributes.usesNonExemptEncryption == null) {
    await api('PATCH', `/v1/builds/${build.id}`, { data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } } });
    console.log('• set usesNonExemptEncryption=false');
  }

  // 3. Find or create the app store version.
  const existing = await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?filter[versionString]=${versionString}&limit=1&fields[appStoreVersions]=versionString,appStoreState`);
  let version = (existing.data || [])[0];
  if (version) {
    console.log(`• version ${versionString} exists (${version.attributes.appStoreState})`);
  } else {
    const created = await api('POST', '/v1/appStoreVersions', {
      data: {
        type: 'appStoreVersions',
        attributes: { platform: 'IOS_APP', versionString, releaseType: 'AFTER_APPROVAL' },
        relationships: { app: { data: { type: 'apps', id: APP_ID } } },
      },
    });
    version = created.data;
    console.log(`• created version ${versionString} (MANUAL release) → ${version.id}`);
  }

  // 4. Attach the build.
  await api('PATCH', `/v1/appStoreVersions/${version.id}/relationships/build`, { data: { type: 'builds', id: build.id } });
  console.log(`• attached build ${buildNumber}`);

  // 5. Set "What's New" on every localization (required for an update).
  if (whatsNew) {
    const locs = await api('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`);
    for (const l of locs.data) {
      await api('PATCH', `/v1/appStoreVersionLocalizations/${l.id}`, {
        data: { type: 'appStoreVersionLocalizations', id: l.id, attributes: { whatsNew } },
      });
    }
    console.log(`• set What's New on ${locs.data.length} locales`);
  }

  if (!doSubmit) {
    console.log('\n✓ Prepared (not submitted). Re-run with --submit to send to Apple review.');
    return;
  }

  // 6. Submit for review (reviewSubmissions flow).
  const sub = await api('POST', '/v1/reviewSubmissions', {
    data: { type: 'reviewSubmissions', attributes: { platform: 'IOS_APP' }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } },
  });
  const subId = sub.data.id;
  await api('POST', '/v1/reviewSubmissionItems', {
    data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: subId } }, appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } },
  });
  await api('PATCH', `/v1/reviewSubmissions/${subId}`, { data: { type: 'reviewSubmissions', id: subId, attributes: { submitted: true } } });
  console.log(`\n✅ Submitted ${versionString} (build ${buildNumber}) to App Store review. Release type: MANUAL.`);
  console.log(`   Review submission: ${subId}`);
}

main().catch((e) => {
  console.error('✖', e.message);
  process.exit(1);
});
