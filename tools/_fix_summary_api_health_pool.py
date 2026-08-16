from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'lib' / 'summary-api.js'
text = path.read_text(encoding='utf-8')
old = """  if (path.startsWith('/api/v1/')) {\n    const handled = await handleExternalSummaryGet(req, res, path, query, deps.getPool());\n"""
new = """  if (path.startsWith('/api/v1/')) {\n    const db = path === '/api/v1/health' ? null : deps.getPool();\n    const handled = await handleExternalSummaryGet(req, res, path, query, db);\n"""
if text.count(old) != 1:
    raise SystemExit(f'expected summary API GET marker once, found {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Summary API health now avoids opening the database pool.')
