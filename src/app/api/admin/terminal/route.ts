import { NextRequest, NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Whitelisted safe commands
const SAFE_COMMANDS: Record<string, string> = {
  'pm2 status': 'pm2 jlist',
  'pm2 logs': 'pm2 logs errani-site --nostream --lines 80 2>&1',
  'disk': 'df -h / 2>&1',
  'memory': 'free -h 2>&1 || vm_stat 2>&1',
  'uptime': 'uptime 2>&1',
  'node version': 'node -v 2>&1',
  'npm version': 'npm -v 2>&1',
  'git status': 'cd /var/www/errani && git log --oneline -10 2>&1',
  'git log': 'cd /var/www/errani && git log --oneline -20 2>&1',
  'db status': 'cd /var/www/errani && npx prisma db execute --stdin <<< "SELECT version();" 2>&1 || echo "DB check failed"',
  'env': 'echo "NODE_ENV=$NODE_ENV\nPORT=$PORT\nHOSTNAME=$(hostname)"',
  'processes': 'ps aux --sort=-%mem | head -15 2>&1 || ps aux | head -15 2>&1',
  'network': 'ss -tlnp 2>&1 || netstat -tlnp 2>&1 || echo "Network info unavailable"',
};

// GET — return recent logs
export async function GET(req: NextRequest) {
  const guard = await adminGuard(req);
  if (guard) return guard;

  try {
    const { stdout, stderr } = await execAsync(
      'pm2 logs errani-site --nostream --lines 50 2>&1 || echo "PM2 logs unavailable"',
      { timeout: 10000 }
    );
    return NextResponse.json({ logs: (stdout || stderr || 'No logs available').slice(-8000) });
  } catch {
    return NextResponse.json({ logs: 'Unable to fetch logs' });
  }
}

// POST — execute whitelisted command
export async function POST(req: NextRequest) {
  const guard = await adminGuard(req);
  if (guard) return guard;

  try {
    const { command } = await req.json();
    if (!command || typeof command !== 'string') {
      return NextResponse.json({ output: 'Error: no command specified', commands: Object.keys(SAFE_COMMANDS) });
    }

    const cmd = command.trim().toLowerCase();

    if (cmd === 'help') {
      return NextResponse.json({
        output: 'Available commands:\n' + Object.keys(SAFE_COMMANDS).map(c => `  ${c}`).join('\n') + '\n  help — show this list\n  clear — clear terminal',
      });
    }

    const realCmd = SAFE_COMMANDS[cmd];
    if (!realCmd) {
      return NextResponse.json({
        output: `Unknown command: "${command}"\nType "help" for available commands.`,
      });
    }

    const { stdout, stderr } = await execAsync(realCmd, { timeout: 15000 });
    const output = (stdout || '') + (stderr ? `\n${stderr}` : '');
    return NextResponse.json({ output: output.slice(-8000) || 'Command executed (no output)' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Command failed';
    return NextResponse.json({ output: `Error: ${msg}` });
  }
}
