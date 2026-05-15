# ── k3s Server (control-plane) ── AZ-a ──────────────────────────

resource "aws_instance" "k3s_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public_a.id
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.nodes.id]
  iam_instance_profile   = var.lab_instance_profile

  user_data = templatefile("${path.module}/templates/server-userdata.sh.tpl", {
    region             = var.region
    az                 = var.az_a
    dockerhub_username = var.dockerhub_username
  })

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  tags = {
    Name = "forum-k3s-server"
    Role = "server"
  }
}

# ── k3s Agent 1 ── AZ-a ────────────────────────────────────────

resource "aws_instance" "k3s_agent_a" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public_a.id
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.nodes.id]
  iam_instance_profile   = var.lab_instance_profile

  user_data = templatefile("${path.module}/templates/agent-userdata.sh.tpl", {
    region            = var.region
    az                = var.az_a
    server_private_ip = aws_instance.k3s_server.private_ip
  })

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  depends_on = [aws_instance.k3s_server]

  tags = {
    Name = "forum-k3s-agent-a"
    Role = "agent"
  }
}

# ── k3s Agent 2 ── AZ-b ────────────────────────────────────────

resource "aws_instance" "k3s_agent_b" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public_b.id
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.nodes.id]
  iam_instance_profile   = var.lab_instance_profile

  user_data = templatefile("${path.module}/templates/agent-userdata.sh.tpl", {
    region            = var.region
    az                = var.az_b
    server_private_ip = aws_instance.k3s_server.private_ip
  })

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  depends_on = [aws_instance.k3s_server]

  tags = {
    Name = "forum-k3s-agent-b"
    Role = "agent"
  }
}
