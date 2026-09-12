import { describe, expect, it } from 'vitest';
import { runBoundedProcess } from '../../server/process.js';

describe('bounded local model process boundary', () => {
  it('passes untrusted prompt characters as literal stdin, never shell code', async () => {
    const input = '$(touch /tmp/address-should-not-run) `echo SECRET` ;\nplain';
    const result = await runBoundedProcess({
      binary: process.execPath,
      args: ['-e', 'process.stdin.setEncoding("utf8");let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>process.stdout.write(JSON.stringify({text:s})))'],
      input, timeoutMs: 2000,
    });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout).text).toBe(input);
  });

  it('terminates a stalled worker and reports a timeout instead of hanging the job', async () => {
    const started = Date.now();
    await expect(runBoundedProcess({
      binary: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'],
      input: '', timeoutMs: 100,
    })).rejects.toMatchObject({ code: 'PROCESS_TIMEOUT' });
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('rejects oversized output and terminates the worker', async () => {
    await expect(runBoundedProcess({
      binary: process.execPath, args: ['-e', 'process.stdout.write("x".repeat(20000));setInterval(()=>{},1000)'],
      input: '', timeoutMs: 2000, maxOutputBytes: 1000,
    })).rejects.toMatchObject({ code: 'PROCESS_OUTPUT_LIMIT' });
  });

  it('distinguishes an unsuccessful model command from a successful response', async () => {
    const result = await runBoundedProcess({
      binary: process.execPath, args: ['-e', 'process.stderr.write("model unavailable");process.exit(7)'],
      input: '', timeoutMs: 2000,
    });
    expect(result.exitCode).toBe(7);
    expect(result.stderr).toBe('model unavailable');
  });
});
