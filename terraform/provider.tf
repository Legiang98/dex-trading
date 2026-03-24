terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket  = "trading-tf-state-19"
    key     = "hyperliquid/terraform.tfstate"
    region  = "us-east-1"
    profile = "lab"
  }
}

provider "aws" {
  region  = "us-east-1"
  profile = "lab"
}
