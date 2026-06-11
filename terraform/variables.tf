variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for deployment"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Environment identifier"
}

variable "domain_name" {
  type        = string
  default     = "app.admateine.com"
  description = "Application custom domain name"
}
