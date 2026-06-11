resource "aws_elasticache_subnet_group" "data" {
  name       = "admateine-cache-subnet-group-${var.environment}"
  subnet_ids = aws_subnet.private_data[*].id
}

resource "aws_elasticache_parameter_group" "redis71" {
  name   = "admateine-redis71"
  family = "redis7"
}

resource "random_password" "redis_auth" {
  length  = 16
  special = false
}

resource "aws_secretsmanager_secret" "redis_credentials" {
  name = "admateine/production/redis-url"
}

resource "aws_secretsmanager_secret_version" "redis_password" {
  secret_id     = aws_secretsmanager_secret.redis_credentials.id
  secret_string = "rediss://admateine_user:${random_password.redis_auth.result}@${aws_elasticache_replication_group.admateine.primary_endpoint_address}:6379"
}

resource "aws_elasticache_replication_group" "admateine" {
  replication_group_id = "admateine-redis"
  description          = "Redis cluster for caching, pub/sub, BullMQ"

  node_type                  = "cache.t4g.medium"
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true

  engine               = "redis"
  engine_version       = "7.1"
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.redis71.name

  subnet_group_name  = aws_elasticache_subnet_group.data.name
  security_group_ids = [aws_security_group.sg_redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth.result

  snapshot_retention_limit = 3
  snapshot_window          = "02:00-03:00"
}
