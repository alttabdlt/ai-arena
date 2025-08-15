#!/usr/bin/env node

/**
 * Cleanup script for stopping all metaverse development processes
 * Handles stubborn ts-node-dev processes that survive normal termination
 */

const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getProcesses() {
  try {
    const result = execSync(
      "ps aux | grep -E 'ts-node-dev|convex|vite|npm-run-all|metaverse-game' | grep -v grep | grep -v cleanup-processes",
      { encoding: 'utf-8' }
    );
    return result.trim().split('\n').filter(line => line.length > 0);
  } catch (error) {
    return [];
  }
}

function killProcess(pid, signal = 'TERM') {
  try {
    process.kill(pid, signal);
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  log('\n🔍 Checking for running metaverse processes...', 'cyan');
  
  let processes = getProcesses();
  
  if (processes.length === 0) {
    log('✅ No metaverse processes found running', 'green');
    return;
  }
  
  log(`\n⚠️  Found ${processes.length} processes to clean up:`, 'yellow');
  processes.forEach(p => {
    const parts = p.split(/\s+/);
    const pid = parts[1];
    const cmd = parts.slice(10).join(' ').substring(0, 80);
    log(`  PID ${pid}: ${cmd}...`, 'blue');
  });
  
  // Step 1: Try graceful shutdown (SIGTERM)
  log('\n📋 Attempting graceful shutdown...', 'cyan');
  
  const pids = processes.map(p => parseInt(p.split(/\s+/)[1]));
  let killedCount = 0;
  
  pids.forEach(pid => {
    if (killProcess(pid, 'TERM')) {
      killedCount++;
    }
  });
  
  // Wait a moment for processes to terminate
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 2: Check if any processes are still running
  processes = getProcesses();
  
  if (processes.length > 0) {
    log(`\n⚠️  ${processes.length} stubborn processes remaining, force killing...`, 'yellow');
    
    const stubbornPids = processes.map(p => parseInt(p.split(/\s+/)[1]));
    stubbornPids.forEach(pid => {
      killProcess(pid, 'KILL');
    });
    
    killedCount += stubbornPids.length;
  }
  
  // Step 3: Kill processes by port
  log('\n🔌 Checking ports...', 'cyan');
  const ports = [5000, 5001, 5174, 5175, 8080, 4000];
  
  ports.forEach(port => {
    try {
      const portPids = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' })
        .trim()
        .split('\n')
        .filter(pid => pid.length > 0);
      
      if (portPids.length > 0) {
        log(`  Port ${port}: killing PIDs ${portPids.join(', ')}`, 'yellow');
        portPids.forEach(pid => {
          try {
            process.kill(parseInt(pid), 'KILL');
            killedCount++;
          } catch (error) {
            // Process might already be dead
          }
        });
      }
    } catch (error) {
      // No processes on this port
    }
  });
  
  // Step 4: Clean up temporary files
  log('\n🗑️  Cleaning up temporary files...', 'cyan');
  
  try {
    // Clean ts-node-dev hook files
    execSync('rm -f /var/folders/*/T/ts-node-dev-hook-*.js 2>/dev/null', { shell: true });
    
    // Clean any .pid files
    const pidFiles = [
      path.join(__dirname, '..', '.convex.pid'),
      path.join(__dirname, '..', 'backend', '.ts-node-dev.pid')
    ];
    
    pidFiles.forEach(pidFile => {
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
        log(`  Removed ${path.basename(pidFile)}`, 'green');
      }
    });
  } catch (error) {
    // Ignore cleanup errors
  }
  
  // Final verification
  processes = getProcesses();
  
  if (processes.length === 0) {
    log(`\n✅ Successfully cleaned up ${killedCount} processes!`, 'green');
    log('🎉 All metaverse processes have been terminated.\n', 'green');
  } else {
    log(`\n⚠️  Warning: ${processes.length} processes may still be running:`, 'red');
    processes.forEach(p => {
      const parts = p.split(/\s+/);
      const pid = parts[1];
      log(`  PID ${pid}`, 'red');
    });
    log('\nTry running: npm run stop:force', 'yellow');
  }
}

// Handle script termination
process.on('SIGINT', () => {
  log('\n\n👋 Cleanup script interrupted', 'yellow');
  process.exit(0);
});

// Run the cleanup
main().catch(error => {
  log(`\n❌ Error during cleanup: ${error.message}`, 'red');
  process.exit(1);
});