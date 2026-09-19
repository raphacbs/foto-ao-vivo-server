FROM node:20-alpine
WORKDIR /app

# Copia apenas os arquivos de dependência primeiro (otimiza o cache do Docker)
COPY package*.json ./
# Instala apenas as dependências de produção
RUN npm install --omit=dev

# Copia o resto do código
COPY . .

# Expõe a porta que sua API Node usa (ajuste se for diferente de 3000)
EXPOSE 3000

# Comando para iniciar a aplicação (ajuste para o seu script de start)
CMD ["npm", "start"]