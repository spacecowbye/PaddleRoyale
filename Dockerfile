FROM node:23.11.0-alpine

WORKDIR /app

# Copy server package files
COPY PaddleRoyale/server/package*.json ./

# Install dependencies
RUN npm install

# Copy server source code
COPY PaddleRoyale/server/ ./

# Copy public assets (used by express or static serving)
COPY PaddleRoyale/public/ ./public/

# Expose port (make sure your server uses 8080)
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
