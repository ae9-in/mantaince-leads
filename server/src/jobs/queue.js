import Queue from 'bull';
import { REDIS_URL } from '../config/env.js';

// Initialize Bull queue for CSV uploads
export const csvQueue = new Queue('csv-upload', REDIS_URL);

export default csvQueue;
