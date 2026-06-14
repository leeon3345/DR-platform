FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=3001

RUN apk add --no-cache expect openssh-client

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/*.mjs ./server/
COPY server/public/ ./server/public/
RUN mkdir -p ./server/registry

EXPOSE 3001

CMD ["node", "server/server.mjs"]
