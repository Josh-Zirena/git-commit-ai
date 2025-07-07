# EC2 Instance
resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.app_key.key_name
  vpc_security_group_ids = [aws_security_group.ec2.id]
  subnet_id              = aws_subnet.public[0].id

  # User data script for Node.js setup
  user_data = file("${path.module}/user-data.sh")

  # Root volume configuration
  root_block_device {
    volume_type           = var.root_volume_type
    volume_size           = var.root_volume_size
    delete_on_termination = true
    encrypted             = true

    tags = {
      Name = "${var.project_name}-root-volume"
    }
  }

  # Enable detailed monitoring
  monitoring = true

  # Instance metadata options (IMDSv2)
  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
    http_put_response_hop_limit = 2
  }

  # Credit specification for burstable instances
  credit_specification {
    cpu_credits = "standard"
  }

  tags = {
    Name = "${var.project_name}-app-instance"
  }
}

# Elastic IP for the instance (optional, for consistent IP)
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-app-eip"
  }

  depends_on = [aws_internet_gateway.main]
}