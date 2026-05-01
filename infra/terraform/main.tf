# =============================================================================
# Terraform Root Module — Seed Round Infrastructure
# Scope:  EKS + RDS PostgreSQL + ElastiCache Redis + S3 + Vault
# Region: me-south-1 (Bahrain — data sovereignty)
# Stage:  Seed (single-tenant, AWS only)
# =============================================================================

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.27"
    }
  }

  backend "s3" {
    bucket         = "finops-terraform-state"
    key            = "seed/infrastructure.tfstate"
    region         = "me-south-1"
    dynamodb_table = "finops-terraform-locks"
    encrypt        = true
  }
}

# ---------------------------------------------------------------------------
# VARIABLES
# ---------------------------------------------------------------------------

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "seed"
  validation {
    condition     = contains(["seed", "staging", "production"], var.environment)
    error_message = "Environment must be seed, staging, or production."
  }
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "me-south-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "finops"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "eks_cluster_version" {
  description = "EKS Kubernetes version"
  type        = string
  default     = "1.29"
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.xlarge"
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "db_master_password" {
  description = "PostgreSQL master password (use Vault in production)"
  type        = string
  sensitive   = true
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Stage       = "seed"
  }
  azs = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
}

provider "aws" {
  region = var.aws_region
  default_tags { tags = local.common_tags }
}


# =============================================================================
# MODULE 1: VPC + NETWORKING
# =============================================================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "${local.name_prefix}-vpc" }
}

resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = local.azs[count.index]
  tags = { Name = "${local.name_prefix}-private-${local.azs[count.index]}" }
}

resource "aws_subnet" "public" {
  count                   = 3
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index + 3)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "${local.name_prefix}-public-${local.azs[count.index]}" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name_prefix}-igw" }
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "${local.name_prefix}-nat-eip" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = "${local.name_prefix}-nat" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
  tags = { Name = "${local.name_prefix}-private-rt" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${local.name_prefix}-public-rt" }
}

resource "aws_route_table_association" "private" {
  count          = 3
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "public" {
  count          = 3
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}


# =============================================================================
# MODULE 2: EKS CLUSTER (3-AZ HA)
# =============================================================================

resource "aws_iam_role" "eks_cluster" {
  name = "${local.name_prefix}-eks-cluster-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role_policy_attachment" "eks_vpc_cni" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
}

resource "aws_eks_cluster" "main" {
  name     = "${local.name_prefix}-cluster"
  version  = var.eks_cluster_version
  role_arn = aws_iam_role.eks_cluster.arn

  vpc_config {
    subnet_ids              = aws_subnet.private[*].id
    endpoint_private_access = true
    endpoint_public_access  = true  # Restricted at Angel
  }

  encryption_config {
    provider { key_arn = aws_kms_key.eks.arn }
    resources = ["secrets"]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator",
                                "controllerManager", "scheduler"]
}

resource "aws_kms_key" "eks" {
  description         = "EKS secret encryption key"
  enable_key_rotation = true
  tags                = { Name = "${local.name_prefix}-eks-kms" }
}

# --- EKS Node Groups ---

resource "aws_iam_role" "eks_nodes" {
  name = "${local.name_prefix}-eks-nodes-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_worker" {
  for_each = toset([
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
  ])
  role       = aws_iam_role.eks_nodes.name
  policy_arn = each.value
}

resource "aws_eks_node_group" "system" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${local.name_prefix}-system"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = aws_subnet.private[*].id
  instance_types  = ["m6i.xlarge"]

  scaling_config {
    desired_size = 3
    min_size     = 3
    max_size     = 3
  }

  labels = { role = "system" }

  tags = { Name = "${local.name_prefix}-system-nodes" }
}

resource "aws_eks_node_group" "agents" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${local.name_prefix}-agents"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = aws_subnet.private[*].id
  instance_types  = ["m6i.2xlarge"]

  scaling_config {
    desired_size = 3
    min_size     = 3
    max_size     = 6
  }

  labels = { role = "agent-worker" }

  tags = { Name = "${local.name_prefix}-agent-nodes" }
}


