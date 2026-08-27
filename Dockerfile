# App Node/Express: serve o site e roda o sistema de agendamento com aprovação.
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY lib ./lib
COPY public ./public

# Diretório onde as solicitações ficam gravadas (ver README sobre Volume no Railway).
RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server.js"]
