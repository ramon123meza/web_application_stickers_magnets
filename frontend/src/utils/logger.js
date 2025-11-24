/**
 * @fileoverview Comprehensive logging system for Sticker & Magnet Lab
 * Provides structured logging with different levels and issue tracking
 * @module utils/logger
 */

/**
 * Log levels with corresponding numeric priorities
 * @constant {Object}
 */
export const LOG_LEVELS = {
  TRACE: { name: 'TRACE', priority: 0, color: '#9CA3AF' },
  DEBUG: { name: 'DEBUG', priority: 1, color: '#3B82F6' },
  INFO: { name: 'INFO', priority: 2, color: '#10B981' },
  WARN: { name: 'WARN', priority: 3, color: '#F59E0B' },
  ERROR: { name: 'ERROR', priority: 4, color: '#EF4444' },
  FATAL: { name: 'FATAL', priority: 5, color: '#7C2D12' }
};

/**
 * Categories for organizing logs
 * @constant {Object}
 */
export const LOG_CATEGORIES = {
  API: 'API',
  AUTH: 'AUTH', 
  CANVAS: 'CANVAS',
  UPLOAD: 'UPLOAD',
  PAYMENT: 'PAYMENT',
  ORDER: 'ORDER',
  UI: 'UI',
  VALIDATION: 'VALIDATION',
  COMPRESSION: 'COMPRESSION',
  GENERAL: 'GENERAL'
};

/**
 * Configuration for the logger
 */
class LoggerConfig {
  constructor() {
    this.level = LOG_LEVELS.INFO;
    this.enabledCategories = new Set(Object.values(LOG_CATEGORIES));
    this.enableConsole = true;
    this.enableStorage = true;
    this.maxStorageEntries = 1000;
    this.enableRemoteLogging = false;
    this.remoteEndpoint = null;
  }

  setLevel(level) {
    this.level = level;
    return this;
  }

  setCategories(categories) {
    this.enabledCategories = new Set(categories);
    return this;
  }

  enableConsoleOutput(enable = true) {
    this.enableConsole = enable;
    return this;
  }

  enableLocalStorage(enable = true) {
    this.enableStorage = enable;
    return this;
  }

  setMaxStorageEntries(max) {
    this.maxStorageEntries = max;
    return this;
  }
}

/**
 * Log entry structure
 */
class LogEntry {
  constructor(level, category, message, context = {}, error = null) {
    this.timestamp = new Date().toISOString();
    this.level = level.name;
    this.category = category;
    this.message = message;
    this.context = context;
    this.error = error ? this.serializeError(error) : null;
    this.sessionId = this.getSessionId();
    this.userAgent = navigator.userAgent;
    this.url = window.location.href;
    this.id = this.generateId();
  }

