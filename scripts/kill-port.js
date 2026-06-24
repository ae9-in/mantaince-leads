/**
 * kill-port.js — Frees port 5000 before starting the dev server.
 * Works on Windows (netstat + taskkill) and Unix (lsof/fuser).
 * Safe to call even when the port is not in use.
 */
import { execSync } from 'child_process';

const PORT = process.env.PORT || 5000;

function killPortWindows(port) {
  try {
    const output = execSync('netstat -ano', { encoding: 'utf8' });
    const pids = new Set();
    for (const line of output.split('\n')) {
      // Match lines like: TCP  0.0.0.0:5000  ...  LISTENING  12345
      if (line.includes(`:${port}`) && line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
    }
    if (pids.size === 0) {
      console.log(`✅ Port ${port} is free — ready to start.`);
      return;
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
        console.log(`✅ Freed port ${port} by terminating PID ${pid}`);
      } catch (_) {
        // Process may have already exited
      }
    }
    // Small wait so the OS releases the socket before nodemon starts
    execSync('timeout /T 1 /NOBREAK', { stdio: 'ignore' });
  } catch (err) {
    // Not fatal — netstat may fail in some environments
    console.warn(`⚠️  kill-port: ${err.message}`);
  }
}

function killPortUnix(port) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
    console.log(`✅ Freed port ${port}`);
  } catch (_) {
    console.log(`✅ Port ${port} is free — ready to start.`);
  }
}

if (process.platform === 'win32') {
  killPortWindows(PORT);
} else {
  killPortUnix(PORT);
}
