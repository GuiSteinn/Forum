# ════════════════════════════════════════════════════════════════
#  ALB FRONTEND — porta 80 → NodePort 30080
# ════════════════════════════════════════════════════════════════

resource "aws_lb" "frontend" {
  name               = "forum-front-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  tags = { Name = "forum-front-alb" }
}

resource "aws_lb_target_group" "frontend" {
  name     = "forum-front-tg"
  port     = 30080
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/"
    port                = "30080"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 10
    interval            = 30
    matcher             = "200"
  }

  tags = { Name = "forum-front-tg" }
}

resource "aws_lb_listener" "frontend" {
  load_balancer_arn = aws_lb.frontend.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb_target_group_attachment" "frontend_server" {
  target_group_arn = aws_lb_target_group.frontend.arn
  target_id        = aws_instance.k3s_server.id
  port             = 30080
}

resource "aws_lb_target_group_attachment" "frontend_agent_a" {
  target_group_arn = aws_lb_target_group.frontend.arn
  target_id        = aws_instance.k3s_agent_a.id
  port             = 30080
}

resource "aws_lb_target_group_attachment" "frontend_agent_b" {
  target_group_arn = aws_lb_target_group.frontend.arn
  target_id        = aws_instance.k3s_agent_b.id
  port             = 30080
}

# ════════════════════════════════════════════════════════════════
#  ALB BACKEND — porta 80 → NodePort 30081
# ════════════════════════════════════════════════════════════════

resource "aws_lb" "backend" {
  name               = "forum-back-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  tags = { Name = "forum-back-alb" }
}

resource "aws_lb_target_group" "backend" {
  name     = "forum-back-tg"
  port     = 30081
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/health"
    port                = "30081"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 10
    interval            = 30
    matcher             = "200"
  }

  tags = { Name = "forum-back-tg" }
}

resource "aws_lb_listener" "backend" {
  load_balancer_arn = aws_lb.backend.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

resource "aws_lb_target_group_attachment" "backend_server" {
  target_group_arn = aws_lb_target_group.backend.arn
  target_id        = aws_instance.k3s_server.id
  port             = 30081
}

resource "aws_lb_target_group_attachment" "backend_agent_a" {
  target_group_arn = aws_lb_target_group.backend.arn
  target_id        = aws_instance.k3s_agent_a.id
  port             = 30081
}

resource "aws_lb_target_group_attachment" "backend_agent_b" {
  target_group_arn = aws_lb_target_group.backend.arn
  target_id        = aws_instance.k3s_agent_b.id
  port             = 30081
}
