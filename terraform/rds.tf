resource "aws_db_subnet_group" "data" {
  name       = "admateine-db-subnet-group-${var.environment}"
  subnet_ids = aws_subnet.private_data[*].id
}

resource "aws_kms_key" "rds" {
  description             = "KMS Key for RDS encryption"
  deletion_window_in_days = 7
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name = "admateine/production/db-credentials"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_credentials.id
  secret_string = random_password.db_pass.result
}

resource "random_password" "db_pass" {
  length  = 16
  special = false
}

resource "aws_db_instance" "admateine_primary" {
  identifier              = "admateine-postgres-primary"
  engine                  = "postgres"
  engine_version          = "16.2"
  instance_class          = "db.t4g.medium"
  allocated_storage       = 50
  max_allocated_storage   = 200
  storage_type            = "gp3"
  storage_encrypted       = true
  kms_key_id              = aws_kms_key.rds.arn

  db_name  = "admateine"
  username = "admateine_admin"
  password = random_password.db_pass.result

  multi_az               = true
  publicly_accessible    = false
  vpc_security_group_ids = [aws_security_group.sg_rds.id]
  db_subnet_group_name   = aws_db_subnet_group.data.name

  backup_retention_period = 14
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_monitoring.arn

  deletion_protection = false

  parameter_group_name = aws_db_parameter_group.postgres16.name
}

resource "aws_db_instance" "admateine_replica" {
  identifier             = "admateine-postgres-replica"
  replicate_source_db    = aws_db_instance.admateine_primary.identifier
  instance_class         = "db.t4g.small"
  publicly_accessible    = false
  vpc_security_group_ids = [aws_security_group.sg_rds.id]

  performance_insights_enabled = true
}

resource "aws_db_parameter_group" "postgres16" {
  name   = "admateine-postgres16"
  family = "postgres16"

  parameter {
    name  = "shared_buffers"
    value = "131072" # 1GB in blocks (128MB * 8)
  }
  parameter {
    name  = "effective_cache_size"
    value = "393216" # 3GB in blocks
  }
  parameter {
    name  = "work_mem"
    value = "16384" # 16MB in KB
  }
  parameter {
    name  = "max_connections"
    value = "200"
  }
  parameter {
    name  = "random_page_cost"
    value = "1.1"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "500"
  }
}

# ── RDS Proxy ───────────────────────────────────────────────────────────────

resource "aws_db_proxy" "admateine" {
  name                   = "admateine-rds-proxy"
  debug_logging          = false
  engine_family          = "POSTGRESQL"
  idle_client_timeout    = 1800
  require_tls            = true
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_security_group_ids = [aws_security_group.sg_rds_proxy.id]
  vpc_subnet_ids         = aws_subnet.private_data[*].id

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.db_credentials.arn
  }
}

resource "aws_db_proxy_default_target_group" "admateine" {
  db_proxy_name = aws_db_proxy.admateine.name

  connection_pool_config {
    connection_borrow_timeout    = 120
    max_connections_percent      = 90
    max_idle_connections_percent = 50
  }
}

resource "aws_db_proxy_target" "admateine" {
  db_proxy_name          = aws_db_proxy.admateine.name
  target_group_name      = aws_db_proxy_default_target_group.admateine.name
  db_instance_identifier = aws_db_instance.admateine_primary.id
}

# ── IAM Roles ────────────────────────────────────────────────────────────────

resource "aws_iam_role" "rds_monitoring" {
  name = "admateine-rds-monitoring-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_iam_role" "rds_proxy" {
  name = "admateine-rds-proxy-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "rds.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "rds_proxy" {
  name = "admateine-rds-proxy-policy"
  role = aws_iam_role.rds_proxy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.db_credentials.arn]
    }]
  })
}
