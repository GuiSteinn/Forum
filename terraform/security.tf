resource "aws_security_group" "alb" {
  name        = "forum-alb-sg"
  description = "ALB - permite HTTP do mundo"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "forum-alb-sg" }
}

resource "aws_security_group" "nodes" {
  name        = "forum-nodes-sg"
  description = "k3s nodes - NodePorts do ALB, trafego entre nodes, SSH"
  vpc_id      = aws_vpc.main.id

  # NodePort frontend (30080) vindo do ALB
  ingress {
    description     = "NodePort frontend from ALB"
    from_port       = 30080
    to_port         = 30080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # NodePort backend (30081) vindo do ALB
  ingress {
    description     = "NodePort backend from ALB"
    from_port       = 30081
    to_port         = 30081
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Trafego entre nodes (k3s cluster, flannel/vxlan, kubelet, etc.)
  ingress {
    description = "All traffic between k3s nodes"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  # SSH do meu IP
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }

  # k3s API server (6443) dos agents
  ingress {
    description = "k3s API server"
    from_port   = 6443
    to_port     = 6443
    protocol    = "tcp"
    self        = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "forum-nodes-sg" }
}
