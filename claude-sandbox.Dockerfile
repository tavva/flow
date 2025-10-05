FROM claude-code-sandbox:latest

USER root

# Install additional system dependencies for SSH forwarding
RUN apt-get update && apt-get install -y \
    socat \
    && rm -rf /var/lib/apt/lists/*

USER claude

# Set up SSH agent socket forwarding environment
ENV SSH_AUTH_SOCK=/tmp/ssh-agent.sock

# Create SSH config and add GitHub host key
RUN mkdir -p /home/claude/.ssh && \
    echo -e "Host personalgit\n        HostName github.com\n        User git\n        ForwardAgent yes" > /home/claude/.ssh/config && \
    ssh-keyscan github.com > /home/claude/.ssh/known_hosts && \
    chmod 600 /home/claude/.ssh/config && \
    chmod 644 /home/claude/.ssh/known_hosts && \
    chown -R claude:claude /home/claude/.ssh