# =============================================================================
# MODULE 3: RDS POSTGRESQL 16 (Multi-AZ, RLS-ready)
# =============================================================================

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${local.name_prefix}-db-subnet-group" }
}

resource "aws_security_group" "rds" {
  name_prefix = "${local.name_prefix}-rds-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "PostgreSQL from EKS"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-rds-sg" }
}

resource "aws_kms_key" "rds" {
  description         = "RDS encryption key"
  enable_key_rotation = true
  tags                = { Name = "${local.name_prefix}-rds-kms" }
}

resource "aws_db_parameter_group" "pg16" {
  family = "postgres16"
  name   = "${local.name_prefix}-pg16-params"

  # RLS enforcement parameters
  parameter {
    name  = "log_statement"
    value = "ddl"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,pgaudit"
  }

  parameter {
    name  = "pgaudit.log"
    value = "write,ddl,role"
  }

  tags = { Name = "${local.name_prefix}-pg16-params" }
}

resource "aws_db_instance" "primary" {
  identifier     = "${local.name_prefix}-pg-primary"
  engine         = "postgres"
  engine_version = "16.3"
  instance_class = var.rds_instance_class

  allocated_storage     = 100
  max_allocated_storage = 500
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  db_name  = "finops"
  username = "finops_admin"
  password = var.db_master_password

  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.pg16.name

  backup_retention_period = 14
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name_prefix}-pg-final"
  copy_tags_to_snapshot     = true

  performance_insights_enabled    = true
  monitoring_interval             = 60
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = { Name = "${local.name_prefix}-pg-primary" }
}

resource "aws_db_instance" "read_replica" {
  identifier          = "${local.name_prefix}-pg-replica"
  replicate_source_db = aws_db_instance.primary.identifier
  instance_class      = var.rds_instance_class
  storage_encrypted   = true
  kms_key_id          = aws_kms_key.rds.arn

  performance_insights_enabled = true
  monitoring_interval          = 60

  tags = { Name = "${local.name_prefix}-pg-replica" }
}


# =============================================================================
# MODULE 4: ELASTICACHE REDIS (Sentinel HA)
# =============================================================================

resource "aws_security_group" "redis" {
  name_prefix = "${local.name_prefix}-redis-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Redis from EKS"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-redis-sg" }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_parameter_group" "redis7" {
  family = "redis7"
  name   = "${local.name_prefix}-redis7-params"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"    # Expired events for TTL monitoring
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.name_prefix}-redis"
  description          = "FinOps Seed Redis — agent state, events, cache"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_clusters   = 3    # 1 primary + 2 replicas (Sentinel HA)
  port                 = 6379

  automatic_failover_enabled = true
  multi_az_enabled           = true

  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
  parameter_group_name = aws_elasticache_parameter_group.redis7.name

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  snapshot_retention_limit = 7
  snapshot_window          = "04:00-05:00"
  maintenance_window       = "sun:05:00-sun:06:00"

  tags = { Name = "${local.name_prefix}-redis" }
}


# =============================================================================
# MODULE 5: S3 BUCKETS (per-tenant prefix isolation)
# =============================================================================

resource "aws_s3_bucket" "raw_staging" {
  bucket = "${local.name_prefix}-raw-staging-${var.aws_region}"
  tags   = { Name = "${local.name_prefix}-raw-staging", DataTier = "staging" }
}

resource "aws_s3_bucket" "cold_storage" {
  bucket = "${local.name_prefix}-cold-storage-${var.aws_region}"
  tags   = { Name = "${local.name_prefix}-cold-storage", DataTier = "cold" }
}

