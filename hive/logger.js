const fs = require('fs');
const path = require('path');
const util = require('util');

class Logger {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.logDir = path.join(__dirname, 'logs');
    this.logFile = path.join(this.logDir, `${serviceName}.log`);
    this.errorFile = path.join(this.logDir, `${serviceName}.error.log`);
    
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    this.errorStream = fs.createWriteStream(this.errorFile, { flags: 'a' });
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${this.serviceName}] ${message}${metaStr}\n`;
  }

  log(level, message, meta) {
    const formatted = this.formatMessage(level, message, meta);
    
    if (level === 'ERROR') {
      this.errorStream.write(formatted);
      console.error(formatted.trim());
    } else {
      this.logStream.write(formatted);
      console.log(formatted.trim());
    }
  }

  info(message, meta) {
    this.log('INFO', message, meta);
  }

  warn(message, meta) {
    this.log('WARN', message, meta);
  }

  error(message, error, meta) {
    const errorMeta = {
      ...meta,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        code: error.code
      } : error
    };
    this.log('ERROR', message, errorMeta);
  }

  debug(message, meta) {
    if (process.env.DEBUG) {
      this.log('DEBUG', message, meta);
    }
  }

  close() {
    this.logStream.end();
    this.errorStream.end();
  }
}

module.exports = Logger;