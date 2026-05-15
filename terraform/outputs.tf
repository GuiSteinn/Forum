output "frontend_url" {
  description = "URL do Forum (ALB Frontend)"
  value       = "http://${aws_lb.frontend.dns_name}"
}

output "backend_url" {
  description = "URL da API (ALB Backend)"
  value       = "http://${aws_lb.backend.dns_name}"
}

output "k3s_server_public_ip" {
  description = "IP publico do server k3s (para SSH)"
  value       = aws_instance.k3s_server.public_ip
}

output "k3s_agent_a_public_ip" {
  description = "IP publico do agent A"
  value       = aws_instance.k3s_agent_a.public_ip
}

output "k3s_agent_b_public_ip" {
  description = "IP publico do agent B"
  value       = aws_instance.k3s_agent_b.public_ip
}

output "ssh_command" {
  description = "Comando para conectar no server k3s"
  value       = "ssh -i <sua-chave.pem> ubuntu@${aws_instance.k3s_server.public_ip}"
}
