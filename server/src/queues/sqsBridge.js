import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { csvQueue } from '../jobs/queue.js';

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const QUEUE_URL = process.env.SQS_IMPORT_QUEUE_URL;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Poll SQS messages and enqueue them to Bull
 */
export async function pollSQSAndEnqueue() {
  if (!QUEUE_URL) {
    console.warn('[SQS Bridge] SQS_IMPORT_QUEUE_URL is not configured. Skipping queue polling.');
    return;
  }

  console.log('[SQS Bridge] Initializing SQS worker loop...');

  while (true) {
    try {
      const response = await sqs.send(new ReceiveMessageCommand({
        QueueUrl:            QUEUE_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds:     20,    // 20s Long polling
      }));

      if (!response.Messages || response.Messages.length === 0) {
        continue;
      }

      for (const message of response.Messages) {
        let body;
        try {
          body = JSON.parse(message.Body);
        } catch (parseErr) {
          console.error('[SQS Bridge] JSON Parse error on message body:', parseErr.message);
          // Delete bad message to avoid infinite loop
          await sqs.send(new DeleteMessageCommand({
            QueueUrl:      QUEUE_URL,
            ReceiptHandle: message.ReceiptHandle,
          }));
          continue;
        }

        // Add to Bull queue for background processor to execute
        await csvQueue.add(body, {
          jobId:   body.batchId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        });

        // Delete from SQS since Bull queue is now responsible for execution/tracking
        await sqs.send(new DeleteMessageCommand({
          QueueUrl:      QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle,
        }));
      }
    } catch (err) {
      console.error('[SQS Bridge] Worker loop encountered error:', err.message);
      await sleep(5000);
    }
  }
}
