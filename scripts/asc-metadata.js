#!/usr/bin/env node
/**
 * App Store Connect metadata as code — no Apple-ID interactive login.
 *
 * `eas metadata:pull/push` needs an interactive Apple-ID session (beta), which
 * fails headless. This talks to the ASC API directly with the SAME ASC API key
 * already configured for `eas submit` (AuthKey_<kid>.p8), so it runs
 * non-interactively in CI or from the Telegram bridge.
 *
 *   node scripts/asc-metadata.js pull   → writes store.config.json from the live listing
 *   node scripts/asc-metadata.js push   → pushes store.config.json back to ASC (editable version only)
 *
 * store.config.json shape (per BCP-47 locale):
 *   { "appId", "info": { "<locale>": { name, subtitle } },
 *     "version": { "<locale>": { description, keywords, promotionalText,
 *                                whatsNew, marketingUrl, supportUrl } } }
 */
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const KEY_ID = 'P4F4X7WXXW';
const ISSUER_ID = '8b7aa06e-9951-41f6-80f9-e877a63c4bf8';
const APP_ID = '6760282723';
const P8_PATH = path.join(__dirname, '..', 'AuthKey_P4F4X7WXXW.p8');
const OUT = path.join(__dirname, '..', 'store.config.json');

function token() {
  const key = fs.readFileSync(P8_PATH, 'utf8');
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

function api(method, apiPath, body) {
  const jwt = token();
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      'https://api.appstoreconnect.apple.com' + apiPath,
      {
        method,
        headers: {
          Authorization: 'Bearer ' + jwt,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`${method} ${apiPath} → ${res.statusCode}: ${d.slice(0, 400)}`));
          }
          resolve(d ? JSON.parse(d) : {});
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/** The version row ASC lets you EDIT (PREPARE_FOR_SUBMISSION), else the newest. */
async function editableVersion() {
  const v = await api(
    'GET',
    `/v1/apps/${APP_ID}/appStoreVersions?limit=5&fields[appStoreVersions]=versionString,appStoreState`,
  );
  const editableStates = new Set([
    'PREPARE_FOR_SUBMISSION',
    'DEVELOPER_REJECTED',
    'REJECTED',
    'METADATA_REJECTED',
    'WAITING_FOR_REVIEW',
  ]);
  return (
    (v.data || []).find((x) => editableStates.has(x.attributes.appStoreState)) ||
    (v.data || [])[0]
  );
}

async function pull() {
  const info = (await api('GET', `/v1/apps/${APP_ID}/appInfos?limit=1`)).data[0];
  const infoLocs = await api(
    'GET',
    `/v1/appInfos/${info.id}/appInfoLocalizations?limit=50`,
  );
  const ver = await editableVersion();
  const verLocs = await api(
    'GET',
    `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations?limit=50`,
  );

  const out = { appId: APP_ID, versionString: ver.attributes.versionString, info: {}, version: {} };
  for (const l of infoLocs.data) {
    out.info[l.attributes.locale] = {
      name: l.attributes.name,
      subtitle: l.attributes.subtitle,
    };
  }
  for (const l of verLocs.data) {
    out.version[l.attributes.locale] = {
      description: l.attributes.description,
      keywords: l.attributes.keywords,
      promotionalText: l.attributes.promotionalText,
      whatsNew: l.attributes.whatsNew,
      marketingUrl: l.attributes.marketingUrl,
      supportUrl: l.attributes.supportUrl,
    };
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  const locales = Object.keys(out.version);
  console.log(`✓ Pulled listing v${out.versionString} → store.config.json`);
  console.log(`  locales (${locales.length}): ${locales.join(', ')}`);
}

async function push() {
  const cfg = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const info = (await api('GET', `/v1/apps/${APP_ID}/appInfos?limit=1`)).data[0];
  const infoLocs = await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations?limit=50`);
  const ver = await editableVersion();
  if (!['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'METADATA_REJECTED', 'REJECTED'].includes(ver.attributes.appStoreState)) {
    throw new Error(
      `Version ${ver.attributes.versionString} is ${ver.attributes.appStoreState} — not editable. Create a new version in ASC first.`,
    );
  }
  const verLocs = await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations?limit=50`);

  let n = 0;
  for (const [locale, fields] of Object.entries(cfg.info || {})) {
    const row = infoLocs.data.find((x) => x.attributes.locale === locale);
    if (!row) continue;
    await api('PATCH', `/v1/appInfoLocalizations/${row.id}`, {
      data: { type: 'appInfoLocalizations', id: row.id, attributes: { name: fields.name, subtitle: fields.subtitle } },
    });
    n++;
  }
  for (const [locale, fields] of Object.entries(cfg.version || {})) {
    const row = verLocs.data.find((x) => x.attributes.locale === locale);
    if (!row) continue;
    const attributes = {};
    for (const k of ['description', 'keywords', 'promotionalText', 'whatsNew', 'marketingUrl', 'supportUrl']) {
      if (fields[k] != null) attributes[k] = fields[k];
    }
    await api('PATCH', `/v1/appStoreVersionLocalizations/${row.id}`, {
      data: { type: 'appStoreVersionLocalizations', id: row.id, attributes },
    });
    n++;
  }
  console.log(`✓ Pushed ${n} localizations to v${ver.attributes.versionString} (${ver.attributes.appStoreState})`);
}

const cmd = process.argv[2];
(async () => {
  if (cmd === 'pull') await pull();
  else if (cmd === 'push') await push();
  else {
    console.error('usage: node scripts/asc-metadata.js <pull|push>');
    process.exit(2);
  }
})().catch((e) => {
  console.error('✖', e.message);
  process.exit(1);
});
