FROM node:20-alpine

WORKDIR /app/backend

# Instalar solo dependencias de producción
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copiar código fuente manteniendo la estructura relativa
COPY backend/ ./
COPY frontend/ ../frontend/

EXPOSE 3001

CMD ["node", "server.js"]
