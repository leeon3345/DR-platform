FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=3001

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/*.mjs ./server/
RUN mkdir -p ./server/registry

EXPOSE 3001

CMD ["node", "server/server.mjs"]
