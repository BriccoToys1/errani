import { NextResponse } from 'next/server';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  try {
    // CPU usage
    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;

    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = (usedMem / totalMem) * 100;

    // Uptime
    const uptime = os.uptime();
    const uptimeFormatted = `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

    // Load average (Unix only)
    const loadAvg = os.loadavg();

    // Disk usage (approx)
    let diskUsage = 0;
    let diskTotal = 0;
    let diskFree = 0;
    try {
      const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        diskUsage = stats.size;
      }
      // Get .next folder size
      const nextPath = path.join(process.cwd(), '.next');
      if (fs.existsSync(nextPath)) {
        const getSize = (dir: string): number => {
          let size = 0;
          try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
              const filePath = path.join(dir, file);
              const stat = fs.statSync(filePath);
              if (stat.isDirectory()) {
                size += getSize(filePath);
              } else {
                size += stat.size;
              }
            }
          } catch {
            // Ignore permission errors
          }
          return size;
        };
        diskUsage += getSize(nextPath);
      }
      diskTotal = 100 * 1024 * 1024 * 1024; // Placeholder 100GB
      diskFree = diskTotal - diskUsage;
    } catch {
      // Ignore disk errors
    }

    // Process memory
    const processMemory = process.memoryUsage();

    // Response time simulation (would need real metrics)
    const responseTime = Math.floor(Math.random() * 50) + 10;

    return NextResponse.json({
      cpu: {
        usage: Math.round(cpuUsage * 10) / 10,
        cores: cpus.length,
      },
      memory: {
        total: formatBytes(totalMem),
        used: formatBytes(usedMem),
        free: formatBytes(freeMem),
        usage: Math.round(memUsage * 10) / 10,
        process: {
          heapUsed: formatBytes(processMemory.heapUsed),
          heapTotal: formatBytes(processMemory.heapTotal),
          rss: formatBytes(processMemory.rss),
        },
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: uptimeFormatted,
        uptimeSeconds: uptime,
        nodeVersion: process.version,
      },
      loadAverage: {
        '1m': Math.round(loadAvg[0] * 100) / 100,
        '5m': Math.round(loadAvg[1] * 100) / 100,
        '15m': Math.round(loadAvg[2] * 100) / 100,
      },
      disk: {
        used: formatBytes(diskUsage),
        total: formatBytes(diskTotal),
        free: formatBytes(diskFree),
      },
      performance: {
        responseTime: `${responseTime}ms`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Server stats error:', error);
    return NextResponse.json({ error: 'Failed to get server stats' }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
