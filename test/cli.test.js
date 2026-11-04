/** CLI regressions: temporary HOME, fixture keys and local HTTP only. */
const { spawn } = require('child_process');
const { mkdtempSync, readFileSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const http = require('http');
const CLI = resolve(__dirname, '../bin/claude-flow.js');
function launch(args, home, answers = []) {
  const child = spawn(process.execPath, [CLI, ...args], {
    env: { ...process.env, HOME: home, USERPROFILE: home }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '', next = 0, cursor = 0;
  const done = new Promise((resolveResult, reject) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`CLI timed out: ${args.join(' ')}\n${stdout}\n${stderr}`)); }, 10000);
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      while (next < answers.length) {
        const [prompt, answer] = answers[next];
        const at = stdout.indexOf(prompt, cursor);
        if (at < 0) break;
        cursor = at + prompt.length; next++; child.stdin.write(answer + '\n');
      }
    });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => { clearTimeout(timer); resolveResult({ code, stdout, stderr, answered: next }); });
  });
  return { child, done, output: () => ({ stdout, stderr }) };
}
async function waitForProxy(running) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const match = running.output().stderr.match(/Listening:.*?http:\/\/127\.0\.0\.1:(\d+)/);
    if (match) return Number(match[1]);
    if (running.child.exitCode !== null) throw new Error(`Proxy exited: ${running.output().stderr}`);
    await new Promise(resolveWait => setTimeout(resolveWait, 10));
  }
  throw new Error('Standalone proxy did not start');
}
module.exports = async function runCliTests(assert) {
  console.log('\nCLI custom-provider onboarding:');
  const home = mkdtempSync(join(tmpdir(), 'claude-flow-cli-'));
  const requests = [];
  const upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      requests.push({ path: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'message', content: [{ type: 'text', text: 'fixture reply' }] }));
    });
  });
  let standalone;
  try {
    await new Promise(resolveListen => upstream.listen(0, '127.0.0.1', resolveListen));
    const url = `http://127.0.0.1:${upstream.address().port}/custom`;
    const setup = await launch(['setup', 'custom'], home, [
      ['API base URL', 'ftp://invalid.example'],
      ['API base URL', 'https://user:fixture@invalid.example'],
      ['API base URL', 'https://invalid.example?token=fixture'],
      ['API base URL', 'https://invalid.example#fragment'],
      ['API base URL', url + '/'], ['API Key', 'fixture-key-not-real'],
      ['Haiku model', 'fixture-haiku'], ['Sonnet model', 'fixture-sonnet'], ['Opus model', 'fixture-opus'],
    ]).done;
    assert(setup.code === 0, 'CLI setup custom completes');
    assert(setup.answered === 9, 'CLI setup rejects non-HTTP, credential, query and fragment URLs');
    assert(setup.stdout.split('Enter an http:// or https:// base URL').length - 1 === 4, 'CLI validates invalid URLs before asking for a key');
    const saved = JSON.parse(readFileSync(join(home, '.claude-flow', 'config.json'), 'utf8'));
    assert(saved.providers.custom.baseUrl === url, 'CLI setup persists normalized base URL');
    assert(saved.providers.custom.apiKey === 'fixture-key-not-real', 'CLI setup stores fixture key');
    const repeat = await launch(['setup', 'custom'], home, [
      ['API base URL', ''], ['API Key', ''], ['Haiku model', ''], ['Sonnet model', ''], ['Opus model', ''],
    ]).done;
    assert(repeat.code === 0, 'CLI setup reuses existing custom settings');
    const env = await launch(['env', 'custom'], home).done;
    assert(env.code === 0 && env.stdout.includes(`ANTHROPIC_BASE_URL='${url}'`), 'CLI env honors saved custom URL');
    const direct = await launch(['run', 'custom', '--no-proxy', '--', process.execPath,
      '-e', 'process.stdout.write(process.env.ANTHROPIC_BASE_URL)'], home).done;
    assert(direct.code === 0 && direct.stdout === url, 'CLI run --no-proxy passes saved custom URL');
    const childScript = `fetch(process.env.ANTHROPIC_BASE_URL + '/v1/messages', {
      method: 'POST', headers: {'content-type':'application/json'},
      body: JSON.stringify({model:'fixture-sonnet',messages:[{role:'user',content:'fixture'}]})
    }).then(async r => { if (!r.ok) throw new Error(await r.text()); process.stdout.write(await r.text()); })
      .catch(e => { console.error(e); process.exit(1); });`;
    const proxied = await launch(['run', 'custom', '--', process.execPath, '-e', childScript], home).done;
    assert(proxied.code === 0 && proxied.stdout.includes('fixture reply'), 'CLI run uses saved custom upstream through proxy');
    assert(requests[0]?.path === '/custom/v1/messages', 'CLI run preserves upstream path prefix');
    assert(requests[0]?.auth === 'Bearer fixture-key-not-real', 'CLI run uses custom Bearer auth');
    standalone = launch(['proxy', 'custom', '--port', '0'], home);
    const port = await waitForProxy(standalone);
    const response = await fetch(`http://127.0.0.1:${port}/v1/messages`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'fixture-sonnet', messages: [{ role: 'user', content: 'fixture' }] }),
    });
    await response.text();
    assert(response.status === 200 && requests[1]?.path === '/custom/v1/messages', 'CLI standalone proxy honors saved custom upstream');
    standalone.child.kill('SIGTERM');
    const stopped = await standalone.done;
    assert(stopped.code === 0, 'CLI standalone proxy shuts down cleanly');
    standalone = null;
  } finally {
    if (standalone) { standalone.child.kill('SIGTERM'); await standalone.done; }
    await new Promise(resolveClose => upstream.close(resolveClose));
    rmSync(home, { recursive: true, force: true });
  }
};
