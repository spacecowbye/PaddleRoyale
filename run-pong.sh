#!/bin/bash

# Stop the existing container (if running)
docker stop pong 2>/dev/null
echo "Container stopped"

# Remove the container (if exists)
docker rm pong 2>/dev/null
echo "container removed"

# Build the Docker image with tag 'pong' from the current directory
docker build -t pong .
echo "New build created"

# Run the container in detached mode, mapping port 8080
docker run -d -p 8080:8080 --name pong pong
echo "Container running locally on port 8080"