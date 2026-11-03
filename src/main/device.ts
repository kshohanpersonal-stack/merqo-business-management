/** Windows device fingerprint: several hashed identifiers with majority matching. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { developmentFingerprint } from '../core/config';

function hash(value: string): string {
  return createHash('sha256')
    .update(value.trim() || 'unavailable')
    .digest('hex');
}
function run(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      timeout: 6000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }) as string;
  } catch {
    return '';
  }
}
export function windowsDeviceFingerprint(): string {
  if (process.platform !== 'win32') return developmentFingerprint();
  const machine = run('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid']);
  const disk = run('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    '(Get-CimInstance Win32_DiskDrive | Select-Object -First 1 -ExpandProperty SerialNumber)',
  ]);
  const cpu = run('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    '(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty ProcessorId)',
  ]);
  const user = run('whoami', ['/user']);
  return JSON.stringify({ machine: hash(machine), disk: hash(disk), cpu: hash(cpu), user: hash(user) });
}
