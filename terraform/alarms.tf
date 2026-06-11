resource "aws_sns_topic" "alerts" {
  name = "admateine-alarms-alerts-topic"
}

# P99 response time > 500ms
resource "aws_cloudwatch_metric_alarm" "api_latency_p99" {
  alarm_name          = "admateine-api-latency-p99-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  threshold           = 500
  alarm_description   = "API P99 latency > 500ms for 3 consecutive minutes"

  metric_name = "TargetResponseTime"
  namespace   = "AWS/ApplicationELB"
  statistic   = "Average" # Fallback metric calculation
  period      = 60
  dimensions  = { LoadBalancer = aws_lb.admateine.arn_suffix }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

# 5xx error rate > 1
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "admateine-api-5xx-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 1
  alarm_description   = "API 5xx error rate > 1%"

  metric_name = "HTTPCode_Target_5XX_Count"
  namespace   = "AWS/ApplicationELB"
  statistic   = "Sum"
  period      = 60
  dimensions  = { LoadBalancer = aws_lb.admateine.arn_suffix }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

# RDS CPU > 80%
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "admateine-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  threshold           = 80
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  statistic           = "Average"
  period              = 60
  dimensions          = { DBInstanceIdentifier = aws_db_instance.admateine_primary.id }
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# ElastiCache evictions > 0 (cache is full)
resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  alarm_name          = "admateine-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  statistic           = "Sum"
  period              = 300
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# SQS DLQ has messages
resource "aws_cloudwatch_metric_alarm" "import_dlq" {
  alarm_name          = "admateine-import-dlq-has-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  statistic           = "Sum"
  period              = 60
  dimensions          = { QueueName = aws_sqs_queue.lead_import_dlq.name }
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
