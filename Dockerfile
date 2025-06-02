# Use a stable Alpine-based Node.js LTS image
FROM node:23-alpine 
# Set working directory inside container
WORKDIR /app

# Copy package.json and package-lock.json for dependency installation
# These files are in your 'server' subdirectory, relative to the Dockerfile.
COPY server/package.json ./
COPY server/package-lock.json ./ 

# Install only production dependencies
# Stick to `npm ci --omit=dev` for consistent and smaller production builds.
# The screenshot shows `npm install`, which is fine for local testing, but `npm ci --omit=dev` is better for Koyer.
RUN npm ci --omit=dev

# Copy server source files
# This copies everything from 'server/' into /app
COPY server/ ./

# Copy static public assets (assuming your server serves them from /public)
# This copies everything from 'public/' into /app/public
COPY public/ ./public/

# Expose the port your server listens on
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]