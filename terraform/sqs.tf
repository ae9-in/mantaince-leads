resource "aws_sqs_queue" "lead_import" {
  name                        = "admateine-lead-import"
  visibility_timeout_seconds  = 900
  message_retention_seconds   = 86400
  max_message_size            = 262144
  receive_wait_time_seconds   = 20

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.lead_import_dlq.arn,
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue" "lead_import_dlq" {
  name                      = "admateine-lead-import-dlq"
  message_retention_seconds = 604800 # 7 days
}

resource "aws_secretsmanager_secret" "sqs_queue_url" {
  name = "admateine/production/sqs-url"
}

resource "aws_secretsmanager_secret_version" "sqs_queue_url" {
  secret_id     = aws_secretsmanager_secret.sqs_queue_url.id
  secret_string = aws_sqs_queue.lead_import.id
}
