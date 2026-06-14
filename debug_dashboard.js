const fs = require('fs');
const https = require('https');

const TOKEN = "usr_ccbf5e61";
const BASE_URL = "https://drplatform.share.zrok.io";

function fetchJson(path, method = 'GET') {
  return new Promise((resolve) => {
    const options = {
      method,
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    };
    const req = https.request(BASE_URL + path, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: data ? JSON.parse(data) : null });
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e }));
    if (method === 'POST') req.write('{}');
    req.end();
  });
}

async function run() {
  const clustersRes = await fetchJson('/api/clusters');
  const clustersList = clustersRes.data?.clusters || [];
  const primaryId = clustersList[0]?.id || "cloud-primary";
  const recoveryId = clustersList[1]?.id || primaryId;

  console.log(`primaryId: ${primaryId}, recoveryId: ${recoveryId}`);

  const endpoints = {
    cloudValidation: { path: `/api/clusters/${primaryId}/validate`, method: 'POST' },
    edgeValidation: { path: `/api/clusters/${recoveryId}/validate`, method: 'POST' },
    cloudStatus: { path: `/api/clusters/${primaryId}/status` },
    minioStatus: { path: `/api/storage/minio/status` },
    latestEvent: { path: `/api/events/latest` }
  };

  const apiResults = {};
  for (const [key, ep] of Object.entries(endpoints)) {
    apiResults[key] = await fetchJson(ep.path, ep.method);
    console.log(`${key} (${ep.path}): status=${apiResults[key].status}`);
  }

  function getApiResult(key) {
    return apiResults[key]?.ok ? apiResults[key].data : null;
  }

  const validationIssues = ["cloudValidation", "edgeValidation"]
    .map(key => getApiResult(key))
    .filter(result => result?.valid === false)
    .map(result => {
      const failedCheck = result.checks?.find(check => check.status === "failed");
      return failedCheck?.message || `${result.clusterId} validation failed`;
    });

  console.log("validationIssues:", validationIssues);

  const ignoreKeys = ["latestEvent", "eventHistory", "cloudValidation", "edgeValidation", "cloudRtoHistory"];
  const safeErrors = Object.keys(apiResults)
    .filter(key => !ignoreKeys.includes(key))
    .filter(key => !apiResults[key].ok)
    .map(key => `${key} endpoint failed`);

  console.log("safeErrors:", safeErrors);
}
run();
