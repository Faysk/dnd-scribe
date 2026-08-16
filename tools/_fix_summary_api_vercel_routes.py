import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
summary_path = root / 'lib' / 'summary-api.js'
text = summary_path.read_text(encoding='utf-8')

old = """async function handleSummaryApiGet(req, res, path, query, deps) {\n  if (path.startsWith('/api/v1/')) {\n    const db = path === '/api/v1/health' ? null : deps.getPool();\n"""
new = """async function handleSummaryApiGet(req, res, path, query, deps) {\n  if (path === '/api/summary-api-v1') {\n    const route = cleanText(query.get('summaryApiRoute'), 40);\n    if (route === 'health') path = '/api/v1/health';\n    else if (route === 'summaries') path = '/api/v1/summaries';\n    else if (route === 'detail') {\n      const summaryId = cleanText(query.get('summaryId'), 180);\n      path = summaryId ? `/api/v1/summaries/${encodeURIComponent(summaryId)}` : '/api/v1/summaries/';\n    } else path = '/api/v1/__not_found__';\n  }\n  if (path === '/api/integration-api-keys') path = '/api/integrations/api-keys';\n  if (path.startsWith('/api/v1/')) {\n    const db = path === '/api/v1/health' ? null : deps.getPool();\n"""
if text.count(old) != 1:
    raise SystemExit(f'GET marker count={text.count(old)}')
text = text.replace(old, new, 1)

old = """async function handleSummaryApiPost(req, res, path, body, deps) {\n  const routes = new Set([\n"""
new = """async function handleSummaryApiPost(req, res, path, body, deps) {\n  const pathAliases = {\n    '/api/integration-api-keys': '/api/integrations/api-keys',\n    '/api/integration-api-key-revoke': '/api/integrations/api-keys/revoke',\n    '/api/integration-api-key-rotate': '/api/integrations/api-keys/rotate'\n  };\n  path = pathAliases[path] || path;\n  const routes = new Set([\n"""
if text.count(old) != 1:
    raise SystemExit(f'POST marker count={text.count(old)}')
text = text.replace(old, new, 1)
summary_path.write_text(text, encoding='utf-8')

vercel_path = root / 'vercel.json'
vercel = json.loads(vercel_path.read_text(encoding='utf-8'))
rewrites = vercel.setdefault('rewrites', [])
bridges = [
    {'source': '/api/v1/health', 'destination': '/api/summary-api-v1?summaryApiRoute=health'},
    {'source': '/api/v1/summaries', 'destination': '/api/summary-api-v1?summaryApiRoute=summaries'},
    {'source': '/api/v1/summaries/:id', 'destination': '/api/summary-api-v1?summaryApiRoute=detail&summaryId=:id'},
    {'source': '/api/integrations/api-keys', 'destination': '/api/integration-api-keys'},
    {'source': '/api/integrations/api-keys/revoke', 'destination': '/api/integration-api-key-revoke'},
    {'source': '/api/integrations/api-keys/rotate', 'destination': '/api/integration-api-key-rotate'},
]
existing_sources = {item.get('source') for item in rewrites}
for bridge in reversed(bridges):
    if bridge['source'] not in existing_sources:
        rewrites.insert(0, bridge)
vercel_path.write_text(json.dumps(vercel, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Guard the deployment-specific bridge in the normal quality gate.
guard_path = root / 'tools' / 'check_summary_api_guards.js'
guard = guard_path.read_text(encoding='utf-8')
marker = """const openapi = fs.readFileSync(path.join(root, 'web', 'openapi-summary-v1.yaml'), 'utf8');\n"""
insert = """const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));\nconst rewriteMap = new Map((vercel.rewrites || []).map(item => [item.source, item.destination]));\nassert.equal(rewriteMap.get('/api/v1/health'), '/api/summary-api-v1?summaryApiRoute=health');\nassert.equal(rewriteMap.get('/api/v1/summaries'), '/api/summary-api-v1?summaryApiRoute=summaries');\nassert.equal(rewriteMap.get('/api/v1/summaries/:id'), '/api/summary-api-v1?summaryApiRoute=detail&summaryId=:id');\nassert.equal(rewriteMap.get('/api/integrations/api-keys'), '/api/integration-api-keys');\n\nconst openapi = fs.readFileSync(path.join(root, 'web', 'openapi-summary-v1.yaml'), 'utf8');\n"""
if guard.count(marker) != 1:
    raise SystemExit(f'guard marker count={guard.count(marker)}')
guard_path.write_text(guard.replace(marker, insert, 1), encoding='utf-8')

print('Added flat Vercel route bridges for Summary API v1 and API key management.')
