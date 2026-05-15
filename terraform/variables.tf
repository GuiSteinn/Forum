variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "az_a" {
  description = "First availability zone"
  type        = string
  default     = "us-east-1a"
}

variable "az_b" {
  description = "Second availability zone"
  type        = string
  default     = "us-east-1b"
}

variable "key_name" {
  description = "EC2 key pair name for SSH access"
  type        = string
}

variable "my_ip" {
  description = "Your public IP for SSH access (CIDR, e.g. 203.0.113.10/32)"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for k3s nodes"
  type        = string
  default     = "t3.medium"
}

variable "dockerhub_username" {
  description = "Docker Hub username where forum images are pushed"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "lab_instance_profile" {
  description = "IAM Instance Profile name (already exists in Academy)"
  type        = string
  default     = "LabInstanceProfile"
}
