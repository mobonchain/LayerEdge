import chalk from "chalk";

class Logger {
    constructor(verbose = true) {
        this.verbose = verbose;
    }

    _formatTimestamp() {
        return chalk.gray(`[${new Date().toLocaleTimeString()}]`);
    }

    _getLevelStyle(level) {
        const styles = {
            info: chalk.blueBright.bold,
            warn: chalk.yellowBright.bold,
            error: chalk.redBright.bold,
            success: chalk.greenBright.bold,
            debug: chalk.magentaBright.bold,
            verbose: chalk.cyan.bold,
        };
        return styles[level] || chalk.white;
    }

    _formatError(error) {
        if (!error) return '';

        let details = "";
        if (error.response) {
            details = `
            Status: ${error.response?.status || 'N/A'}
            URL: ${error.config?.url || 'N/A'}
            Response: ${JSON.stringify(error.response?.data || {}, null, 2)}
            `;
        }
        return `${error.message}${details}`;
    }

    log(level, message, value = '', error = null) {
        const timestamp = this._formatTimestamp();
        const levelStyle = this._getLevelStyle(level);
        const header = chalk.cyan('◆ LayerEdge Auto Bot');

        let formattedMessage = `${header} ${timestamp} ${levelStyle(`[${level.toUpperCase()}]`)} ${message}`;
        if (value) formattedMessage += ` ${chalk.green(value)}`;
        if (error && this.verbose) formattedMessage += `\n${chalk.red(this._formatError(error))}`;

        console.log(formattedMessage);
    }

    info = (msg, val = '') => this.log('info', msg, val);
    warn = (msg, val = '') => this.log('warn', msg, val);
    error = (msg, val = '', err = null) => this.log('error', msg, val, err);
    success = (msg, val = '') => this.log('success', msg, val);
    debug = (msg, val = '') => this.log('debug', msg, val);
    verbose = (msg, val = '') => this.verbose && this.log('verbose', msg, val);
}

export default new Logger();
