FROM nginx:1.27-alpine

COPY services/static-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY services/static-web/public /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/run \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