  serializeError(error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...error
    };
  }

  getSessionId() {
    let sessionId = sessionStorage.getItem('loggerSessionId');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('loggerSessionId', sessionId);
    }
    return sessionId;
  }

  generateId() {
    return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Main Logger class
 */
class Logger {
  constructor() {
    this.config = new LoggerConfig();
    this.storage = [];
    this.listeners = new Set();
    this.issueTracker = new IssueTracker();
    
    // Initialize development mode
    if (process.env.NODE_ENV === 'development') {
      this.config.setLevel(LOG_LEVELS.DEBUG);
    }

    // Handle uncaught errors
    this.setupGlobalErrorHandling();
  }

  /**
   * Configure the logger
   * @param {Function} configFn - Configuration function
   */
  configure(configFn) {
    configFn(this.config);
    return this;
  }

  /**
   * Add a listener for log entries
   * @param {Function} listener - Function to call with each log entry
   */
  addListener(listener) {
    this.listeners.add(listener);
    return this;
  }

  /**
   * Remove a listener
   * @param {Function} listener - Listener function to remove
   */
  removeListener(listener) {
    this.listeners.delete(listener);
    return this;
  }

  /**
   * Setup global error handling
   */
  setupGlobalErrorHandling() {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error(LOG_CATEGORIES.GENERAL, 'Unhandled Promise Rejection', {
        reason: event.reason,
        promise: event.promise
      }, event.reason);
    });

    // Global errors
    window.addEventListener('error', (event) => {
      this.error(LOG_CATEGORIES.GENERAL, 'Global JavaScript Error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        message: event.message
      }, event.error);
    });

    // Resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.warn(LOG_CATEGORIES.GENERAL, 'Resource Load Error', {
          tagName: event.target.tagName,
          src: event.target.src || event.target.href,
          type: event.target.type
        });
      }
    }, true);
  }

  /**
   * Create a log entry
   * @param {Object} level - Log level
   * @param {string} category - Log category 
   * @param {string} message - Log message
   * @param {Object} context - Additional context
   * @param {Error} error - Error object if applicable
   */
  log(level, category, message, context = {}, error = null) {
    // Check if logging is enabled for this level and category
    if (level.priority < this.config.level.priority) {
      return;
    }

    if (!this.config.enabledCategories.has(category)) {
      return;
    }

    const entry = new LogEntry(level, category, message, context, error);

    // Store in memory
    if (this.config.enableStorage) {
      this.storage.push(entry);
      if (this.storage.length > this.config.maxStorageEntries) {
        this.storage.shift(); // Remove oldest entry
      }
    }

    // Console output
    if (this.config.enableConsole) {
      this.outputToConsole(entry, level);
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch (err) {
        console.error('Logger listener error:', err);
      }
    });

    // Track issues
    if (level.priority >= LOG_LEVELS.WARN.priority) {
      this.issueTracker.track(entry);
    }

    // Remote logging
    if (this.config.enableRemoteLogging && this.config.remoteEndpoint) {
      this.sendToRemote(entry);
    }
  }

  /**
   * Output log entry to console with formatting
   */
  outputToConsole(entry, level) {
    const timestamp = entry.timestamp.split('T')[1].split('.')[0];
    const prefix = `[${timestamp}] [${level.name}] [${entry.category}]`;
    
    const style = `color: ${level.color}; font-weight: bold;`;
    
    if (entry.error) {
      console.groupCollapsed(`%c${prefix} ${entry.message}`, style);
      console.error('Error:', entry.error);
      if (entry.context && Object.keys(entry.context).length > 0) {
        console.log('Context:', entry.context);
      }
      console.groupEnd();
    } else {
      const method = level.priority >= LOG_LEVELS.ERROR.priority ? 'error' :
                   level.priority >= LOG_LEVELS.WARN.priority ? 'warn' :
                   'log';
      
      console[method](`%c${prefix} ${entry.message}`, style, entry.context);
    }
  }

  /**
   * Send log entry to remote endpoint
   */
  async sendToRemote(entry) {
    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      // Don't log this error to avoid infinite loops
      console.error('Failed to send log to remote:', error);
    }
  }

  // Convenience methods for different log levels
  trace(category, message, context = {}) {
    this.log(LOG_LEVELS.TRACE, category, message, context);
  }

  debug(category, message, context = {}) {
    this.log(LOG_LEVELS.DEBUG, category, message, context);
  }

  info(category, message, context = {}) {
    this.log(LOG_LEVELS.INFO, category, message, context);
  }

  warn(category, message, context = {}, error = null) {
    this.log(LOG_LEVELS.WARN, category, message, context, error);
  }

  error(category, message, context = {}, error = null) {
    this.log(LOG_LEVELS.ERROR, category, message, context, error);
  }

  fatal(category, message, context = {}, error = null) {
    this.log(LOG_LEVELS.FATAL, category, message, context, error);
  }

  /**
   * Get stored log entries
   * @param {Object} filters - Filters to apply
   * @returns {Array} Filtered log entries
   */
  getLogs(filters = {}) {
    let logs = [...this.storage];

    if (filters.level) {
      logs = logs.filter(log => log.level === filters.level);
    }

    if (filters.category) {
      logs = logs.filter(log => log.category === filters.category);
    }

    if (filters.after) {
      logs = logs.filter(log => new Date(log.timestamp) > new Date(filters.after));
    }

    if (filters.before) {
      logs = logs.filter(log => new Date(log.timestamp) < new Date(filters.before));
    }

    return logs;
  }

  /**
   * Get logs as formatted string
   * @param {Object} filters - Filters to apply
   * @returns {string} Formatted log string
   */
  getLogsAsString(filters = {}) {
    const logs = this.getLogs(filters);
    return logs.map(log => {
      let output = `[${log.timestamp}] [${log.level}] [${log.category}] ${log.message}`;
      
      if (Object.keys(log.context).length > 0) {
        output += `\nContext: ${JSON.stringify(log.context, null, 2)}`;
      }
      
      if (log.error) {
        output += `\nError: ${log.error.message}\n${log.error.stack}`;
      }
      
      return output;
    }).join('\n\n');
  }

  /**
   * Export logs as downloadable file
   */
  exportLogs(filename = `logs-${new Date().toISOString().split('T')[0]}.json`) {
    const data = JSON.stringify(this.storage, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Clear stored logs
   */
  clear() {
    this.storage = [];
    this.issueTracker.clear();
  }

  /**
   * Get issue summary
   */
  getIssues() {
    return this.issueTracker.getSummary();
  }
}

/**
 * Issue tracker for monitoring application health
 */
class IssueTracker {
  constructor() {
    this.issues = new Map();
    this.maxIssues = 100;
  }

  track(logEntry) {
    const key = `${logEntry.category}-${logEntry.level}`;
    
    if (!this.issues.has(key)) {
      this.issues.set(key, {
        category: logEntry.category,
        level: logEntry.level,
        count: 0,
        lastOccurred: null,
        firstOccurred: null,
        samples: []
      });
    }

    const issue = this.issues.get(key);
    issue.count++;
    issue.lastOccurred = logEntry.timestamp;
    
    if (!issue.firstOccurred) {
      issue.firstOccurred = logEntry.timestamp;
    }

    // Keep a few samples
    if (issue.samples.length < 5) {
      issue.samples.push({
        message: logEntry.message,
        context: logEntry.context,
        timestamp: logEntry.timestamp
      });
    }
  }

  getSummary() {
    return Array.from(this.issues.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, this.maxIssues);
  }

  clear() {
    this.issues.clear();
  }
}

// Create and export singleton instance
const logger = new Logger();

export default logger;

// Export categories and levels for convenience
export { LOG_CATEGORIES as CATEGORIES, LOG_LEVELS as LEVELS };

// Create category-specific loggers for better ergonomics
export const apiLogger = {
  debug: (msg, ctx) => logger.debug(LOG_CATEGORIES.API, msg, ctx),
  info: (msg, ctx) => logger.info(LOG_CATEGORIES.API, msg, ctx),
  warn: (msg, ctx, err) => logger.warn(LOG_CATEGORIES.API, msg, ctx, err),
  error: (msg, ctx, err) => logger.error(LOG_CATEGORIES.API, msg, ctx, err),
};

export const canvasLogger = {
  debug: (msg, ctx) => logger.debug(LOG_CATEGORIES.CANVAS, msg, ctx),
  info: (msg, ctx) => logger.info(LOG_CATEGORIES.CANVAS, msg, ctx),
  warn: (msg, ctx, err) => logger.warn(LOG_CATEGORIES.CANVAS, msg, ctx, err),
  error: (msg, ctx, err) => logger.error(LOG_CATEGORIES.CANVAS, msg, ctx, err),
};

export const uploadLogger = {
  debug: (msg, ctx) => logger.debug(LOG_CATEGORIES.UPLOAD, msg, ctx),
  info: (msg, ctx) => logger.info(LOG_CATEGORIES.UPLOAD, msg, ctx),
  warn: (msg, ctx, err) => logger.warn(LOG_CATEGORIES.UPLOAD, msg, ctx, err),
  error: (msg, ctx, err) => logger.error(LOG_CATEGORIES.UPLOAD, msg, ctx, err),
};

export const paymentLogger = {
  debug: (msg, ctx) => logger.debug(LOG_CATEGORIES.PAYMENT, msg, ctx),
  info: (msg, ctx) => logger.info(LOG_CATEGORIES.PAYMENT, msg, ctx),
  warn: (msg, ctx, err) => logger.warn(LOG_CATEGORIES.PAYMENT, msg, ctx, err),
  error: (msg, ctx, err) => logger.error(LOG_CATEGORIES.PAYMENT, msg, ctx, err),
};

export const orderLogger = {
  debug: (msg, ctx) => logger.debug(LOG_CATEGORIES.ORDER, msg, ctx),
  info: (msg, ctx) => logger.info(LOG_CATEGORIES.ORDER, msg, ctx),
  warn: (msg, ctx, err) => logger.warn(LOG_CATEGORIES.ORDER, msg, ctx, err),
  error: (msg, ctx, err) => logger.error(LOG_CATEGORIES.ORDER, msg, ctx, err),
};