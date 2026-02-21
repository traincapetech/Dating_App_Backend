import winston from 'winston';
import {config} from './env.js';

const {combine, timestamp, json, printf, colorize} = winston.format;

// Custom format for local development
const devFormat = printf(({level, message, timestamp, ...metadata}) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: combine(timestamp(), json()), // Default to JSON for easy parsing
  transports: [
    new winston.transports.Console({
      format:
        config.nodeEnv === 'production'
          ? combine(timestamp(), json())
          : combine(colorize(), timestamp(), devFormat),
    }),
  ],
});

// Create a stream object for Morgan integration (legacy support if needed)
logger.stream = {
  write: message => {
    logger.info(message.trim());
  },
};

export default logger;
