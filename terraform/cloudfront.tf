# File Storage S3 Bucket
resource "aws_s3_bucket" "admateine_files" {
  bucket = "admateine-files-${var.environment}"
}

resource "aws_s3_bucket_versioning" "admateine_files" {
  bucket = aws_s3_bucket.admateine_files.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "admateine_files" {
  bucket = aws_s3_bucket.admateine_files.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "admateine_files" {
  bucket = aws_s3_bucket.admateine_files.id

  rule {
    id     = "expire-temp-imports"
    status = "Enabled"
    filter { prefix = "imports/temp/" }
    expiration { days = 1 }
  }

  rule {
    id     = "expire-exports"
    status = "Enabled"
    filter { prefix = "exports/" }
    expiration { days = 7 }
  }

  rule {
    id     = "move-old-attachments-to-glacier"
    status = "Enabled"
    filter { prefix = "attachments/" }
    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "admateine_files" {
  bucket                  = aws_s3_bucket.admateine_files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Frontend S3 Bucket
resource "aws_s3_bucket" "frontend" {
  bucket = "admateine-frontend-static-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Distribution
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "admateine-frontend-oac"
  description                       = "OAC for static frontend s3 bucket access"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = [var.domain_name]

  # S3 origin
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # API origin (ALB)
  origin {
    domain_name = aws_lb.admateine.dns_name
    origin_id   = "ALB-api"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Static assets — long cache
  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    target_origin_id       = "S3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = "65832f05-4d1e-4434-a63b-46b79737f451" # Managed CachingOptimized policy
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
  }

  # API routes — no caching
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "ALB-api"
    viewer_protocol_policy   = "redirect-to-https"
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed CachingDisabled
    origin_request_policy_id = "b5ec963e-1b94-4c8d-8fd4-18a847000d22" # Managed AllViewer
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
  }

  # SSE streaming — disable compression + caching
  ordered_cache_behavior {
    path_pattern             = "/api/*/stream"
    target_origin_id         = "ALB-api"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = false
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = "b5ec963e-1b94-4c8d-8fd4-18a847000d22"
    allowed_methods          = ["GET", "HEAD"]
    cached_methods           = ["GET", "HEAD"]
  }

  # SPA fallback
  default_cache_behavior {
    target_origin_id       = "S3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.admateine.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
