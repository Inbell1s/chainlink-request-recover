const fs = require('fs');

function createLogger(name) {
    class Logger {
        constructor(prefix) {
            this.prefix = prefix ? `[${prefix}]` : '';
            this.logStream = fs.createWriteStream(`./chainlink-request-recover.log`, { flags: 'a' }); // 'a' flag for append mode
        }

        log(...args) {
            const timestamp = new Date().toISOString();
            const message = `[${timestamp}]${this.prefix} ${args.join(' ')}`;
            this.logStream.write(message+'\n'); // write to file
            console.log(message); // also log to console
        }
    }
    const logger = new Logger(name);
    return logger;
}

module.exports = createLogger;
