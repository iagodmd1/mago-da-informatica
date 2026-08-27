# Site estático servido pelo Caddy. Imagem mínima, sem shell de aplicação,
# rodando como usuário sem privilégios.
FROM caddy:2.8-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html /srv/index.html

EXPOSE 8080

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