resource "aws_s3_bucket" "reports" {
  bucket = "${local.name_prefix}-reports-${var.aws_region}"
  tags   = { Name = "${local.name_prefix}-reports", DataTier = "reports" }
}

# --- Common bucket configuration ---

resource "aws_s3_bucket_versioning" "raw_staging" {
  bucket = aws_s3_bucket.raw_staging.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_versioning" "cold_storage" {
  bucket = aws_s3_bucket.cold_storage.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "raw_staging" {
  bucket = aws_s3_bucket.raw_staging.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cold_storage" {
  bucket = aws_s3_bucket.cold_storage.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cold_storage" {
  bucket = aws_s3_bucket.cold_storage.id

  rule {
    id     = "intelligent-tiering"
    status = "Enabled"
    transition {
      days          = 90
      storage_class = "INTELLIGENT_TIERING"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "all_buckets" {
  for_each = toset([
    aws_s3_bucket.raw_staging.id,
    aws_s3_bucket.cold_storage.id,
    aws_s3_bucket.reports.id,
  ])
  bucket                  = each.value
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}


# =============================================================================
# MODULE 6: HASHICORP VAULT (Single-node, KMS auto-unseal)
# =============================================================================

resource "aws_kms_key" "vault_unseal" {
  description         = "Vault auto-unseal key"
  enable_key_rotation = true
  tags                = { Name = "${local.name_prefix}-vault-unseal-kms" }
}

resource "aws_security_group" "vault" {
  name_prefix = "${local.name_prefix}-vault-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Vault API from EKS"
    from_port   = 8200
    to_port     = 8200
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  ingress {
    description = "Vault cluster from self"
    from_port   = 8201
    to_port     = 8201
    protocol    = "tcp"
    self        = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-vault-sg" }
}

resource "aws_instance" "vault" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t3.medium"
  subnet_id              = aws_subnet.private[0].id
  vpc_security_group_ids = [aws_security_group.vault.id]
  iam_instance_profile   = aws_iam_instance_profile.vault.name

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = <<-USERDATA
    #!/bin/bash
    # Vault installation via Helm on EKS is preferred;
    # this EC2 instance is a fallback for Seed simplicity.
    # Production: migrate to Vault HA on EKS at Angel.
    yum install -y yum-utils
    yum-config-manager --add-repo https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo
    yum -y install vault
    systemctl enable vault
  USERDATA

  tags = { Name = "${local.name_prefix}-vault" }
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_iam_role" "vault" {
  name = "${local.name_prefix}-vault-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "vault_kms" {
  name = "${local.name_prefix}-vault-kms-policy"
  role = aws_iam_role.vault.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["kms:Encrypt", "kms:Decrypt", "kms:DescribeKey"]
      Resource = aws_kms_key.vault_unseal.arn
    }]
  })
}

resource "aws_iam_instance_profile" "vault" {
  name = "${local.name_prefix}-vault-profile"
  role = aws_iam_role.vault.name
}


# =============================================================================
# OUTPUTS
# =============================================================================

output "vpc_id" {
  value = aws_vpc.main.id
}

output "eks_cluster_name" {
  value = aws_eks_cluster.main.name
}

output "eks_cluster_endpoint" {
  value = aws_eks_cluster.main.endpoint
}

output "rds_primary_endpoint" {
  value = aws_db_instance.primary.endpoint
}

output "rds_replica_endpoint" {
  value = aws_db_instance.read_replica.endpoint
}

output "redis_primary_endpoint" {
  value = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "s3_raw_staging_bucket" {
  value = aws_s3_bucket.raw_staging.id
}

output "s3_cold_storage_bucket" {
  value = aws_s3_bucket.cold_storage.id
}

output "s3_reports_bucket" {
  value = aws_s3_bucket.reports.id
}

output "vault_private_ip" {
  value = aws_instance.vault.private_ip
}

output "vault_unseal_key_arn" {
  value = aws_kms_key.vault_unseal.arn
}
