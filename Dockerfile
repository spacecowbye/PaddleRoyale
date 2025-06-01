FROM node:23.11.0-alpine

WORKDIR /app

# Copy package files from server directory
COPY server/package*.json ./

# Install dependencies
RUN npm install

# Copy server source code
COPY server/ ./

# Copy public files if needed by the server
COPY public/ ./public/

EXPOSE 3000
CMD ["node", "server.js"]