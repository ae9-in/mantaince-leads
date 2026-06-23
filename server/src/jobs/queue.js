import { EventEmitter } from 'events';
import crypto from 'crypto';

class InMemoryQueue extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.processor = null;
  }

  process(fn) {
    this.processor = fn;
  }

  async add(data) {
    const jobId = crypto.randomUUID();
    const job = {
      id: jobId,
      data,
      progress: async (value) => {
        console.log(`[Queue ${this.name}] Job ${jobId} progress: ${value}%`);
      }
    };

    // Run the processor asynchronously in the next microtask/event-loop tick
    setImmediate(async () => {
      this.emit('active', job);
      try {
        if (this.processor) {
          await this.processor(job);
        }
        this.emit('completed', job, null);
      } catch (err) {
        this.emit('failed', job, err);
      }
    });

    return job;
  }

  async close() {
    // No-op for in-memory queue
  }
}

// Initialize simple in-memory queue for CSV uploads
export const csvQueue = new InMemoryQueue('csv-upload');

export default csvQueue;

