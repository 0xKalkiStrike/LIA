# ── LIA Frontend Dockerfile ──────────────────────────────────────────
FROM node:18-alpine

WORKDIR /app

# Copy lock files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose Next.js port
EXPOSE 3000

# Command to run development dev server
CMD ["npm", "run", "dev"]
