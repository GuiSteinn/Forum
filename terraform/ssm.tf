resource "aws_ssm_parameter" "k3s_token" {
  name        = "/forum/k3s-token"
  description = "k3s cluster join token (written by server user_data)"
  type        = "SecureString"
  value       = "placeholder"

  lifecycle {
    ignore_changes = [value]
  }

  tags = { Name = "forum-k3s-token" }
}
