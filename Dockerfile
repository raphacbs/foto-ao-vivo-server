FROM node:20-alpine
WORKDIR /app

# Copia apenas os arquivos de dependência primeiro
COPY package*.json ./
RUN npm install --omit=dev

# Copia o resto do código
COPY . .

# 1. Cria as pastas para o disco persistente e ajusta as permissões para o usuário 'node'
RUN mkdir -p /app/data /app/uploads && chown -R node:node /app

# 2. Define que a aplicação rodará com o usuário restrito 'node' (padrão de segurança)
USER node

# Expõe a porta
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "start"]