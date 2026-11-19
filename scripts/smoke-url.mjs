#!/usr/bin/env node
/**
 * Smoke test for SyncPod live URL (local prototype or Vercel deployment).
 *
 * Verifies:
 * - Status 200 after redirect for 7 key routes:
 *   /, /masuk, /pod, /pod?scenario=fallback, /pod/pod-042, /pod/pod-042?demo=1, /pod/pod-042/selesai
 * - Presence of prototype notice: "Prototipe: data simulasi"
 * - Absence of Set-Cookie header
 * - Absence of "localhost" in HTML body
 * - 200 status for up to 20 sampled /_next/static assets
 */

const TARGET_ROUTES = [
  '/',
  '/masuk',
  '/pod',
  '/pod?scenario=fallback',
  '/pod/pod-042',
  '/pod/pod-042?demo=1',
  '/pod/pod-042/selesai',
];

const PROTOTYPE_NOTICE = 'Prototipe: data simulasi';

async function runSmokeTest(baseUrl) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  console.log(`========================================`);
  console.log(`SyncPod URL Smoke Test`);
  console.log(`Base URL: ${normalizedBase}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`========================================\n`);

  let failures = 0;
  const collectedStaticAssets = new Set();

  for (const route of TARGET_ROUTES) {
    const fullUrl = `${normalizedBase}${route}`;
    console.log(`CHECK ROUTE: ${route} (${fullUrl})`);

    try {
      const res = await fetch(fullUrl, {
        redirect: 'follow',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'SyncPod-SmokeTester/1.0',
        },
      });

      // 1. Status 200 check
      if (res.status !== 200) {
        console.error(`  FAIL [Status]: Expected 200, received ${res.status}`);
        failures++;
      } else {
        console.log(`  PASS [Status]: 200 OK (final URL: ${res.url})`);
      }

      // 2. Set-Cookie check
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) {
        console.error(`  FAIL [Set-Cookie]: Unexpected Set-Cookie header found: ${setCookie}`);
        failures++;
      } else {
        console.log(`  PASS [Set-Cookie]: None present`);
      }

      // 3. HTML content checks
      const html = await res.text();

      // Prototype notice check
      if (!html.includes(PROTOTYPE_NOTICE)) {
        console.error(`  FAIL [Prototype Notice]: Missing "${PROTOTYPE_NOTICE}" in HTML`);
        failures++;
      } else {
        console.log(`  PASS [Prototype Notice]: Found "${PROTOTYPE_NOTICE}"`);
      }

      // Localhost leak check
      // Allow localhost ONLY if the smoke target itself is localhost/127.0.0.1
      const isTargetLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(normalizedBase);
      if (!isTargetLocal && /localhost/i.test(html)) {
        console.error(`  FAIL [Localhost Leak]: Found "localhost" in production HTML`);
        failures++;
      } else {
        console.log(`  PASS [Localhost Leak]: None detected in body`);
      }

      // Extract static assets
      const assetMatches = html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g);
      for (const m of assetMatches) {
        collectedStaticAssets.add(m[1]);
      }
      console.log('');
    } catch (err) {
      console.error(`  FAIL [Network Error]: ${err instanceof Error ? err.message : String(err)}\n`);
      failures++;
    }
  }

  // 4. Sample and verify static assets (up to 20)
  const assetList = Array.from(collectedStaticAssets);
  const sampleCount = Math.min(20, assetList.length);
  console.log(`CHECK STATIC ASSETS: Sampled ${sampleCount} of ${assetList.length} discovered /_next/static assets`);

  if (sampleCount === 0) {
    console.error(`  FAIL [Static Assets]: No /_next/static assets discovered in HTML responses`);
    failures++;
  } else {
    // Pick evenly spaced sample if > 20
    const step = assetList.length / sampleCount;
    const sampled = [];
    for (let i = 0; i < sampleCount; i++) {
      sampled.push(assetList[Math.floor(i * step)]);
    }

    let assetFailures = 0;
    for (const assetPath of sampled) {
      const assetUrl = `${normalizedBase}${assetPath}`;
      try {
        const aRes = await fetch(assetUrl, { method: 'HEAD' });
        // Some dev servers or static hosts may prefer GET over HEAD
        const status = aRes.status === 405 ? (await fetch(assetUrl)).status : aRes.status;
        if (status === 200) {
          console.log(`  PASS [Asset]: 200 OK -> ${assetPath}`);
        } else {
          console.error(`  FAIL [Asset]: Expected 200, got ${status} -> ${assetPath}`);
          assetFailures++;
        }
      } catch (err) {
        console.error(`  FAIL [Asset]: Network error for ${assetPath}: ${err.message}`);
        assetFailures++;
      }
    }

    if (assetFailures > 0) {
      failures += assetFailures;
    }
  }

  console.log(`\n========================================`);
  if (failures === 0) {
    console.log(`ALL SMOKE CHECKS PASSED (7 routes + ${sampleCount} static assets)`);
    console.log(`========================================`);
    return 0;
  } else {
    console.error(`SMOKE CHECKS FAILED: ${failures} total failure(s)`);
    console.log(`========================================`);
    return 1;
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith('--help')) {
  console.error('Usage: node scripts/smoke-url.mjs <base-url>');
  console.error('Example: node scripts/smoke-url.mjs http://127.0.0.1:3120');
  console.error('Example: node scripts/smoke-url.mjs https://syncpod-demo.vercel.app');
  process.exit(1);
}

runSmokeTest(args[0])
  .then((exitCode) => process.exit(exitCode))
  .catch((err) => {
    console.error('Fatal smoke test error:', err);
    process.exit(1);
  });
