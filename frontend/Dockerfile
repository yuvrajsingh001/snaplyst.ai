# --- Builder stage ---
FROM node:20-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm

# Copy only dependency files first
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

# Install dependencies (creates /app/node_modules)
RUN pnpm install --frozen-lockfile

# Now copy rest of source code (does NOT overwrite node_modules)
COPY . .

# Build Next.js
# System fonts are used via CSS, so no network dependency during build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# --- Runner stage ---
FROM node:20-alpine AS runner

WORKDIR /app
RUN npm install -g pnpm

# Copy only runtime artifacts
COPY --from=builder /app/package.json /app/pnpm-lock.yaml* /app/pnpm-workspace.yaml* ./
COPY --from=builder /app/next.config.ts* ./
COPY --from=builder /app/tsconfig.json* ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Install only prod dependencies (skip prepare script which requires husky)
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

EXPOSE 3000
CMD ["pnpm", "start"]
