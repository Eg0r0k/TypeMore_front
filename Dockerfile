FROM nginx:alpine

RUN rm /usr/share/nginx/html/index.html

COPY dist/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]